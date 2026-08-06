-- Podio del torneo, citta dell'evento e correzione degli errori sul tabellone.

-- ---- 1) Citta dell'evento, oltre al campo ----
alter table public.tournaments
  add column if not exists city text;
alter table public.tournaments drop constraint if exists tournaments_city_check;
alter table public.tournaments
  add constraint tournaments_city_check check (city is null or char_length(trim(city)) between 2 and 80);

-- ---- 2) Podio: serve a riconoscere chi ha vinto il torneo ----
alter table public.tournaments
  add column if not exists champion_team_id uuid references public.tournament_teams(id) on delete set null,
  add column if not exists runner_up_team_id uuid references public.tournament_teams(id) on delete set null,
  add column if not exists third_place_team_id uuid references public.tournament_teams(id) on delete set null;

create or replace function public.set_tournament_podium(
  p_tournament_id uuid, p_first uuid, p_second uuid, p_third uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  target public.tournaments;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception 'Torneo non trovato'; end if;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then
    raise exception 'Permesso organizzatore richiesto';
  end if;

  -- le posizioni devono essere iscrizioni di questo torneo e tutte diverse fra loro
  if exists (
    select 1 from unnest(array[p_first, p_second, p_third]) as chosen(team_id)
    where chosen.team_id is not null and not exists (
      select 1 from public.tournament_teams
      where id = chosen.team_id and tournament_id = p_tournament_id and status <> 'withdrawn'
    )
  ) then raise exception 'Coppia non disponibile'; end if;
  if (p_first is not null and p_first in (p_second, p_third))
     or (p_second is not null and p_second = p_third) then
    raise exception 'Le tre posizioni devono essere diverse';
  end if;

  update public.tournaments
    set champion_team_id = p_first, runner_up_team_id = p_second, third_place_team_id = p_third
  where id = p_tournament_id;
end;
$$;

-- Chiusura esplicita del torneo da parte dell'organizzatore.
create or replace function public.finish_tournament(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target public.tournaments;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception 'Torneo non trovato'; end if;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then
    raise exception 'Permesso organizzatore richiesto';
  end if;
  if target.status in ('cancelled', 'archived') then raise exception 'Il torneo non accetta questa operazione'; end if;
  if target.champion_team_id is null then raise exception 'Indica almeno la coppia vincitrice'; end if;
  update public.tournaments set status = 'completed' where id = p_tournament_id;
end;
$$;

-- Albo d'oro per profilo: alimenta le statistiche del giocatore senza contatori da tenere allineati.
create or replace function public.get_profile_tournament_podiums(p_profile_id uuid)
returns table(first_places integer, second_places integer, third_places integer)
language sql stable security definer set search_path = '' as $$
  select
    count(*) filter (where t.champion_team_id = m.team_id)::integer,
    count(*) filter (where t.runner_up_team_id = m.team_id)::integer,
    count(*) filter (where t.third_place_team_id = m.team_id)::integer
  from public.tournament_team_members m
  join public.tournaments t on t.id = (
    select tt.tournament_id from public.tournament_teams tt where tt.id = m.team_id
  )
  where m.profile_id = p_profile_id and m.status <> 'rejected'
    and t.status in ('completed', 'archived')
    and m.team_id in (t.champion_team_id, t.runner_up_team_id, t.third_place_team_id);
$$;

-- ---- 3) Eliminare una partita anche a risultato registrato, per correggere errori ----
drop function if exists public.delete_tournament_game(uuid, uuid);

create function public.delete_tournament_game(
  p_tournament_id uuid, p_game_id uuid, p_force boolean default false
) returns void language plpgsql security definer set search_path = '' as $$
declare target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
begin
  if p_force then
    delete from public.tournament_result_confirmations where game_id = p_game_id;
    update public.tournament_games set next_game_id = null where next_game_id = p_game_id;
    delete from public.tournament_games where id = p_game_id and tournament_id = p_tournament_id;
  else
    delete from public.tournament_games
    where id = p_game_id and tournament_id = p_tournament_id and status = 'scheduled';
  end if;
  if not found then raise exception 'La partita non e piu eliminabile'; end if;
end;
$$;

revoke all on function public.set_tournament_podium(uuid, uuid, uuid, uuid) from public;
revoke all on function public.finish_tournament(uuid) from public;
revoke all on function public.get_profile_tournament_podiums(uuid) from public;
revoke all on function public.delete_tournament_game(uuid, uuid, boolean) from public;

grant execute on function
  public.set_tournament_podium(uuid, uuid, uuid, uuid),
  public.finish_tournament(uuid),
  public.get_profile_tournament_podiums(uuid),
  public.delete_tournament_game(uuid, uuid, boolean) to authenticated;

-- ---- 4) La citta arriva gia dalla creazione ----
drop function if exists public.create_tournament(text, text, uuid, uuid[], public.match_gender, smallint, smallint, timestamptz, timestamptz, timestamptz, integer);

create function public.create_tournament(
  p_title text, p_description text, p_venue_id uuid, p_court_ids uuid[],
  p_gender public.match_gender, p_min_level smallint, p_max_level smallint,
  p_registration_deadline timestamptz, p_starts_at timestamptz, p_ends_at timestamptz,
  p_cost_cents integer, p_city text default null
) returns public.tournaments language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  created public.tournaments;
begin
  if actor is null or not public.can_organize_tournaments() then
    raise exception 'Permesso organizzatore richiesto';
  end if;
  if char_length(trim(p_title)) not between 3 and 100 then
    raise exception 'Nome torneo non valido';
  end if;
  if p_min_level > p_max_level then
    raise exception 'Fascia di livello non valida';
  end if;
  if p_starts_at <= now() + interval '1 hour'
     or p_registration_deadline >= p_starts_at
     or p_starts_at >= p_ends_at
     or coalesce(array_length(p_court_ids, 1), 0) = 0 then
    raise exception 'Controlla date e campi del torneo';
  end if;
  if exists (
    select 1 from unnest(p_court_ids) supplied(id)
    left join public.courts court
      on court.id = supplied.id and court.venue_id = p_venue_id and court.active
    where court.id is null
  ) then
    raise exception 'Uno o piu campi non appartengono al luogo selezionato';
  end if;

  insert into public.tournaments (
    organizer_id, venue_id, city, title, description, registration_mode, format, gender,
    min_level, max_level, max_teams, registration_deadline, starts_at, ends_at,
    cost_cents, guaranteed_matches, group_size, qualifiers_per_group, group_best_of,
    group_set_points, knockout_best_of, knockout_set_points, tiebreak_points,
    win_by_two, third_place, standings_win_points, standings_loss_points,
    minimum_rest_minutes, result_confirmation_required
  ) values (
    actor, p_venue_id, nullif(trim(coalesce(p_city, '')), ''), trim(p_title), nullif(trim(p_description), ''),
    'hybrid'::public.tournament_registration_mode, 'mixed'::public.tournament_format,
    p_gender, p_min_level, p_max_level, 64, p_registration_deadline, p_starts_at,
    p_ends_at, p_cost_cents, 0, 4, 2, 1, 21, 3, 21, 15, true, false, 2, 0, 0, false
  ) returning * into created;

  insert into public.tournament_courts (tournament_id, court_id)
  select created.id, id from (select distinct unnest(p_court_ids) id) courts;
  return created;
end;
$$;

revoke all on function public.create_tournament(text, text, uuid, uuid[], public.match_gender, smallint, smallint, timestamptz, timestamptz, timestamptz, integer, text) from public;
grant execute on function public.create_tournament(text, text, uuid, uuid[], public.match_gender, smallint, smallint, timestamptz, timestamptz, timestamptz, integer, text) to authenticated;

notify pgrst, 'reload schema';
