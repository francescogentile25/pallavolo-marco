create table public.tournament_result_confirmations (
  game_id uuid not null references public.tournament_games(id) on delete cascade,
  team_id uuid not null references public.tournament_teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  primary key (game_id, team_id),
  unique (game_id, profile_id)
);

alter table public.tournament_result_confirmations enable row level security;
create policy "tournament_result_confirmations_select_visible" on public.tournament_result_confirmations
for select to authenticated using (
  exists (
    select 1 from public.tournament_games g
    join public.tournaments t on t.id = g.tournament_id
    where g.id = game_id
  )
);
grant select on public.tournament_result_confirmations to authenticated;

create or replace function public.finalize_tournament_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare game public.tournament_games; target public.tournaments; loser uuid; last_round integer; third_game uuid;
begin
  select * into game from public.tournament_games where id = p_game_id for update;
  select * into target from public.tournaments where id = game.tournament_id;
  if game.winner_team_id is null then raise exception 'Il risultato non ha un vincitore'; end if;
  update public.tournament_games set status = 'completed' where id = p_game_id;
  if game.phase = 'knockout' and target.third_place then
    select max(round_no) into last_round from public.tournament_games where tournament_id = game.tournament_id and phase = 'knockout';
    if game.round_no = last_round - 1 then
      loser := case when game.winner_team_id = game.team1_id then game.team2_id else game.team1_id end;
      select id into third_game from public.tournament_games where tournament_id = game.tournament_id and phase = 'third_place';
      if game.position % 2 = 1 then update public.tournament_games set team1_id = loser where id = third_game;
      else update public.tournament_games set team2_id = loser where id = third_game; end if;
    end if;
  end if;
  if game.next_game_id is not null then
    if game.position % 2 = 1 then update public.tournament_games set team1_id = game.winner_team_id where id = game.next_game_id;
    else update public.tournament_games set team2_id = game.winner_team_id where id = game.next_game_id; end if;
  elsif game.phase <> 'group' and not exists (
    select 1 from public.tournament_games pending
    where pending.tournament_id = game.tournament_id and pending.phase = 'third_place'
      and pending.status not in ('completed', 'walkover', 'cancelled') and pending.id <> game.id
  ) then
    update public.tournaments set status = 'completed' where id = game.tournament_id;
  end if;
end;
$$;

create or replace function public.submit_tournament_result(p_game_id uuid, p_team1_scores smallint[], p_team2_scores smallint[])
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); game public.tournament_games; target public.tournaments; wins1 integer := 0; wins2 integer := 0; needed integer; i integer; winner uuid; set_target integer; score_gap integer;
begin
  select * into game from public.tournament_games where id = p_game_id for update;
  if not found then raise exception 'Incontro non trovato'; end if;
  select * into target from public.tournaments where id = game.tournament_id for update;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then raise exception 'Permesso organizzatore richiesto'; end if;
  if game.team1_id is null or game.team2_id is null or array_length(p_team1_scores, 1) is distinct from array_length(p_team2_scores, 1) then raise exception 'Risultato incompleto'; end if;
  needed := case when game.phase = 'group' then (target.group_best_of + 1) / 2 else (target.knockout_best_of + 1) / 2 end;
  if coalesce(array_length(p_team1_scores, 1), 0) < needed or array_length(p_team1_scores, 1) > needed * 2 - 1 then raise exception 'Numero di set non valido'; end if;
  for i in 1..array_length(p_team1_scores, 1) loop
    if p_team1_scores[i] < 0 or p_team2_scores[i] < 0 or p_team1_scores[i] = p_team2_scores[i] then raise exception 'Punteggio set non valido'; end if;
    set_target := case
      when i = needed * 2 - 1 and needed > 1 then target.tiebreak_points
      when game.phase = 'group' then target.group_set_points
      else target.knockout_set_points
    end;
    score_gap := abs(p_team1_scores[i] - p_team2_scores[i]);
    if greatest(p_team1_scores[i], p_team2_scores[i]) < set_target
      or (target.win_by_two and score_gap < 2) then raise exception 'Punteggio set non valido'; end if;
    if p_team1_scores[i] > p_team2_scores[i] then wins1 := wins1 + 1; else wins2 := wins2 + 1; end if;
  end loop;
  if greatest(wins1, wins2) <> needed then raise exception 'L’incontro non ha un vincitore valido'; end if;
  winner := case when wins1 > wins2 then game.team1_id else game.team2_id end;
  delete from public.tournament_result_confirmations where game_id = p_game_id;
  update public.tournament_games set team1_scores = p_team1_scores, team2_scores = p_team2_scores,
    winner_team_id = winner, status = case when target.result_confirmation_required then 'pending_confirmation' else 'completed' end
    where id = p_game_id;
  update public.tournaments set status = 'in_progress' where id = target.id and status = 'registration_closed';
  if not target.result_confirmation_required then perform public.finalize_tournament_game(p_game_id); end if;
end;
$$;

create or replace function public.confirm_tournament_result(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); game public.tournament_games; actor_team uuid;
begin
  select * into game from public.tournament_games where id = p_game_id for update;
  if actor is null or not public.is_active_user() or game.status <> 'pending_confirmation' then raise exception 'Risultato non confermabile'; end if;
  select tt.id into actor_team from public.tournament_teams tt
  join public.tournament_team_members tm on tm.team_id = tt.id
  where tt.id in (game.team1_id, game.team2_id) and tm.profile_id = actor and tm.status = 'accepted';
  if actor_team is null then raise exception 'Solo i giocatori dell’incontro possono confermare'; end if;
  insert into public.tournament_result_confirmations (game_id, team_id, profile_id)
  values (p_game_id, actor_team, actor)
  on conflict (game_id, team_id) do update set profile_id = excluded.profile_id, confirmed_at = now();
  if (select count(*) from public.tournament_result_confirmations where game_id = p_game_id) = 2 then
    perform public.finalize_tournament_game(p_game_id);
  end if;
end;
$$;

revoke all on function public.finalize_tournament_game(uuid) from public;
revoke all on function public.confirm_tournament_result(uuid) from public;
grant execute on function public.confirm_tournament_result(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.tournament_result_confirmations;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
