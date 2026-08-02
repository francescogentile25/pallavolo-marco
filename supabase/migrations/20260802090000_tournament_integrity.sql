create policy "profiles_select_tournament_participants" on public.profiles
for select to authenticated using (
  public.is_active_user() and (
    exists (
      select 1 from public.tournament_team_members tm
      join public.tournament_teams tt on tt.id = tm.team_id
      join public.tournaments t on t.id = tt.tournament_id
      where tm.profile_id = profiles.id and tt.status in ('proposed', 'confirmed', 'waitlisted')
        and t.status <> 'draft'
    )
    or exists (
      select 1 from public.tournament_free_players fp
      join public.tournaments t on t.id = fp.tournament_id
      where fp.profile_id = profiles.id and fp.status in ('active', 'waitlisted') and t.status <> 'draft'
    )
  )
);

create or replace function public.prevent_duplicate_tournament_team_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_tournament uuid;
begin
  select tournament_id into target_tournament from public.tournament_teams where id = new.team_id;
  perform pg_advisory_xact_lock(hashtextextended(target_tournament::text || new.profile_id::text, 0));
  if exists (
    select 1 from public.tournament_free_players fp
    where fp.tournament_id = target_tournament and fp.profile_id = new.profile_id and fp.status in ('active', 'waitlisted')
  ) or exists (
    select 1 from public.tournament_team_members tm join public.tournament_teams tt on tt.id = tm.team_id
    where tt.tournament_id = target_tournament and tm.profile_id = new.profile_id
      and tm.status <> 'rejected' and tt.status in ('proposed', 'confirmed', 'waitlisted') and tt.id <> new.team_id
  ) then raise exception 'Il giocatore è già coinvolto nel torneo'; end if;
  return new;
end;
$$;

create or replace function public.prevent_duplicate_tournament_free_player()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'withdrawn' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.tournament_id::text || new.profile_id::text, 0));
  if exists (
    select 1 from public.tournament_team_members tm join public.tournament_teams tt on tt.id = tm.team_id
    where tt.tournament_id = new.tournament_id and tm.profile_id = new.profile_id
      and tm.status <> 'rejected' and tt.status in ('proposed', 'confirmed', 'waitlisted')
  ) then raise exception 'Il giocatore è già coinvolto nel torneo'; end if;
  return new;
end;
$$;

create trigger tournament_team_members_no_duplicates before insert on public.tournament_team_members
for each row execute function public.prevent_duplicate_tournament_team_member();
create trigger tournament_free_players_no_duplicates before insert or update of status on public.tournament_free_players
for each row execute function public.prevent_duplicate_tournament_free_player();

create or replace function public.join_tournament_as_free_player(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target public.tournaments; actor_level smallint;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if actor is null or not public.is_active_user() then raise exception 'Profilo attivo richiesto'; end if;
  if not found or target.status <> 'published' or target.registration_deadline <= now() then raise exception 'Iscrizioni non disponibili'; end if;
  if target.registration_mode = 'pairs' then raise exception 'Questo torneo accetta soltanto coppie'; end if;
  select livello into actor_level from public.profiles where id = actor and attivo;
  if actor_level not between target.min_level and target.max_level then raise exception 'Livello non ammesso'; end if;
  if exists (
    select 1 from public.tournament_team_members tm join public.tournament_teams tt on tt.id = tm.team_id
    where tt.tournament_id = p_tournament_id and tm.profile_id = actor and tm.status <> 'rejected'
      and tt.status in ('proposed', 'confirmed', 'waitlisted')
  ) then raise exception 'Sei già iscritto o invitato'; end if;
  insert into public.tournament_free_players (tournament_id, profile_id, status)
  values (p_tournament_id, actor, 'active')
  on conflict (tournament_id, profile_id) do update set status = 'active', updated_at = now();
end;
$$;

create or replace function public.organizer_pair_free_players(p_tournament_id uuid, p_player1 uuid, p_player2 uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target public.tournaments; created_id uuid;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then raise exception 'Permesso organizzatore richiesto'; end if;
  if target.status <> 'published' or p_player1 = p_player2 then raise exception 'Abbinamento non valido'; end if;
  if not exists (select 1 from public.tournament_free_players where tournament_id = p_tournament_id and profile_id = p_player1 and status = 'active')
    or not exists (select 1 from public.tournament_free_players where tournament_id = p_tournament_id and profile_id = p_player2 and status = 'active') then raise exception 'Seleziona due giocatori liberi'; end if;
  update public.tournament_free_players set status = 'withdrawn' where tournament_id = p_tournament_id and profile_id in (p_player1, p_player2);
  insert into public.tournament_teams (tournament_id, created_by) values (p_tournament_id, actor) returning id into created_id;
  insert into public.tournament_team_members (team_id, profile_id, status, invited_by) values
    (created_id, p_player1, 'invited', actor), (created_id, p_player2, 'invited', actor);
  return created_id;
end;
$$;

create or replace function public.reschedule_tournament_game(p_game_id uuid, p_scheduled_at timestamptz, p_court_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); game public.tournament_games; target public.tournaments;
begin
  select * into game from public.tournament_games where id = p_game_id for update;
  select * into target from public.tournaments where id = game.tournament_id;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then raise exception 'Permesso organizzatore richiesto'; end if;
  if game.status not in ('scheduled', 'pending_confirmation') or p_scheduled_at not between target.starts_at and target.ends_at then raise exception 'Nuovo orario non valido'; end if;
  if not exists (select 1 from public.tournament_courts where tournament_id = target.id and court_id = p_court_id) then raise exception 'Campo non disponibile per il torneo'; end if;
  if exists (select 1 from public.tournament_games other where other.id <> p_game_id and other.court_id = p_court_id and other.scheduled_at = p_scheduled_at and other.status not in ('cancelled')) then raise exception 'Il campo è già occupato in questo orario'; end if;
  update public.tournament_games set scheduled_at = p_scheduled_at, court_id = p_court_id where id = p_game_id;
end;
$$;

revoke all on function public.prevent_duplicate_tournament_team_member() from public;
revoke all on function public.prevent_duplicate_tournament_free_player() from public;
revoke all on function public.reschedule_tournament_game(uuid, timestamptz, uuid) from public;
grant execute on function public.reschedule_tournament_game(uuid, timestamptz, uuid) to authenticated;

notify pgrst, 'reload schema';
