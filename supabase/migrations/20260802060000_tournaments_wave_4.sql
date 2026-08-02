create type public.tournament_status as enum (
  'draft', 'published', 'registration_closed', 'in_progress', 'completed', 'cancelled', 'archived'
);
create type public.tournament_preset as enum ('quick', 'classic', 'knockout', 'custom');
create type public.tournament_registration_mode as enum ('pairs', 'individual', 'hybrid');
create type public.tournament_format as enum ('groups', 'knockout', 'mixed');
create type public.tournament_team_status as enum ('proposed', 'confirmed', 'waitlisted', 'withdrawn');
create type public.tournament_member_status as enum ('invited', 'accepted', 'rejected');
create type public.tournament_free_player_status as enum ('active', 'waitlisted', 'withdrawn');
create type public.tournament_game_phase as enum ('group', 'knockout', 'third_place');
create type public.tournament_game_status as enum ('scheduled', 'pending_confirmation', 'completed', 'walkover', 'cancelled');

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete restrict,
  venue_id uuid not null references public.venues(id) on delete restrict,
  status public.tournament_status not null default 'draft',
  preset public.tournament_preset not null default 'classic',
  title text not null check (char_length(trim(title)) between 3 and 120),
  description text check (description is null or char_length(description) <= 2000),
  registration_mode public.tournament_registration_mode not null,
  format public.tournament_format not null,
  gender public.match_gender not null default 'mixed',
  min_level smallint not null check (min_level between 1 and 7),
  max_level smallint not null check (max_level between 1 and 7),
  max_teams smallint not null check (max_teams between 4 and 32),
  registration_deadline timestamptz not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  cost_cents integer not null default 0 check (cost_cents between 0 and 100000),
  guaranteed_matches smallint not null default 1 check (guaranteed_matches between 1 and 20),
  group_size smallint check (group_size is null or group_size between 3 and 6),
  qualifiers_per_group smallint check (qualifiers_per_group is null or qualifiers_per_group between 1 and 4),
  group_best_of smallint not null default 1 check (group_best_of in (1, 3)),
  group_set_points smallint not null default 21 check (group_set_points between 11 and 25),
  knockout_best_of smallint not null default 3 check (knockout_best_of in (1, 3)),
  knockout_set_points smallint not null default 21 check (knockout_set_points between 11 and 25),
  tiebreak_points smallint not null default 15 check (tiebreak_points between 7 and 21),
  win_by_two boolean not null default true,
  third_place boolean not null default false,
  standings_win_points smallint not null default 2 check (standings_win_points between 1 and 5),
  standings_loss_points smallint not null default 0 check (standings_loss_points between 0 and 2),
  minimum_rest_minutes smallint not null default 20 check (minimum_rest_minutes between 0 and 120),
  result_confirmation_required boolean not null default false,
  published_at timestamptz,
  rules_locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournaments_level_range check (min_level <= max_level),
  constraint tournaments_timeline check (
    registration_deadline < starts_at and starts_at < ends_at
  ),
  constraint tournaments_group_rules check (
    (format = 'knockout' and group_size is null and qualifiers_per_group is null)
    or
    (format in ('groups', 'mixed') and group_size is not null and qualifiers_per_group is not null
      and qualifiers_per_group < group_size)
  )
);

create table public.tournament_courts (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete restrict,
  primary key (tournament_id, court_id)
);

create table public.tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  status public.tournament_team_status not null default 'proposed',
  seed smallint,
  waitlist_position integer,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, seed)
);

create table public.tournament_team_members (
  team_id uuid not null references public.tournament_teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  status public.tournament_member_status not null default 'invited',
  invited_by uuid not null references public.profiles(id) on delete restrict,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (team_id, profile_id)
);

create table public.tournament_free_players (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  status public.tournament_free_player_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tournament_id, profile_id)
);

create table public.tournament_groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  position smallint not null,
  unique (tournament_id, position)
);

create table public.tournament_group_teams (
  group_id uuid not null references public.tournament_groups(id) on delete cascade,
  team_id uuid not null references public.tournament_teams(id) on delete cascade,
  position smallint not null,
  primary key (group_id, team_id),
  unique (group_id, position),
  unique (team_id)
);

create table public.tournament_games (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  phase public.tournament_game_phase not null,
  group_id uuid references public.tournament_groups(id) on delete cascade,
  round_no smallint not null default 1 check (round_no > 0),
  position smallint not null check (position > 0),
  team1_id uuid references public.tournament_teams(id) on delete restrict,
  team2_id uuid references public.tournament_teams(id) on delete restrict,
  court_id uuid references public.courts(id) on delete restrict,
  scheduled_at timestamptz,
  status public.tournament_game_status not null default 'scheduled',
  team1_scores smallint[],
  team2_scores smallint[],
  winner_team_id uuid references public.tournament_teams(id) on delete restrict,
  next_game_id uuid references public.tournament_games(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_games_distinct_teams check (team1_id is null or team2_id is null or team1_id <> team2_id),
  constraint tournament_games_phase_group check (
    (phase = 'group' and group_id is not null) or (phase <> 'group' and group_id is null)
  ),
  unique (tournament_id, phase, round_no, position)
);

create index tournaments_discovery_idx on public.tournaments (status, starts_at);
create index tournaments_organizer_idx on public.tournaments (organizer_id, starts_at desc);
create index tournament_teams_tournament_status_idx on public.tournament_teams (tournament_id, status);
create index tournament_members_profile_idx on public.tournament_team_members (profile_id, status);
create index tournament_games_schedule_idx on public.tournament_games (tournament_id, scheduled_at, phase, round_no);

create trigger tournaments_set_updated_at before update on public.tournaments
for each row execute procedure public.set_updated_at();
create trigger tournament_teams_set_updated_at before update on public.tournament_teams
for each row execute procedure public.set_updated_at();
create trigger tournament_free_players_set_updated_at before update on public.tournament_free_players
for each row execute procedure public.set_updated_at();
create trigger tournament_games_set_updated_at before update on public.tournament_games
for each row execute procedure public.set_updated_at();

alter table public.tournaments enable row level security;
alter table public.tournament_courts enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.tournament_team_members enable row level security;
alter table public.tournament_free_players enable row level security;
alter table public.tournament_groups enable row level security;
alter table public.tournament_group_teams enable row level security;
alter table public.tournament_games enable row level security;

create policy "tournaments_select_visible" on public.tournaments for select to authenticated using (
  public.is_active_user() and (status <> 'draft' or organizer_id = (select auth.uid()) or public.is_admin())
);
create policy "tournament_courts_select_visible" on public.tournament_courts for select to authenticated using (
  exists (select 1 from public.tournaments t where t.id = tournament_id)
);
create policy "tournament_teams_select_visible" on public.tournament_teams for select to authenticated using (
  exists (select 1 from public.tournaments t where t.id = tournament_id)
);
create policy "tournament_members_select_visible" on public.tournament_team_members for select to authenticated using (
  exists (select 1 from public.tournament_teams tt join public.tournaments t on t.id = tt.tournament_id where tt.id = team_id)
);
create policy "tournament_free_players_select_visible" on public.tournament_free_players for select to authenticated using (
  exists (select 1 from public.tournaments t where t.id = tournament_id)
);
create policy "tournament_groups_select_visible" on public.tournament_groups for select to authenticated using (
  exists (select 1 from public.tournaments t where t.id = tournament_id)
);
create policy "tournament_group_teams_select_visible" on public.tournament_group_teams for select to authenticated using (
  exists (select 1 from public.tournament_groups g join public.tournaments t on t.id = g.tournament_id where g.id = group_id)
);
create policy "tournament_games_select_visible" on public.tournament_games for select to authenticated using (
  exists (select 1 from public.tournaments t where t.id = tournament_id)
);

grant select on public.tournaments, public.tournament_courts, public.tournament_teams,
  public.tournament_team_members, public.tournament_free_players, public.tournament_groups,
  public.tournament_group_teams, public.tournament_games to authenticated;

create or replace function public.assert_tournament_available(p_tournament_id uuid)
returns public.tournaments language plpgsql stable security definer set search_path = '' as $$
declare target public.tournaments;
begin
  if (select auth.uid()) is null or not public.is_active_user() then raise exception 'Profilo attivo richiesto'; end if;
  select * into target from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Torneo non trovato'; end if;
  return target;
end;
$$;

create or replace function public.tournament_profile_is_registered(p_tournament_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tournament_team_members tm
    join public.tournament_teams tt on tt.id = tm.team_id
    where tt.tournament_id = p_tournament_id and tm.profile_id = p_profile_id
      and tt.status in ('proposed', 'confirmed', 'waitlisted') and tm.status <> 'rejected'
  ) or exists (
    select 1 from public.tournament_free_players fp
    where fp.tournament_id = p_tournament_id and fp.profile_id = p_profile_id
      and fp.status in ('active', 'waitlisted')
  );
$$;

create or replace function public.create_tournament(
  p_title text, p_description text, p_venue_id uuid, p_court_ids uuid[],
  p_preset public.tournament_preset, p_registration_mode public.tournament_registration_mode,
  p_format public.tournament_format, p_gender public.match_gender, p_min_level smallint,
  p_max_level smallint, p_max_teams smallint, p_registration_deadline timestamptz,
  p_starts_at timestamptz, p_ends_at timestamptz, p_cost_cents integer,
  p_guaranteed_matches smallint, p_group_size smallint, p_qualifiers_per_group smallint,
  p_group_best_of smallint, p_group_set_points smallint, p_knockout_best_of smallint,
  p_knockout_set_points smallint, p_tiebreak_points smallint, p_win_by_two boolean,
  p_third_place boolean, p_standings_win_points smallint, p_standings_loss_points smallint,
  p_minimum_rest_minutes smallint, p_result_confirmation_required boolean
) returns public.tournaments language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); created public.tournaments;
begin
  if actor is null or not public.can_organize_tournaments() then raise exception 'Permesso organizzatore richiesto'; end if;
  if p_starts_at <= now() + interval '1 hour' or coalesce(array_length(p_court_ids, 1), 0) = 0 then
    raise exception 'Data futura e almeno un campo sono obbligatori';
  end if;
  if exists (
    select 1 from unnest(p_court_ids) supplied(id)
    left join public.courts c on c.id = supplied.id and c.venue_id = p_venue_id and c.active
    where c.id is null
  ) then raise exception 'Uno o più campi non appartengono al luogo selezionato'; end if;

  insert into public.tournaments (
    organizer_id, venue_id, title, description, preset, registration_mode, format, gender,
    min_level, max_level, max_teams, registration_deadline, starts_at, ends_at, cost_cents,
    guaranteed_matches, group_size, qualifiers_per_group, group_best_of, group_set_points,
    knockout_best_of, knockout_set_points, tiebreak_points, win_by_two, third_place,
    standings_win_points, standings_loss_points, minimum_rest_minutes, result_confirmation_required
  ) values (
    actor, p_venue_id, trim(p_title), nullif(trim(p_description), ''), p_preset,
    p_registration_mode, p_format, p_gender, p_min_level, p_max_level, p_max_teams,
    p_registration_deadline, p_starts_at, p_ends_at, p_cost_cents, p_guaranteed_matches,
    case when p_format = 'knockout' then null else p_group_size end,
    case when p_format = 'knockout' then null else p_qualifiers_per_group end,
    p_group_best_of, p_group_set_points, p_knockout_best_of, p_knockout_set_points,
    p_tiebreak_points, p_win_by_two, p_third_place, p_standings_win_points,
    p_standings_loss_points, p_minimum_rest_minutes, p_result_confirmation_required
  ) returning * into created;

  insert into public.tournament_courts (tournament_id, court_id)
  select created.id, id from (select distinct unnest(p_court_ids) id) courts;
  return created;
end;
$$;

create or replace function public.publish_tournament(p_tournament_id uuid)
returns public.tournaments language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target public.tournaments;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception 'Torneo non trovato'; end if;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then raise exception 'Operazione non autorizzata'; end if;
  if target.status <> 'draft' or target.registration_deadline <= now() then raise exception 'Il torneo non può essere pubblicato'; end if;
  update public.tournaments set status = 'published', published_at = now()
  where id = p_tournament_id returning * into target;
  return target;
end;
$$;

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
  if public.tournament_profile_is_registered(p_tournament_id, actor) then raise exception 'Sei già iscritto o invitato'; end if;
  insert into public.tournament_free_players (tournament_id, profile_id) values (p_tournament_id, actor);
end;
$$;

create or replace function public.propose_tournament_team(p_tournament_id uuid, p_partner_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target public.tournaments; created_id uuid; actor_level smallint; partner_level smallint;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if actor is null or not public.is_active_user() then raise exception 'Profilo attivo richiesto'; end if;
  if not found or target.status <> 'published' or target.registration_deadline <= now() then raise exception 'Iscrizioni non disponibili'; end if;
  if target.registration_mode = 'individual' then raise exception 'Questo torneo accetta soltanto iscrizioni individuali'; end if;
  if p_partner_id is null or p_partner_id = actor then raise exception 'Compagno non valido'; end if;
  select livello into actor_level from public.profiles where id = actor and attivo;
  select livello into partner_level from public.profiles where id = p_partner_id and attivo;
  if actor_level is null or partner_level is null or actor_level not between target.min_level and target.max_level
    or partner_level not between target.min_level and target.max_level then raise exception 'Uno dei giocatori non è idoneo'; end if;
  if public.tournament_profile_is_registered(p_tournament_id, actor)
    or public.tournament_profile_is_registered(p_tournament_id, p_partner_id) then raise exception 'Uno dei giocatori è già coinvolto nel torneo'; end if;
  insert into public.tournament_teams (tournament_id, created_by) values (p_tournament_id, actor) returning id into created_id;
  insert into public.tournament_team_members (team_id, profile_id, status, invited_by, responded_at) values
    (created_id, actor, 'accepted', actor, now()), (created_id, p_partner_id, 'invited', actor, null);
  return created_id;
end;
$$;

create or replace function public.respond_tournament_team_invite(p_team_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target_team public.tournament_teams; target public.tournaments; confirmed_count integer;
begin
  select tt.* into target_team from public.tournament_teams tt where tt.id = p_team_id for update;
  if not found then raise exception 'Coppia non trovata'; end if;
  select * into target from public.tournaments where id = target_team.tournament_id for update;
  if target.status <> 'published' or target.registration_deadline <= now() then raise exception 'Invito non più modificabile'; end if;
  update public.tournament_team_members set status = case when p_accept then 'accepted' else 'rejected' end,
    responded_at = now() where team_id = p_team_id and profile_id = actor and status = 'invited';
  if not found then raise exception 'Invito non trovato'; end if;
  if not p_accept then update public.tournament_teams set status = 'withdrawn' where id = p_team_id; return; end if;
  if (select count(*) from public.tournament_team_members where team_id = p_team_id and status = 'accepted') = 2 then
    select count(*) into confirmed_count from public.tournament_teams where tournament_id = target.id and status = 'confirmed';
    update public.tournament_teams set status = case when confirmed_count < target.max_teams then 'confirmed' else 'waitlisted' end,
      waitlist_position = case when confirmed_count < target.max_teams then null else
        coalesce((select max(waitlist_position) + 1 from public.tournament_teams where tournament_id = target.id), 1) end
    where id = p_team_id;
  end if;
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
    or not exists (select 1 from public.tournament_free_players where tournament_id = p_tournament_id and profile_id = p_player2 and status = 'active') then
    raise exception 'Seleziona due giocatori liberi';
  end if;
  insert into public.tournament_teams (tournament_id, created_by) values (p_tournament_id, actor) returning id into created_id;
  insert into public.tournament_team_members (team_id, profile_id, status, invited_by) values
    (created_id, p_player1, 'invited', actor), (created_id, p_player2, 'invited', actor);
  update public.tournament_free_players set status = 'withdrawn' where tournament_id = p_tournament_id and profile_id in (p_player1, p_player2);
  return created_id;
end;
$$;

create or replace function public.withdraw_from_tournament(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target public.tournaments; affected_team uuid;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if actor is null or target.status <> 'published' or target.registration_deadline <= now() then raise exception 'Ritiro non disponibile'; end if;
  update public.tournament_free_players set status = 'withdrawn', updated_at = now()
    where tournament_id = p_tournament_id and profile_id = actor and status in ('active', 'waitlisted');
  select tt.id into affected_team from public.tournament_teams tt join public.tournament_team_members tm on tm.team_id = tt.id
    where tt.tournament_id = p_tournament_id and tm.profile_id = actor and tt.status in ('proposed', 'confirmed', 'waitlisted') for update of tt;
  if affected_team is not null then update public.tournament_teams set status = 'withdrawn' where id = affected_team; end if;
  if affected_team is null and not found then raise exception 'Iscrizione non trovata'; end if;
end;
$$;

create or replace function public.close_tournament_registrations(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target public.tournaments; team_count integer; group_count integer; g integer; team_record record; group_ids uuid[] := array[]::uuid[]; assigned_group uuid; game_pos integer := 0; court_ids uuid[]; court_count integer;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then raise exception 'Permesso organizzatore richiesto'; end if;
  if target.status <> 'published' then raise exception 'Il torneo non accetta questa operazione'; end if;
  if exists (select 1 from public.tournament_free_players where tournament_id = p_tournament_id and status = 'active') then raise exception 'Abbina o rimuovi tutti i giocatori liberi'; end if;
  select count(*) into team_count from public.tournament_teams where tournament_id = p_tournament_id and status = 'confirmed';
  if team_count < 4 then raise exception 'Servono almeno quattro coppie confermate'; end if;
  update public.tournaments set status = 'registration_closed', rules_locked_at = now() where id = p_tournament_id;
  select array_agg(court_id order by court_id) into court_ids from public.tournament_courts where tournament_id = p_tournament_id;
  court_count := array_length(court_ids, 1);

  if target.format in ('groups', 'mixed') then
    group_count := ceil(team_count::numeric / target.group_size)::integer;
    for g in 1..group_count loop
      insert into public.tournament_groups (tournament_id, name, position) values (p_tournament_id, 'Girone ' || chr(64 + g), g)
      returning id into assigned_group;
      group_ids := array_append(group_ids, assigned_group);
    end loop;
    g := 0;
    for team_record in select id, row_number() over (order by coalesce(seed, 32767), created_at, id) rn from public.tournament_teams where tournament_id = p_tournament_id and status = 'confirmed' loop
      g := ((team_record.rn - 1) % group_count) + 1;
      insert into public.tournament_group_teams (group_id, team_id, position) values
        (group_ids[g], team_record.id, 1 + (select count(*) from public.tournament_group_teams where group_id = group_ids[g]));
    end loop;
    for assigned_group in select id from public.tournament_groups where tournament_id = p_tournament_id order by position loop
      for team_record in
        select a.team_id team1_id, b.team_id team2_id
        from public.tournament_group_teams a join public.tournament_group_teams b on b.group_id = a.group_id and b.position > a.position
        where a.group_id = assigned_group order by a.position, b.position
      loop
        game_pos := game_pos + 1;
        insert into public.tournament_games (tournament_id, phase, group_id, round_no, position, team1_id, team2_id, court_id, scheduled_at)
        values (p_tournament_id, 'group', assigned_group, 1, game_pos, team_record.team1_id, team_record.team2_id,
          court_ids[((game_pos - 1) % court_count) + 1], target.starts_at + make_interval(mins => ((game_pos - 1) / court_count) * (30 + target.minimum_rest_minutes)));
      end loop;
    end loop;
  else
    game_pos := 0;
    for team_record in
      with ranked as (select id, row_number() over (order by coalesce(seed, 32767), created_at, id) rn, count(*) over () total from public.tournament_teams where tournament_id = p_tournament_id and status = 'confirmed')
      select a.id team1_id, b.id team2_id from ranked a join ranked b on b.rn = a.total - a.rn + 1 where a.rn <= a.total / 2 order by a.rn
    loop
      game_pos := game_pos + 1;
      insert into public.tournament_games (tournament_id, phase, round_no, position, team1_id, team2_id, court_id, scheduled_at)
      values (p_tournament_id, 'knockout', 1, game_pos, team_record.team1_id, team_record.team2_id,
        court_ids[((game_pos - 1) % court_count) + 1], target.starts_at + make_interval(mins => ((game_pos - 1) / court_count) * (45 + target.minimum_rest_minutes)));
    end loop;
  end if;
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
  for i in 1..array_length(p_team1_scores, 1) loop
    if p_team1_scores[i] < 0 or p_team2_scores[i] < 0 or p_team1_scores[i] = p_team2_scores[i] then raise exception 'Punteggio set non valido'; end if;
    if p_team1_scores[i] > p_team2_scores[i] then wins1 := wins1 + 1; else wins2 := wins2 + 1; end if;
  end loop;
  if greatest(wins1, wins2) <> needed then raise exception 'L’incontro non ha un vincitore valido'; end if;
  winner := case when wins1 > wins2 then game.team1_id else game.team2_id end;
  update public.tournament_games set team1_scores = p_team1_scores, team2_scores = p_team2_scores,
    winner_team_id = winner, status = 'completed' where id = p_game_id;
  update public.tournaments set status = 'in_progress' where id = target.id and status = 'registration_closed';
end;
$$;

create or replace function public.cancel_tournament(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target public.tournaments;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then raise exception 'Operazione non autorizzata'; end if;
  if target.status in ('completed', 'cancelled') then raise exception 'Il torneo non può essere annullato'; end if;
  update public.tournaments set status = 'cancelled' where id = p_tournament_id;
end;
$$;

revoke all on function public.assert_tournament_available(uuid) from public;
revoke all on function public.tournament_profile_is_registered(uuid, uuid) from public;
revoke all on function public.create_tournament(text,text,uuid,uuid[],public.tournament_preset,public.tournament_registration_mode,public.tournament_format,public.match_gender,smallint,smallint,smallint,timestamptz,timestamptz,timestamptz,integer,smallint,smallint,smallint,smallint,smallint,smallint,smallint,smallint,boolean,boolean,smallint,smallint,smallint,boolean) from public;
revoke all on function public.publish_tournament(uuid) from public;
revoke all on function public.join_tournament_as_free_player(uuid) from public;
revoke all on function public.propose_tournament_team(uuid, uuid) from public;
revoke all on function public.respond_tournament_team_invite(uuid, boolean) from public;
revoke all on function public.organizer_pair_free_players(uuid, uuid, uuid) from public;
revoke all on function public.withdraw_from_tournament(uuid) from public;
revoke all on function public.close_tournament_registrations(uuid) from public;
revoke all on function public.submit_tournament_result(uuid, smallint[], smallint[]) from public;
revoke all on function public.cancel_tournament(uuid) from public;

grant execute on function public.create_tournament(text,text,uuid,uuid[],public.tournament_preset,public.tournament_registration_mode,public.tournament_format,public.match_gender,smallint,smallint,smallint,timestamptz,timestamptz,timestamptz,integer,smallint,smallint,smallint,smallint,smallint,smallint,smallint,smallint,boolean,boolean,smallint,smallint,smallint,boolean) to authenticated;
grant execute on function public.publish_tournament(uuid), public.join_tournament_as_free_player(uuid),
  public.propose_tournament_team(uuid, uuid), public.respond_tournament_team_invite(uuid, boolean),
  public.organizer_pair_free_players(uuid, uuid, uuid), public.withdraw_from_tournament(uuid),
  public.close_tournament_registrations(uuid), public.submit_tournament_result(uuid, smallint[], smallint[]),
  public.cancel_tournament(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.tournaments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.tournament_teams;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.tournament_team_members;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.tournament_games;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
