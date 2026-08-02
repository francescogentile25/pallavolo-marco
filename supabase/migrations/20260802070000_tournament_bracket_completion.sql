create or replace function public.organizer_invite_tournament_team(
  p_tournament_id uuid,
  p_player1 uuid,
  p_player2 uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target public.tournaments; created_id uuid; eligible_count integer;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then raise exception 'Permesso organizzatore richiesto'; end if;
  if target.status <> 'published' or target.registration_deadline <= now() or p_player1 is null or p_player2 is null or p_player1 = p_player2 then raise exception 'Invito non valido'; end if;
  select count(*) into eligible_count from public.profiles where id in (p_player1, p_player2) and attivo and livello between target.min_level and target.max_level;
  if eligible_count <> 2 then raise exception 'Uno dei giocatori non è idoneo'; end if;
  if public.tournament_profile_is_registered(p_tournament_id, p_player1) or public.tournament_profile_is_registered(p_tournament_id, p_player2) then raise exception 'Uno dei giocatori è già coinvolto nel torneo'; end if;
  insert into public.tournament_teams (tournament_id, created_by) values (p_tournament_id, actor) returning id into created_id;
  insert into public.tournament_team_members (team_id, profile_id, status, invited_by) values
    (created_id, p_player1, 'invited', actor), (created_id, p_player2, 'invited', actor);
  return created_id;
end;
$$;

create or replace function public.build_tournament_knockout(p_tournament_id uuid, p_team_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare target public.tournaments; team_count integer := cardinality(p_team_ids); bracket_size integer := 2; total_rounds integer := 1; round_index integer; game_position integer; next_id uuid; current_id uuid; first_team uuid; second_team uuid; winner uuid; court_ids uuid[]; court_count integer;
begin
  select * into target from public.tournaments where id = p_tournament_id;
  if not found or team_count < 2 then raise exception 'Coppie insufficienti per il tabellone'; end if;
  while bracket_size < team_count loop bracket_size := bracket_size * 2; total_rounds := total_rounds + 1; end loop;
  delete from public.tournament_games where tournament_id = p_tournament_id and phase in ('knockout', 'third_place');
  select array_agg(court_id order by court_id) into court_ids from public.tournament_courts where tournament_id = p_tournament_id;
  court_count := cardinality(court_ids);

  for round_index in reverse total_rounds..1 loop
    for game_position in 1..(bracket_size / power(2, round_index)::integer) loop
      next_id := null;
      if round_index < total_rounds then
        select id into next_id from public.tournament_games where tournament_id = p_tournament_id and phase = 'knockout'
          and round_no = round_index + 1 and position = ceil(game_position / 2.0)::integer;
      end if;
      insert into public.tournament_games (tournament_id, phase, round_no, position, court_id, scheduled_at, next_game_id)
      values (p_tournament_id, 'knockout', round_index, game_position,
        court_ids[((game_position - 1) % court_count) + 1],
        target.starts_at + make_interval(mins => (round_index - 1) * (50 + target.minimum_rest_minutes)), next_id);
    end loop;
  end loop;

  for game_position in 1..(bracket_size / 2) loop
    first_team := case when game_position <= team_count then p_team_ids[game_position] else null end;
    second_team := case when bracket_size - game_position + 1 <= team_count then p_team_ids[bracket_size - game_position + 1] else null end;
    update public.tournament_games set team1_id = first_team, team2_id = second_team
      where tournament_id = p_tournament_id and phase = 'knockout' and round_no = 1 and position = game_position
      returning id, next_game_id into current_id, next_id;
    if (first_team is null) <> (second_team is null) then
      winner := coalesce(first_team, second_team);
      update public.tournament_games set winner_team_id = winner, status = 'walkover' where id = current_id;
      if next_id is not null then
        if game_position % 2 = 1 then update public.tournament_games set team1_id = winner where id = next_id;
        else update public.tournament_games set team2_id = winner where id = next_id; end if;
      end if;
    end if;
  end loop;
  if target.third_place and total_rounds >= 2 then
    insert into public.tournament_games (tournament_id, phase, round_no, position, court_id, scheduled_at)
    values (p_tournament_id, 'third_place', total_rounds, 1, court_ids[1],
      target.starts_at + make_interval(mins => (total_rounds - 1) * (50 + target.minimum_rest_minutes)));
  end if;
end;
$$;

create or replace function public.close_tournament_registrations(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target public.tournaments; team_count integer; group_count integer; g integer; team_record record; group_ids uuid[] := array[]::uuid[]; assigned_group uuid; game_pos integer := 0; court_ids uuid[]; court_count integer; ranked_ids uuid[];
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then raise exception 'Permesso organizzatore richiesto'; end if;
  if target.status <> 'published' then raise exception 'Il torneo non accetta questa operazione'; end if;
  if exists (select 1 from public.tournament_free_players where tournament_id = p_tournament_id and status = 'active') then raise exception 'Abbina o rimuovi tutti i giocatori liberi'; end if;
  select count(*), array_agg(id order by coalesce(seed, 32767), created_at, id) into team_count, ranked_ids
    from public.tournament_teams where tournament_id = p_tournament_id and status = 'confirmed';
  if team_count < 4 then raise exception 'Servono almeno quattro coppie confermate'; end if;
  update public.tournaments set status = 'registration_closed', rules_locked_at = now() where id = p_tournament_id;
  select array_agg(court_id order by court_id) into court_ids from public.tournament_courts where tournament_id = p_tournament_id;
  court_count := cardinality(court_ids);
  if target.format in ('groups', 'mixed') then
    group_count := ceil(team_count::numeric / target.group_size)::integer;
    for g in 1..group_count loop insert into public.tournament_groups (tournament_id, name, position) values (p_tournament_id, 'Girone ' || chr(64 + g), g) returning id into assigned_group; group_ids := array_append(group_ids, assigned_group); end loop;
    for team_record in select id, row_number() over (order by coalesce(seed, 32767), created_at, id) rn from public.tournament_teams where tournament_id = p_tournament_id and status = 'confirmed' loop
      g := ((team_record.rn - 1) % group_count) + 1;
      insert into public.tournament_group_teams (group_id, team_id, position) values (group_ids[g], team_record.id, 1 + (select count(*) from public.tournament_group_teams where group_id = group_ids[g]));
    end loop;
    for assigned_group in select id from public.tournament_groups where tournament_id = p_tournament_id order by position loop
      for team_record in select a.team_id team1_id, b.team_id team2_id from public.tournament_group_teams a join public.tournament_group_teams b on b.group_id = a.group_id and b.position > a.position where a.group_id = assigned_group order by a.position, b.position loop
        game_pos := game_pos + 1;
        insert into public.tournament_games (tournament_id, phase, group_id, round_no, position, team1_id, team2_id, court_id, scheduled_at)
        values (p_tournament_id, 'group', assigned_group, 1, game_pos, team_record.team1_id, team_record.team2_id, court_ids[((game_pos - 1) % court_count) + 1], target.starts_at + make_interval(mins => ((game_pos - 1) / court_count) * (30 + target.minimum_rest_minutes)));
      end loop;
    end loop;
  else
    perform public.build_tournament_knockout(p_tournament_id, ranked_ids);
  end if;
end;
$$;

create or replace function public.advance_tournament_group_stage(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target public.tournaments; target_group record; ranked uuid[] := array[]::uuid[]; group_ranked uuid[];
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then raise exception 'Permesso organizzatore richiesto'; end if;
  if target.format <> 'mixed' or target.status not in ('registration_closed', 'in_progress') then raise exception 'La fase finale non è disponibile'; end if;
  if exists (select 1 from public.tournament_games where tournament_id = p_tournament_id and phase = 'group' and status <> 'completed') then raise exception 'Completa tutti gli incontri dei gironi'; end if;
  if exists (select 1 from public.tournament_games where tournament_id = p_tournament_id and phase = 'knockout') then raise exception 'Il tabellone è già stato generato'; end if;
  for target_group in select id from public.tournament_groups where tournament_id = p_tournament_id order by position loop
    select array_agg(team_id order by wins desc, set_difference desc, point_difference desc, team_id) into group_ranked from (
      select gt.team_id,
        count(g.id) filter (where g.winner_team_id = gt.team_id) wins,
        coalesce(sum(case when g.team1_id = gt.team_id then
          (select count(*) from generate_subscripts(g.team1_scores, 1) i where g.team1_scores[i] > g.team2_scores[i]) - (select count(*) from generate_subscripts(g.team1_scores, 1) i where g.team1_scores[i] < g.team2_scores[i])
          when g.team2_id = gt.team_id then (select count(*) from generate_subscripts(g.team2_scores, 1) i where g.team2_scores[i] > g.team1_scores[i]) - (select count(*) from generate_subscripts(g.team2_scores, 1) i where g.team2_scores[i] < g.team1_scores[i]) else 0 end), 0) set_difference,
        coalesce(sum(case when g.team1_id = gt.team_id then (select sum(x) from unnest(g.team1_scores) x) - (select sum(x) from unnest(g.team2_scores) x)
          when g.team2_id = gt.team_id then (select sum(x) from unnest(g.team2_scores) x) - (select sum(x) from unnest(g.team1_scores) x) else 0 end), 0) point_difference
      from public.tournament_group_teams gt left join public.tournament_games g on g.group_id = gt.group_id and g.status = 'completed'
      where gt.group_id = target_group.id group by gt.team_id
    ) ranking;
    ranked := ranked || group_ranked[1:target.qualifiers_per_group];
  end loop;
  perform public.build_tournament_knockout(p_tournament_id, ranked);
end;
$$;

create or replace function public.submit_tournament_result(p_game_id uuid, p_team1_scores smallint[], p_team2_scores smallint[])
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); game public.tournament_games; target public.tournaments; wins1 integer := 0; wins2 integer := 0; needed integer; i integer; winner uuid;
begin
  select * into game from public.tournament_games where id = p_game_id for update;
  if not found then raise exception 'Incontro non trovato'; end if;
  select * into target from public.tournaments where id = game.tournament_id for update;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then raise exception 'Permesso organizzatore richiesto'; end if;
  if game.team1_id is null or game.team2_id is null or array_length(p_team1_scores, 1) is distinct from array_length(p_team2_scores, 1) then raise exception 'Risultato incompleto'; end if;
  needed := case when game.phase = 'group' then (target.group_best_of + 1) / 2 else (target.knockout_best_of + 1) / 2 end;
  if coalesce(array_length(p_team1_scores, 1), 0) < needed or array_length(p_team1_scores, 1) > needed * 2 - 1 then raise exception 'Numero di set non valido'; end if;
  for i in 1..array_length(p_team1_scores, 1) loop if p_team1_scores[i] < 0 or p_team2_scores[i] < 0 or p_team1_scores[i] = p_team2_scores[i] then raise exception 'Punteggio set non valido'; end if; if p_team1_scores[i] > p_team2_scores[i] then wins1 := wins1 + 1; else wins2 := wins2 + 1; end if; end loop;
  if greatest(wins1, wins2) <> needed then raise exception 'L’incontro non ha un vincitore valido'; end if;
  winner := case when wins1 > wins2 then game.team1_id else game.team2_id end;
  update public.tournament_games set team1_scores = p_team1_scores, team2_scores = p_team2_scores, winner_team_id = winner, status = 'completed' where id = p_game_id;
  if game.next_game_id is not null then if game.position % 2 = 1 then update public.tournament_games set team1_id = winner where id = game.next_game_id; else update public.tournament_games set team2_id = winner where id = game.next_game_id; end if; end if;
  update public.tournaments set status = 'in_progress' where id = target.id and status = 'registration_closed';
  if game.phase <> 'group' and game.next_game_id is null then update public.tournaments set status = 'completed' where id = target.id; end if;
end;
$$;

revoke all on function public.organizer_invite_tournament_team(uuid, uuid, uuid) from public;
revoke all on function public.build_tournament_knockout(uuid, uuid[]) from public;
revoke all on function public.advance_tournament_group_stage(uuid) from public;
grant execute on function public.organizer_invite_tournament_team(uuid, uuid, uuid), public.advance_tournament_group_stage(uuid) to authenticated;

notify pgrst, 'reload schema';
