-- Tabelloni multipli: oltre al tabellone principale l'organizzatore puo creare
-- tabelloni aggiuntivi (consolazione, piazzamenti, categorie separate).
-- Ogni partita della fase finale appartiene a un tabellone identificato da bracket_no.

alter table public.tournament_games
  add column if not exists bracket_no smallint not null default 1;

alter table public.tournament_games drop constraint if exists tournament_games_bracket_no_check;
alter table public.tournament_games
  add constraint tournament_games_bracket_no_check check (bracket_no between 1 and 20);

-- La posizione va resa unica per tabellone, non piu solo per fase e turno.
alter table public.tournament_games
  drop constraint if exists tournament_games_tournament_id_phase_round_no_position_key;
alter table public.tournament_games
  drop constraint if exists tournament_games_slot_unique;
alter table public.tournament_games
  add constraint tournament_games_slot_unique unique (tournament_id, phase, bracket_no, round_no, position);

-- ---- Creazione turni: ora mirata a un tabellone specifico ----
drop function if exists public.generate_tournament_bracket_round(uuid, smallint, smallint);

create function public.generate_tournament_bracket_round(
  p_tournament_id uuid, p_round_no smallint, p_slots smallint, p_bracket_no smallint default 1
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
  next_position smallint;
  slot integer;
  added integer := 0;
  v_bracket smallint := greatest(1, coalesce(p_bracket_no, 1));
begin
  if p_slots is null or p_slots < 1 or p_slots > 32 then raise exception 'Numero di partite non valido'; end if;
  for slot in 1..p_slots loop
    select (coalesce(max(position), 0) + 1)::smallint into next_position
    from public.tournament_games
    where tournament_id = p_tournament_id and phase = 'knockout'
      and bracket_no = v_bracket and round_no = greatest(1, p_round_no);
    insert into public.tournament_games(tournament_id, phase, group_id, bracket_no, round_no, position, team1_id, team2_id)
    values (p_tournament_id, 'knockout', null, v_bracket, greatest(1, p_round_no), next_position, null, null);
    added := added + 1;
  end loop;
  return added;
end;
$$;

-- ---- Salvataggio partita: conserva il tabellone di appartenenza ----
drop function if exists public.save_tournament_game(uuid, uuid, public.tournament_game_phase, uuid, smallint, smallint, uuid, uuid);

create function public.save_tournament_game(
  p_tournament_id uuid,
  p_game_id uuid,
  p_phase public.tournament_game_phase,
  p_group_id uuid,
  p_round_no smallint,
  p_position smallint,
  p_team1_id uuid,
  p_team2_id uuid,
  p_bracket_no smallint default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare target public.tournaments := public.assert_tournament_organizer(p_tournament_id); saved_id uuid;
begin
  if p_team1_id is not null and p_team1_id = p_team2_id then raise exception 'Una coppia non puo giocare contro se stessa'; end if;
  if p_phase = 'group' and (p_group_id is null or not exists (
    select 1 from public.tournament_groups where id = p_group_id and tournament_id = p_tournament_id
  )) then raise exception 'Seleziona un girone valido'; end if;
  if p_phase <> 'group' then p_group_id := null; end if;
  if exists (
    select 1 from unnest(array[p_team1_id, p_team2_id]) as candidate(team_id)
    where candidate.team_id is not null and not exists (
      select 1 from public.tournament_teams where id = candidate.team_id and tournament_id = p_tournament_id and status <> 'withdrawn'
    )
  ) then raise exception 'Coppia non disponibile'; end if;

  if p_game_id is null then
    insert into public.tournament_games(tournament_id, phase, group_id, bracket_no, round_no, position, team1_id, team2_id)
    values (p_tournament_id, p_phase, p_group_id, greatest(1, coalesce(p_bracket_no, 1)),
      greatest(1, p_round_no), greatest(1, p_position), p_team1_id, p_team2_id)
    returning id into saved_id;
  else
    update public.tournament_games set phase = p_phase, group_id = p_group_id,
      bracket_no = greatest(1, coalesce(p_bracket_no, bracket_no)),
      round_no = greatest(1, p_round_no), position = greatest(1, p_position),
      team1_id = p_team1_id, team2_id = p_team2_id
    where id = p_game_id and tournament_id = p_tournament_id and status = 'scheduled'
    returning id into saved_id;
    if saved_id is null then raise exception 'La partita non e piu modificabile'; end if;
  end if;
  return saved_id;
end;
$$;

-- Elimina un intero tabellone, purche non contenga risultati.
create or replace function public.delete_tournament_bracket(p_tournament_id uuid, p_bracket_no smallint)
returns integer language plpgsql security definer set search_path = '' as $$
declare target public.tournaments := public.assert_tournament_organizer(p_tournament_id); removed integer;
begin
  if exists (
    select 1 from public.tournament_games
    where tournament_id = p_tournament_id and phase <> 'group'
      and bracket_no = p_bracket_no and status <> 'scheduled'
  ) then raise exception 'Il tabellone contiene gia dei risultati'; end if;
  delete from public.tournament_games
  where tournament_id = p_tournament_id and phase <> 'group' and bracket_no = p_bracket_no;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.generate_tournament_bracket_round(uuid, smallint, smallint, smallint) from public;
revoke all on function public.save_tournament_game(uuid, uuid, public.tournament_game_phase, uuid, smallint, smallint, uuid, uuid, smallint) from public;
revoke all on function public.delete_tournament_bracket(uuid, smallint) from public;

grant execute on function
  public.generate_tournament_bracket_round(uuid, smallint, smallint, smallint),
  public.save_tournament_game(uuid, uuid, public.tournament_game_phase, uuid, smallint, smallint, uuid, uuid, smallint),
  public.delete_tournament_bracket(uuid, smallint) to authenticated;

notify pgrst, 'reload schema';
