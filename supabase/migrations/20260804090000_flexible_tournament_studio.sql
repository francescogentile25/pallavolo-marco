-- Flexible tournament studio: personal presets, editable structures and no draws.

alter table public.tournaments drop constraint if exists tournaments_max_teams_check;
alter table public.tournaments drop constraint if exists tournaments_guaranteed_matches_check;
alter table public.tournaments drop constraint if exists tournaments_group_size_check;
alter table public.tournaments drop constraint if exists tournaments_qualifiers_per_group_check;
alter table public.tournaments drop constraint if exists tournaments_group_best_of_check;
alter table public.tournaments drop constraint if exists tournaments_knockout_best_of_check;

alter table public.tournaments
  add constraint tournaments_max_teams_check check (max_teams between 2 and 64),
  add constraint tournaments_guaranteed_matches_check check (guaranteed_matches between 0 and 50),
  add constraint tournaments_group_size_check check (group_size is null or group_size between 2 and 16),
  add constraint tournaments_qualifiers_per_group_check check (qualifiers_per_group is null or qualifiers_per_group between 1 and 16),
  add constraint tournaments_group_best_of_check check (group_best_of in (1, 3, 5)),
  add constraint tournaments_knockout_best_of_check check (knockout_best_of in (1, 3, 5));

create table public.tournament_presets (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 60),
  description text check (description is null or char_length(description) <= 240),
  rules jsonb not null check (jsonb_typeof(rules) = 'object'),
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organizer_id, name)
);

create index tournament_presets_owner_favorites_idx
  on public.tournament_presets (organizer_id, is_favorite desc, updated_at desc);

create trigger tournament_presets_set_updated_at before update on public.tournament_presets
for each row execute procedure public.set_updated_at();

alter table public.tournament_presets enable row level security;

create policy "tournament_presets_select_own" on public.tournament_presets
for select to authenticated using (organizer_id = (select auth.uid()) or public.is_admin());
create policy "tournament_presets_insert_own" on public.tournament_presets
for insert to authenticated with check (organizer_id = (select auth.uid()) and public.is_active_user());
create policy "tournament_presets_update_own" on public.tournament_presets
for update to authenticated using (organizer_id = (select auth.uid()) or public.is_admin())
with check (organizer_id = (select auth.uid()) or public.is_admin());
create policy "tournament_presets_delete_own" on public.tournament_presets
for delete to authenticated using (organizer_id = (select auth.uid()) or public.is_admin());

grant select, insert, update, delete on public.tournament_presets to authenticated;

alter table public.tournaments
  add column source_preset_id uuid references public.tournament_presets(id) on delete set null;

create or replace function public.tournament_scores_have_no_ties(first_scores smallint[], second_scores smallint[])
returns boolean language sql immutable set search_path = '' as $$
  select first_scores is null or second_scores is null or (
    cardinality(first_scores) = cardinality(second_scores)
    and not exists (
      select 1 from generate_subscripts(first_scores, 1) position
      where first_scores[position] = second_scores[position]
    )
  );
$$;

alter table public.tournament_games
  add constraint tournament_games_no_tied_sets
  check (public.tournament_scores_have_no_ties(team1_scores, team2_scores)) not valid;

drop trigger if exists tournaments_guard_lock_and_roster on public.tournaments;
create or replace function public.guard_tournament_lock_and_roster()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status in ('completed', 'cancelled', 'archived') and row(
    new.registration_mode, new.format, new.gender, new.min_level, new.max_level,
    new.max_teams, new.guaranteed_matches, new.group_size, new.qualifiers_per_group,
    new.group_best_of, new.group_set_points, new.knockout_best_of, new.knockout_set_points,
    new.tiebreak_points, new.win_by_two, new.third_place, new.standings_win_points,
    new.standings_loss_points, new.minimum_rest_minutes, new.result_confirmation_required
  ) is distinct from row(
    old.registration_mode, old.format, old.gender, old.min_level, old.max_level,
    old.max_teams, old.guaranteed_matches, old.group_size, old.qualifiers_per_group,
    old.group_best_of, old.group_set_points, old.knockout_best_of, old.knockout_set_points,
    old.tiebreak_points, old.win_by_two, old.third_place, old.standings_win_points,
    old.standings_loss_points, old.minimum_rest_minutes, old.result_confirmation_required
  ) then
    raise exception 'Il torneo concluso non puo essere modificato';
  end if;

  if old.status = 'published' and new.status = 'registration_closed' and exists (
    select 1 from public.tournament_teams team
    where team.tournament_id = new.id and team.status = 'confirmed'
      and (select count(*) from public.tournament_team_members member
           where member.team_id = team.id and member.status = 'accepted') <> 2
  ) then
    raise exception 'Ogni coppia confermata deve avere due giocatori';
  end if;
  return new;
end;
$$;

create trigger tournaments_guard_lock_and_roster
before update on public.tournaments
for each row execute procedure public.guard_tournament_lock_and_roster();

create or replace function public.assert_tournament_organizer(p_tournament_id uuid)
returns public.tournaments language plpgsql stable security definer set search_path = '' as $$
declare target public.tournaments;
begin
  select * into target from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Torneo non trovato'; end if;
  if (select auth.uid()) is null or (target.organizer_id <> (select auth.uid()) and not public.is_admin()) then
    raise exception 'Permesso organizzatore richiesto';
  end if;
  if target.status in ('completed', 'cancelled', 'archived') then
    raise exception 'Il torneo concluso non puo essere modificato';
  end if;
  return target;
end;
$$;

create or replace function public.update_tournament_rules(p_tournament_id uuid, p_rules jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
declare requested_format public.tournament_format := coalesce((p_rules->>'format')::public.tournament_format, target.format);
begin
  if jsonb_typeof(p_rules) <> 'object' then raise exception 'Regole non valide'; end if;
  if requested_format = 'knockout' and exists (
    select 1 from public.tournament_games where tournament_id = p_tournament_id and phase = 'group' and status = 'completed'
  ) then raise exception 'Sono gia state giocate partite dei gironi'; end if;
  if requested_format = 'groups' and exists (
    select 1 from public.tournament_games where tournament_id = p_tournament_id and phase <> 'group' and status = 'completed'
  ) then raise exception 'Sono gia state giocate partite della fase finale'; end if;

  update public.tournaments set
    registration_mode = coalesce((p_rules->>'registrationMode')::public.tournament_registration_mode, registration_mode),
    format = requested_format,
    max_teams = coalesce((p_rules->>'maxTeams')::smallint, max_teams),
    guaranteed_matches = coalesce((p_rules->>'guaranteedMatches')::smallint, guaranteed_matches),
    group_size = case when requested_format = 'knockout' then null else coalesce((p_rules->>'groupSize')::smallint, group_size, 4) end,
    qualifiers_per_group = case when requested_format = 'knockout' then null else coalesce((p_rules->>'qualifiersPerGroup')::smallint, qualifiers_per_group, 2) end,
    group_best_of = coalesce((p_rules->>'groupBestOf')::smallint, group_best_of),
    group_set_points = coalesce((p_rules->>'groupSetPoints')::smallint, group_set_points),
    knockout_best_of = coalesce((p_rules->>'knockoutBestOf')::smallint, knockout_best_of),
    knockout_set_points = coalesce((p_rules->>'knockoutSetPoints')::smallint, knockout_set_points),
    tiebreak_points = coalesce((p_rules->>'tiebreakPoints')::smallint, tiebreak_points),
    win_by_two = coalesce((p_rules->>'winByTwo')::boolean, win_by_two),
    third_place = case when requested_format = 'groups' then false else coalesce((p_rules->>'thirdPlace')::boolean, third_place) end,
    standings_win_points = coalesce((p_rules->>'standingsWinPoints')::smallint, standings_win_points),
    standings_loss_points = coalesce((p_rules->>'standingsLossPoints')::smallint, standings_loss_points),
    minimum_rest_minutes = coalesce((p_rules->>'minimumRestMinutes')::smallint, minimum_rest_minutes),
    result_confirmation_required = coalesce((p_rules->>'resultConfirmationRequired')::boolean, result_confirmation_required),
    rules_locked_at = null
  where id = p_tournament_id;
end;
$$;

create or replace function public.upsert_tournament_group(
  p_tournament_id uuid, p_group_id uuid, p_name text, p_position smallint default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare target public.tournaments := public.assert_tournament_organizer(p_tournament_id); created_id uuid; next_position smallint;
begin
  if char_length(trim(p_name)) not between 1 and 40 then raise exception 'Nome girone non valido'; end if;
  if p_group_id is null then
    select (coalesce(max(position), 0) + 1)::smallint into next_position from public.tournament_groups where tournament_id = p_tournament_id;
    insert into public.tournament_groups(tournament_id, name, position)
    values (p_tournament_id, trim(p_name), coalesce(p_position, next_position)) returning id into created_id;
  else
    update public.tournament_groups set name = trim(p_name)
    where id = p_group_id and tournament_id = p_tournament_id returning id into created_id;
    if created_id is null then raise exception 'Girone non trovato'; end if;
  end if;
  return created_id;
end;
$$;

create or replace function public.delete_tournament_group(p_tournament_id uuid, p_group_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
begin
  if exists (select 1 from public.tournament_games where group_id = p_group_id and status in ('completed', 'pending_confirmation', 'walkover')) then
    raise exception 'Il girone contiene partite gia disputate';
  end if;
  delete from public.tournament_groups where id = p_group_id and tournament_id = p_tournament_id;
  if not found then raise exception 'Girone non trovato'; end if;
end;
$$;

create or replace function public.assign_tournament_team_to_group(
  p_tournament_id uuid, p_team_id uuid, p_group_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare target public.tournaments := public.assert_tournament_organizer(p_tournament_id); next_position smallint;
begin
  if not exists (select 1 from public.tournament_teams where id = p_team_id and tournament_id = p_tournament_id and status <> 'withdrawn') then
    raise exception 'Coppia non disponibile';
  end if;
  if p_group_id is not null and not exists (select 1 from public.tournament_groups where id = p_group_id and tournament_id = p_tournament_id) then
    raise exception 'Girone non trovato';
  end if;
  if exists (
    select 1 from public.tournament_games
    where tournament_id = p_tournament_id and phase = 'group' and status in ('completed', 'pending_confirmation', 'walkover')
      and (team1_id = p_team_id or team2_id = p_team_id)
  ) then raise exception 'La coppia ha gia disputato una partita nel girone'; end if;

  delete from public.tournament_group_teams where team_id = p_team_id;
  if p_group_id is not null then
    select (coalesce(max(position), 0) + 1)::smallint into next_position from public.tournament_group_teams where group_id = p_group_id;
    insert into public.tournament_group_teams(group_id, team_id, position) values (p_group_id, p_team_id, next_position);
  end if;
end;
$$;

create or replace function public.save_tournament_game(
  p_tournament_id uuid,
  p_game_id uuid,
  p_phase public.tournament_game_phase,
  p_group_id uuid,
  p_round_no smallint,
  p_position smallint,
  p_team1_id uuid,
  p_team2_id uuid
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
    insert into public.tournament_games(tournament_id, phase, group_id, round_no, position, team1_id, team2_id)
    values (p_tournament_id, p_phase, p_group_id, greatest(1, p_round_no), greatest(1, p_position), p_team1_id, p_team2_id)
    returning id into saved_id;
  else
    update public.tournament_games set phase = p_phase, group_id = p_group_id,
      round_no = greatest(1, p_round_no), position = greatest(1, p_position), team1_id = p_team1_id, team2_id = p_team2_id
    where id = p_game_id and tournament_id = p_tournament_id and status = 'scheduled'
    returning id into saved_id;
    if saved_id is null then raise exception 'La partita non e piu modificabile'; end if;
  end if;
  return saved_id;
end;
$$;

create or replace function public.delete_tournament_game(p_tournament_id uuid, p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
begin
  delete from public.tournament_games where id = p_game_id and tournament_id = p_tournament_id and status = 'scheduled';
  if not found then raise exception 'La partita non e piu eliminabile'; end if;
end;
$$;

create or replace function public.generate_tournament_group_games(p_tournament_id uuid, p_group_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare target public.tournaments := public.assert_tournament_organizer(p_tournament_id); first_team record; second_team record; next_position smallint; added integer := 0;
begin
  if not exists (select 1 from public.tournament_groups where id = p_group_id and tournament_id = p_tournament_id) then raise exception 'Girone non trovato'; end if;
  select (coalesce(max(position), 0) + 1)::smallint into next_position from public.tournament_games
  where tournament_id = p_tournament_id and phase = 'group';
  for first_team in select team_id, position from public.tournament_group_teams where group_id = p_group_id order by position loop
    for second_team in select team_id, position from public.tournament_group_teams where group_id = p_group_id and position > first_team.position order by position loop
      if not exists (
        select 1 from public.tournament_games where group_id = p_group_id
          and ((team1_id = first_team.team_id and team2_id = second_team.team_id) or (team1_id = second_team.team_id and team2_id = first_team.team_id))
      ) then
        insert into public.tournament_games(tournament_id, phase, group_id, round_no, position, team1_id, team2_id)
        values (p_tournament_id, 'group', p_group_id, 1, next_position, first_team.team_id, second_team.team_id);
        next_position := next_position + 1; added := added + 1;
      end if;
    end loop;
  end loop;
  return added;
end;
$$;

create or replace function public.close_tournament_registrations(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target public.tournaments; team_count integer;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then raise exception 'Permesso organizzatore richiesto'; end if;
  if target.status <> 'published' then raise exception 'Il torneo non accetta questa operazione'; end if;
  if exists (select 1 from public.tournament_free_players where tournament_id = p_tournament_id and status = 'active') then
    raise exception 'Abbina o rimuovi tutti i giocatori liberi';
  end if;
  select count(*) into team_count from public.tournament_teams where tournament_id = p_tournament_id and status = 'confirmed';
  if team_count < 2 then raise exception 'Servono almeno due coppie confermate'; end if;
  update public.tournaments set status = 'registration_closed', rules_locked_at = null where id = p_tournament_id;
end;
$$;

revoke all on function public.assert_tournament_organizer(uuid) from public;
revoke all on function public.update_tournament_rules(uuid, jsonb) from public;
revoke all on function public.upsert_tournament_group(uuid, uuid, text, smallint) from public;
revoke all on function public.delete_tournament_group(uuid, uuid) from public;
revoke all on function public.assign_tournament_team_to_group(uuid, uuid, uuid) from public;
revoke all on function public.save_tournament_game(uuid, uuid, public.tournament_game_phase, uuid, smallint, smallint, uuid, uuid) from public;
revoke all on function public.delete_tournament_game(uuid, uuid) from public;
revoke all on function public.generate_tournament_group_games(uuid, uuid) from public;

grant execute on function public.update_tournament_rules(uuid, jsonb) to authenticated;
grant execute on function public.upsert_tournament_group(uuid, uuid, text, smallint) to authenticated;
grant execute on function public.delete_tournament_group(uuid, uuid) to authenticated;
grant execute on function public.assign_tournament_team_to_group(uuid, uuid, uuid) to authenticated;
grant execute on function public.save_tournament_game(uuid, uuid, public.tournament_game_phase, uuid, smallint, smallint, uuid, uuid) to authenticated;
grant execute on function public.delete_tournament_game(uuid, uuid) to authenticated;
grant execute on function public.generate_tournament_group_games(uuid, uuid) to authenticated;

-- Fix enum inference reported by plpgsql_check on the existing remote functions.
create or replace function public.respond_tournament_team_invite(p_team_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target_team public.tournament_teams; target public.tournaments; confirmed_count integer;
begin
  select tt.* into target_team from public.tournament_teams tt where tt.id = p_team_id for update;
  if not found then raise exception 'Coppia non trovata'; end if;
  select * into target from public.tournaments where id = target_team.tournament_id for update;
  if target.status <> 'published' or target.registration_deadline <= now() then raise exception 'Invito non piu modificabile'; end if;
  update public.tournament_team_members
  set status = (case when p_accept then 'accepted' else 'rejected' end)::public.tournament_member_status,
      responded_at = now()
  where team_id = p_team_id and profile_id = actor and status = 'invited';
  if not found then raise exception 'Invito non trovato'; end if;
  if not p_accept then update public.tournament_teams set status = 'withdrawn' where id = p_team_id; return; end if;
  if (select count(*) from public.tournament_team_members where team_id = p_team_id and status = 'accepted') = 2 then
    select count(*) into confirmed_count from public.tournament_teams where tournament_id = target.id and status = 'confirmed';
    update public.tournament_teams
    set status = (case when confirmed_count < target.max_teams then 'confirmed' else 'waitlisted' end)::public.tournament_team_status,
        waitlist_position = case when confirmed_count < target.max_teams then null else
          coalesce((select max(waitlist_position) + 1 from public.tournament_teams where tournament_id = target.id), 1) end
    where id = p_team_id;
  end if;
end;
$$;

create or replace function public.submit_tournament_result(p_game_id uuid, p_team1_scores smallint[], p_team2_scores smallint[])
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); game public.tournament_games; target public.tournaments; wins1 integer := 0; wins2 integer := 0; needed integer; score_index integer; winner uuid; set_target integer; score_gap integer;
begin
  select * into game from public.tournament_games where id = p_game_id for update;
  if not found then raise exception 'Incontro non trovato'; end if;
  select * into target from public.tournaments where id = game.tournament_id for update;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then raise exception 'Permesso organizzatore richiesto'; end if;
  if game.team1_id is null or game.team2_id is null or array_length(p_team1_scores, 1) is distinct from array_length(p_team2_scores, 1) then raise exception 'Risultato incompleto'; end if;
  needed := case when game.phase = 'group' then (target.group_best_of + 1) / 2 else (target.knockout_best_of + 1) / 2 end;
  if coalesce(array_length(p_team1_scores, 1), 0) < needed or array_length(p_team1_scores, 1) > needed * 2 - 1 then raise exception 'Numero di set non valido'; end if;
  for score_index in 1..array_length(p_team1_scores, 1) loop
    if p_team1_scores[score_index] < 0 or p_team2_scores[score_index] < 0 or p_team1_scores[score_index] = p_team2_scores[score_index] then
      raise exception 'Il pareggio non e consentito';
    end if;
    set_target := case when score_index = needed * 2 - 1 and needed > 1 then target.tiebreak_points when game.phase = 'group' then target.group_set_points else target.knockout_set_points end;
    score_gap := abs(p_team1_scores[score_index] - p_team2_scores[score_index]);
    if greatest(p_team1_scores[score_index], p_team2_scores[score_index]) < set_target or (target.win_by_two and score_gap < 2) then raise exception 'Punteggio set non valido'; end if;
    if p_team1_scores[score_index] > p_team2_scores[score_index] then wins1 := wins1 + 1; else wins2 := wins2 + 1; end if;
  end loop;
  if greatest(wins1, wins2) <> needed then raise exception 'L incontro non ha un vincitore valido'; end if;
  winner := case when wins1 > wins2 then game.team1_id else game.team2_id end;
  delete from public.tournament_result_confirmations where game_id = p_game_id;
  update public.tournament_games set team1_scores = p_team1_scores, team2_scores = p_team2_scores,
    winner_team_id = winner,
    status = (case when target.result_confirmation_required then 'pending_confirmation' else 'completed' end)::public.tournament_game_status
  where id = p_game_id;
  update public.tournaments set status = 'in_progress' where id = target.id and status = 'registration_closed';
  if not target.result_confirmation_required then perform public.finalize_tournament_game(p_game_id); end if;
end;
$$;

notify pgrst, 'reload schema';
