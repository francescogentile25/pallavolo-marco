-- Sezione torneo — riorganizzazione richiesta dal committente.
-- 1) Gironi con capienza (n° giocatori) e slot partita pianificati (n° partite).
-- 2) L'organizzatore può accoppiare due iscritti singoli in una coppia.
-- 3) Chiusura esplicita dei gironi: sblocca l'inserimento dei risultati del tabellone,
--    che resta comunque costruibile mentre i gironi sono ancora in corso.

alter table public.tournaments
  add column if not exists groups_closed_at timestamptz;

alter table public.tournament_groups
  add column if not exists capacity smallint,
  add column if not exists planned_matches smallint;

alter table public.tournament_groups drop constraint if exists tournament_groups_capacity_check;
alter table public.tournament_groups
  add constraint tournament_groups_capacity_check check (capacity is null or capacity between 2 and 32);
alter table public.tournament_groups drop constraint if exists tournament_groups_planned_matches_check;
alter table public.tournament_groups
  add constraint tournament_groups_planned_matches_check check (planned_matches is null or planned_matches between 0 and 60);

-- ---- Girone: creazione/aggiornamento con capienza e slot partita ----
drop function if exists public.upsert_tournament_group(uuid, uuid, text, smallint);

create function public.upsert_tournament_group(
  p_tournament_id uuid, p_group_id uuid, p_name text, p_position smallint default null,
  p_capacity smallint default null, p_planned_matches smallint default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
  created_id uuid;
  next_position smallint;
  existing_slots integer;
  missing_slots integer;
  slot integer;
begin
  if char_length(trim(p_name)) not between 1 and 40 then raise exception 'Nome girone non valido'; end if;

  if p_group_id is null then
    select (coalesce(max(position), 0) + 1)::smallint into next_position
    from public.tournament_groups where tournament_id = p_tournament_id;
    insert into public.tournament_groups(tournament_id, name, position, capacity, planned_matches)
    values (p_tournament_id, trim(p_name), coalesce(p_position, next_position), p_capacity, p_planned_matches)
    returning id into created_id;
  else
    update public.tournament_groups
      set name = trim(p_name),
          capacity = coalesce(p_capacity, capacity),
          planned_matches = coalesce(p_planned_matches, planned_matches)
    where id = p_group_id and tournament_id = p_tournament_id
    returning id into created_id;
    if created_id is null then raise exception 'Girone non trovato'; end if;
  end if;

  -- Allinea gli slot partita del girone al numero pianificato: aggiunge slot vuoti
  -- oppure rimuove solo quelli ancora vuoti e non giocati.
  if p_planned_matches is not null then
    select count(*) into existing_slots from public.tournament_games where group_id = created_id;
    missing_slots := p_planned_matches - existing_slots;
    if missing_slots > 0 then
      for slot in 1..missing_slots loop
        select (coalesce(max(position), 0) + 1)::smallint into next_position
        from public.tournament_games
        where tournament_id = p_tournament_id and phase = 'group' and round_no = 1;
        insert into public.tournament_games(tournament_id, phase, group_id, round_no, position, team1_id, team2_id)
        values (p_tournament_id, 'group', created_id, 1, next_position, null, null);
      end loop;
    elsif missing_slots < 0 then
      delete from public.tournament_games
      where id in (
        select id from public.tournament_games
        where group_id = created_id and status = 'scheduled' and team1_id is null and team2_id is null
        order by position desc limit (-missing_slots)
      );
    end if;
  end if;

  return created_id;
end;
$$;

-- ---- Accoppiamento di due iscritti singoli ----
create or replace function public.organizer_pair_single_teams(
  p_tournament_id uuid, p_team1_id uuid, p_team2_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
  moved_profile uuid;
  confirmed_count integer;
begin
  if p_team1_id = p_team2_id then raise exception 'Seleziona due giocatori diversi'; end if;
  if not exists (select 1 from public.tournament_teams
      where id = p_team1_id and tournament_id = p_tournament_id and status <> 'withdrawn')
    or not exists (select 1 from public.tournament_teams
      where id = p_team2_id and tournament_id = p_tournament_id and status <> 'withdrawn')
  then raise exception 'Iscrizione non disponibile'; end if;

  if (select count(*) from public.tournament_team_members where team_id = p_team1_id and status <> 'rejected') <> 1
    or (select count(*) from public.tournament_team_members where team_id = p_team2_id and status <> 'rejected') <> 1
  then raise exception 'Seleziona due iscritti singoli'; end if;

  if exists (
    select 1 from public.tournament_games
    where tournament_id = p_tournament_id and status in ('completed', 'pending_confirmation', 'walkover')
      and (team1_id in (p_team1_id, p_team2_id) or team2_id in (p_team1_id, p_team2_id))
  ) then raise exception 'Uno dei giocatori ha gia disputato una partita'; end if;

  select profile_id into moved_profile
  from public.tournament_team_members where team_id = p_team2_id and status <> 'rejected' limit 1;

  update public.tournament_team_members
    set team_id = p_team1_id, status = 'accepted', responded_at = now()
  where team_id = p_team2_id and profile_id = moved_profile;

  delete from public.tournament_group_teams where team_id = p_team2_id;
  update public.tournament_games set team1_id = null
    where tournament_id = p_tournament_id and team1_id = p_team2_id;
  update public.tournament_games set team2_id = null
    where tournament_id = p_tournament_id and team2_id = p_team2_id;
  update public.tournament_teams set status = 'withdrawn' where id = p_team2_id;

  select count(*) into confirmed_count from public.tournament_teams
  where tournament_id = p_tournament_id and status = 'confirmed' and id <> p_team1_id;
  update public.tournament_teams
    set status = (case when confirmed_count < target.max_teams then 'confirmed' else 'waitlisted' end)::public.tournament_team_status,
        waitlist_position = null
  where id = p_team1_id;

  return p_team1_id;
end;
$$;

-- ---- Chiusura / riapertura dei gironi ----
create or replace function public.close_tournament_groups(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
begin
  if not exists (select 1 from public.tournament_games
    where tournament_id = p_tournament_id and phase = 'group' and status = 'completed')
  then raise exception 'Nessun risultato registrato nei gironi'; end if;
  if exists (select 1 from public.tournament_games
    where tournament_id = p_tournament_id and phase = 'group'
      and status = 'scheduled' and team1_id is not null and team2_id is not null)
  then raise exception 'Completa tutti gli incontri dei gironi'; end if;
  update public.tournaments set groups_closed_at = now() where id = p_tournament_id;
end;
$$;

create or replace function public.reopen_tournament_groups(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
begin
  if exists (select 1 from public.tournament_games
    where tournament_id = p_tournament_id and phase <> 'group' and status <> 'scheduled')
  then raise exception 'Il tabellone contiene gia dei risultati'; end if;
  update public.tournaments set groups_closed_at = null where id = p_tournament_id;
end;
$$;

-- Il tabellone si costruisce liberamente, ma i risultati si registrano solo a gironi chiusi.
create or replace function public.guard_knockout_results_after_groups()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_closed timestamptz; v_has_groups boolean;
begin
  if new.phase = 'group' then return new; end if;
  if new.team1_scores is null then return new; end if;
  if old.team1_scores is not distinct from new.team1_scores
     and old.team2_scores is not distinct from new.team2_scores then return new; end if;
  select t.groups_closed_at, exists (select 1 from public.tournament_groups g where g.tournament_id = t.id)
    into v_closed, v_has_groups
  from public.tournaments t where t.id = new.tournament_id;
  if v_has_groups and v_closed is null then
    raise exception 'Chiudi i gironi prima di registrare i risultati del tabellone';
  end if;
  return new;
end;
$$;

drop trigger if exists tournament_games_guard_knockout_results on public.tournament_games;
create trigger tournament_games_guard_knockout_results
before update on public.tournament_games
for each row execute procedure public.guard_knockout_results_after_groups();

-- ---- Turni del tabellone creati come slot vuoti, riempibili trascinando i giocatori ----
create or replace function public.generate_tournament_bracket_round(
  p_tournament_id uuid, p_round_no smallint, p_slots smallint
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
  next_position smallint;
  slot integer;
  added integer := 0;
begin
  if p_slots is null or p_slots < 1 or p_slots > 32 then raise exception 'Numero di partite non valido'; end if;
  for slot in 1..p_slots loop
    select (coalesce(max(position), 0) + 1)::smallint into next_position
    from public.tournament_games
    where tournament_id = p_tournament_id and phase = 'knockout' and round_no = greatest(1, p_round_no);
    insert into public.tournament_games(tournament_id, phase, group_id, round_no, position, team1_id, team2_id)
    values (p_tournament_id, 'knockout', null, greatest(1, p_round_no), next_position, null, null);
    added := added + 1;
  end loop;
  return added;
end;
$$;

revoke all on function public.upsert_tournament_group(uuid, uuid, text, smallint, smallint, smallint) from public;
revoke all on function public.organizer_pair_single_teams(uuid, uuid, uuid) from public;
revoke all on function public.close_tournament_groups(uuid) from public;
revoke all on function public.reopen_tournament_groups(uuid) from public;
revoke all on function public.generate_tournament_bracket_round(uuid, smallint, smallint) from public;

grant execute on function
  public.upsert_tournament_group(uuid, uuid, text, smallint, smallint, smallint),
  public.organizer_pair_single_teams(uuid, uuid, uuid),
  public.close_tournament_groups(uuid),
  public.reopen_tournament_groups(uuid),
  public.generate_tournament_bracket_round(uuid, smallint, smallint) to authenticated;

notify pgrst, 'reload schema';
