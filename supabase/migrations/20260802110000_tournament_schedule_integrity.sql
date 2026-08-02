create or replace function public.assign_tournament_game_slot()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target public.tournaments;
  candidate timestamptz;
  available_court uuid;
  game_minutes integer := case when new.phase = 'group' then 30 else 50 end;
begin
  if new.scheduled_at is null then return new; end if;
  select * into target from public.tournaments where id = new.tournament_id;
  candidate := greatest(new.scheduled_at, target.starts_at);

  while candidate + make_interval(mins => game_minutes) <= target.ends_at loop
    for available_court in
      select link.court_id from public.tournament_courts link
      where link.tournament_id = new.tournament_id
      order by case when link.court_id = new.court_id then 0 else 1 end, link.court_id
    loop
      if not exists (
        select 1 from public.tournament_games game
        where game.tournament_id = new.tournament_id and game.court_id = available_court
          and game.status not in ('cancelled', 'walkover') and game.scheduled_at is not null
          and candidate < game.scheduled_at + make_interval(mins => case when game.phase = 'group' then 30 else 50 end)
          and game.scheduled_at < candidate + make_interval(mins => game_minutes)
      ) and not exists (
        select 1 from public.tournament_games game
        where game.tournament_id = new.tournament_id and game.scheduled_at is not null
          and game.status not in ('cancelled', 'walkover')
          and (new.team1_id in (game.team1_id, game.team2_id) or new.team2_id in (game.team1_id, game.team2_id))
          and candidate < game.scheduled_at + make_interval(mins => (case when game.phase = 'group' then 30 else 50 end) + target.minimum_rest_minutes)
          and game.scheduled_at < candidate + make_interval(mins => game_minutes + target.minimum_rest_minutes)
      ) then
        new.court_id := available_court;
        new.scheduled_at := candidate;
        return new;
      end if;
    end loop;
    candidate := candidate + interval '5 minutes';
  end loop;
  raise exception 'Il calendario non entra nella finestra del torneo';
end;
$$;

create trigger tournament_games_assign_slot
before insert on public.tournament_games
for each row when (new.scheduled_at is not null)
execute procedure public.assign_tournament_game_slot();

create or replace function public.reschedule_tournament_game(
  p_game_id uuid,
  p_scheduled_at timestamptz,
  p_court_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  game public.tournament_games;
  target public.tournaments;
  game_minutes integer;
begin
  select * into game from public.tournament_games where id = p_game_id for update;
  if not found then raise exception 'Incontro non trovato'; end if;
  select * into target from public.tournaments where id = game.tournament_id;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then
    raise exception 'Permesso organizzatore richiesto';
  end if;
  game_minutes := case when game.phase = 'group' then 30 else 50 end;
  if p_scheduled_at < target.starts_at
    or p_scheduled_at + make_interval(mins => game_minutes) > target.ends_at then
    raise exception 'Orario fuori dalla durata del torneo';
  end if;
  if not exists (
    select 1 from public.tournament_courts
    where tournament_id = target.id and court_id = p_court_id
  ) then raise exception 'Campo non associato al torneo'; end if;
  if exists (
    select 1 from public.tournament_games other
    where other.tournament_id = target.id and other.id <> game.id
      and other.court_id = p_court_id and other.scheduled_at is not null
      and other.status not in ('cancelled', 'walkover')
      and p_scheduled_at < other.scheduled_at + make_interval(mins => case when other.phase = 'group' then 30 else 50 end)
      and other.scheduled_at < p_scheduled_at + make_interval(mins => game_minutes)
  ) then raise exception 'Campo già occupato in questa fascia oraria'; end if;
  if exists (
    select 1 from public.tournament_games other
    where other.tournament_id = target.id and other.id <> game.id and other.scheduled_at is not null
      and other.status not in ('cancelled', 'walkover')
      and (game.team1_id in (other.team1_id, other.team2_id) or game.team2_id in (other.team1_id, other.team2_id))
      and p_scheduled_at < other.scheduled_at + make_interval(mins => (case when other.phase = 'group' then 30 else 50 end) + target.minimum_rest_minutes)
      and other.scheduled_at < p_scheduled_at + make_interval(mins => game_minutes + target.minimum_rest_minutes)
  ) then raise exception 'Una coppia non rispetterebbe il riposo minimo'; end if;
  update public.tournament_games set scheduled_at = p_scheduled_at, court_id = p_court_id
  where id = p_game_id;
end;
$$;

revoke all on function public.assign_tournament_game_slot() from public;
notify pgrst, 'reload schema';
