-- Tabellone costruito a mano: nomi personalizzati e sblocco dopo il primo risultato.
--
-- Il torneo veniva marcato "completed" al PRIMO risultato della fase finale: i tabelloni
-- costruiti a mano non hanno next_game_id, quindi il ramo che chiudeva il torneo scattava
-- subito. Da li in poi assert_tournament_organizer rifiutava ogni modifica e si bloccava
-- tutto: niente nuove partite, niente nuovi tabelloni, niente vincitore nel turno dopo.

-- ---- 1) Il torneo si chiude solo quando non resta piu nulla da giocare ----
create or replace function public.finalize_tournament_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare game public.tournament_games; target public.tournaments; loser uuid; last_round integer; third_game uuid;
begin
  select * into game from public.tournament_games where id = p_game_id for update;
  select * into target from public.tournaments where id = game.tournament_id;
  if game.winner_team_id is null then raise exception 'Il risultato non ha un vincitore'; end if;
  update public.tournament_games set status = 'completed' where id = p_game_id;

  if game.phase = 'knockout' and target.third_place then
    select max(round_no) into last_round from public.tournament_games
    where tournament_id = game.tournament_id and phase = 'knockout';
    if game.round_no = last_round - 1 then
      loser := case when game.winner_team_id = game.team1_id then game.team2_id else game.team1_id end;
      select id into third_game from public.tournament_games
      where tournament_id = game.tournament_id and phase = 'third_place';
      if game.position % 2 = 1 then update public.tournament_games set team1_id = loser where id = third_game;
      else update public.tournament_games set team2_id = loser where id = third_game; end if;
    end if;
  end if;

  -- Avanzamento automatico solo dove il tabellone e stato generato con i collegamenti.
  if game.next_game_id is not null then
    if game.position % 2 = 1 then update public.tournament_games set team1_id = game.winner_team_id where id = game.next_game_id;
    else update public.tournament_games set team2_id = game.winner_team_id where id = game.next_game_id; end if;
  elsif game.phase <> 'group' and not exists (
    -- niente altro da giocare in tutto il torneo: solo allora e concluso
    select 1 from public.tournament_games other
    where other.tournament_id = game.tournament_id and other.id <> game.id
      and other.status not in ('completed', 'walkover', 'cancelled')
  ) then
    update public.tournaments set status = 'completed' where id = game.tournament_id;
  end if;
end;
$$;

-- Via di uscita se un torneo risulta concluso troppo presto.
create or replace function public.reopen_tournament(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target public.tournaments;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception 'Torneo non trovato'; end if;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then
    raise exception 'Permesso organizzatore richiesto';
  end if;
  if target.status <> 'completed' then raise exception 'Il torneo non e concluso'; end if;
  update public.tournaments set status = 'in_progress' where id = p_tournament_id;
end;
$$;

-- Ripara i tornei chiusi per errore dal vecchio comportamento: hanno ancora partite da giocare.
update public.tournaments t set status = 'in_progress'
where t.status = 'completed' and exists (
  select 1 from public.tournament_games g
  where g.tournament_id = t.id and g.status not in ('completed', 'walkover', 'cancelled')
);

-- ---- 2) Nome personalizzato del tabellone ----
create table if not exists public.tournament_brackets (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  bracket_no smallint not null check (bracket_no between 1 and 20),
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  primary key (tournament_id, bracket_no)
);

alter table public.tournament_brackets enable row level security;
create policy "tournament_brackets_select_visible" on public.tournament_brackets
  for select to authenticated using (exists (select 1 from public.tournaments t where t.id = tournament_id));
grant select on public.tournament_brackets to authenticated;

create or replace function public.set_tournament_bracket_name(
  p_tournament_id uuid, p_bracket_no smallint, p_name text
) returns void language plpgsql security definer set search_path = '' as $$
declare target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
begin
  if char_length(trim(coalesce(p_name, ''))) = 0 then
    delete from public.tournament_brackets
    where tournament_id = p_tournament_id and bracket_no = p_bracket_no;
    return;
  end if;
  insert into public.tournament_brackets(tournament_id, bracket_no, name)
  values (p_tournament_id, p_bracket_no, trim(p_name))
  on conflict (tournament_id, bracket_no) do update set name = excluded.name;
end;
$$;

-- ---- 3) Azzeramento completo dei gironi, risultati inclusi ----
create or replace function public.reset_tournament_groups(p_tournament_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare target public.tournaments := public.assert_tournament_organizer(p_tournament_id); removed integer;
begin
  delete from public.tournament_games
  where tournament_id = p_tournament_id and phase = 'group';
  delete from public.tournament_groups where tournament_id = p_tournament_id;
  get diagnostics removed = row_count;
  update public.tournaments set groups_closed_at = null where id = p_tournament_id;
  return removed;
end;
$$;

-- Il singolo girone si puo eliminare anche se contiene risultati, su richiesta esplicita.
drop function if exists public.delete_tournament_group(uuid, uuid);

create function public.delete_tournament_group(
  p_tournament_id uuid, p_group_id uuid, p_force boolean default false
) returns void language plpgsql security definer set search_path = '' as $$
declare target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
begin
  if not p_force and exists (
    select 1 from public.tournament_games
    where group_id = p_group_id and status in ('completed', 'pending_confirmation', 'walkover')
  ) then raise exception 'Il girone contiene partite gia disputate'; end if;

  delete from public.tournament_games where group_id = p_group_id;
  delete from public.tournament_groups where id = p_group_id and tournament_id = p_tournament_id;
  if not found then raise exception 'Girone non trovato'; end if;
end;
$$;

revoke all on function public.reopen_tournament(uuid) from public;
revoke all on function public.set_tournament_bracket_name(uuid, smallint, text) from public;
revoke all on function public.reset_tournament_groups(uuid) from public;
revoke all on function public.delete_tournament_group(uuid, uuid, boolean) from public;

grant execute on function
  public.reopen_tournament(uuid),
  public.set_tournament_bracket_name(uuid, smallint, text),
  public.reset_tournament_groups(uuid),
  public.delete_tournament_group(uuid, uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
