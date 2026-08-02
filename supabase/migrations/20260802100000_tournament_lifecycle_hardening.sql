alter table public.tournaments
  add constraint tournaments_third_place_format
  check (format <> 'groups' or not third_place),
  add constraint tournaments_standings_points
  check (standings_loss_points <= standings_win_points);

create or replace function public.guard_tournament_lock_and_roster()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.rules_locked_at is not null and row(
    new.preset, new.registration_mode, new.format, new.gender, new.min_level, new.max_level,
    new.max_teams, new.guaranteed_matches, new.group_size, new.qualifiers_per_group,
    new.group_best_of, new.group_set_points, new.knockout_best_of, new.knockout_set_points,
    new.tiebreak_points, new.win_by_two, new.third_place, new.standings_win_points,
    new.standings_loss_points, new.minimum_rest_minutes, new.result_confirmation_required
  ) is distinct from row(
    old.preset, old.registration_mode, old.format, old.gender, old.min_level, old.max_level,
    old.max_teams, old.guaranteed_matches, old.group_size, old.qualifiers_per_group,
    old.group_best_of, old.group_set_points, old.knockout_best_of, old.knockout_set_points,
    old.tiebreak_points, old.win_by_two, old.third_place, old.standings_win_points,
    old.standings_loss_points, old.minimum_rest_minutes, old.result_confirmation_required
  ) then
    raise exception 'Le regole sportive sono bloccate';
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

create or replace function public.withdraw_from_tournament(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  target public.tournaments;
  affected_team uuid;
  affected_status public.tournament_team_status;
  promoted_team uuid;
  free_changed boolean := false;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if actor is null or target.status <> 'published' or target.registration_deadline <= now() then
    raise exception 'Ritiro non disponibile';
  end if;

  update public.tournament_free_players set status = 'withdrawn', updated_at = now()
  where tournament_id = p_tournament_id and profile_id = actor and status in ('active', 'waitlisted');
  free_changed := found;

  select team.id, team.status into affected_team, affected_status
  from public.tournament_teams team
  join public.tournament_team_members member on member.team_id = team.id
  where team.tournament_id = p_tournament_id and member.profile_id = actor
    and team.status in ('proposed', 'confirmed', 'waitlisted')
  for update of team;

  if affected_team is not null then
    update public.tournament_teams set status = 'withdrawn', waitlist_position = null
    where id = affected_team;

    if affected_status = 'confirmed' then
      select id into promoted_team from public.tournament_teams
      where tournament_id = p_tournament_id and status = 'waitlisted'
      order by waitlist_position nulls last, created_at, id limit 1 for update;
      if promoted_team is not null then
        update public.tournament_teams set status = 'confirmed', waitlist_position = null
        where id = promoted_team;
        with ordered as (
          select id, row_number() over (order by waitlist_position nulls last, created_at, id) position
          from public.tournament_teams where tournament_id = p_tournament_id and status = 'waitlisted'
        )
        update public.tournament_teams team set waitlist_position = ordered.position
        from ordered where team.id = ordered.id;
      end if;
    end if;
  elsif not free_changed then
    raise exception 'Iscrizione non trovata';
  end if;
end;
$$;

create or replace function public.guard_tournament_result_correction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare last_round integer;
begin
  if old.status = 'completed' and row(new.team1_scores, new.team2_scores, new.winner_team_id)
    is distinct from row(old.team1_scores, old.team2_scores, old.winner_team_id) then
    if old.phase = 'group' and exists (
      select 1 from public.tournament_games
      where tournament_id = old.tournament_id and phase = 'knockout'
    ) then raise exception 'La fase finale è già stata generata'; end if;

    if old.next_game_id is not null and exists (
      select 1 from public.tournament_games where id = old.next_game_id and status <> 'scheduled'
    ) then raise exception 'La fase successiva è già iniziata'; end if;

    if old.phase = 'knockout' then
      select max(round_no) into last_round from public.tournament_games
      where tournament_id = old.tournament_id and phase = 'knockout';
      if old.round_no = last_round - 1 and exists (
        select 1 from public.tournament_games
        where tournament_id = old.tournament_id and phase = 'third_place' and status <> 'scheduled'
      ) then raise exception 'La finale per il terzo posto è già iniziata'; end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger tournament_games_guard_result_correction
before update of team1_scores, team2_scores, winner_team_id on public.tournament_games
for each row execute procedure public.guard_tournament_result_correction();

create or replace function public.archive_tournament(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target public.tournaments;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then
    raise exception 'Permesso organizzatore richiesto';
  end if;
  if target.status not in ('completed', 'cancelled') then
    raise exception 'Puoi archiviare soltanto un torneo concluso o annullato';
  end if;
  update public.tournaments set status = 'archived' where id = p_tournament_id;
end;
$$;

revoke all on function public.guard_tournament_lock_and_roster() from public;
revoke all on function public.guard_tournament_result_correction() from public;
revoke all on function public.archive_tournament(uuid) from public;
grant execute on function public.archive_tournament(uuid) to authenticated;

notify pgrst, 'reload schema';
