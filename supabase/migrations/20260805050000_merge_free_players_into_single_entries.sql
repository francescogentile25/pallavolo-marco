-- Fusione di "giocatore libero" e "iscritto singolo" in un unico concetto.
--
-- Prima esistevano due modi di essere iscritti senza compagno: una riga in
-- tournament_free_players (auto-iscrizione individuale) e un'iscrizione con un solo
-- membro (aggiunta dall'organizzatore o nata da uno smembramento). Due liste, due
-- pulsanti di abbinamento e due comportamenti diversi — con l'abbinamento dei liberi
-- che richiedeva anche la conferma di entrambi.
--
-- Da qui in poi esiste solo l'iscrizione singola: chi si iscrive individualmente crea
-- direttamente un'iscrizione con un membro, e l'organizzatore la accoppia senza
-- passaggi di conferma. La tabella tournament_free_players viene rimossa.

-- ---- 1) Il controllo duplicati non deve più guardare i giocatori liberi ----
-- (va fatto per primo: la migrazione dei dati qui sotto inserisce membri per profili
-- che in quel momento risultano ancora liberi)
create or replace function public.prevent_duplicate_tournament_team_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_tournament uuid;
begin
  select tournament_id into target_tournament from public.tournament_teams where id = new.team_id;
  perform pg_advisory_xact_lock(hashtextextended(target_tournament::text || new.profile_id::text, 0));
  if exists (
    select 1 from public.tournament_team_members tm join public.tournament_teams tt on tt.id = tm.team_id
    where tt.tournament_id = target_tournament and tm.profile_id = new.profile_id
      and tm.status <> 'rejected' and tt.status in ('proposed', 'confirmed', 'waitlisted') and tt.id <> new.team_id
  ) then raise exception 'Il giocatore è già coinvolto nel torneo'; end if;
  return new;
end;
$$;

-- ---- 2) I giocatori liberi diventano iscrizioni singole ----
do $migrate$
declare fp record; new_team uuid;
begin
  for fp in
    select tournament_id, profile_id, status
    from public.tournament_free_players
    where status in ('active', 'waitlisted')
    order by created_at
  loop
    -- salta chi nel frattempo è già entrato in una coppia
    if exists (
      select 1 from public.tournament_team_members tm join public.tournament_teams tt on tt.id = tm.team_id
      where tt.tournament_id = fp.tournament_id and tm.profile_id = fp.profile_id
        and tm.status <> 'rejected' and tt.status in ('proposed', 'confirmed', 'waitlisted')
    ) then continue; end if;

    insert into public.tournament_teams(tournament_id, status, created_by)
    values (fp.tournament_id, 'proposed', fp.profile_id)
    returning id into new_team;
    insert into public.tournament_team_members(team_id, profile_id, status, invited_by, responded_at)
    values (new_team, fp.profile_id, 'accepted', fp.profile_id, now());
  end loop;
end
$migrate$;

-- ---- 3) Iscrizione individuale: crea un'iscrizione singola ----
drop function if exists public.join_tournament_as_free_player(uuid);

create function public.join_tournament_as_single_player(p_tournament_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  target public.tournaments;
  actor_level smallint;
  created_team uuid;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if actor is null or not public.is_active_user() then raise exception 'Profilo attivo richiesto'; end if;
  if not found or target.status <> 'published' or target.registration_deadline <= now() then
    raise exception 'Iscrizioni non disponibili'; end if;
  if target.registration_mode = 'pairs' then raise exception 'Questo torneo accetta soltanto coppie'; end if;
  select livello into actor_level from public.profiles where id = actor and attivo;
  if actor_level not between target.min_level and target.max_level then raise exception 'Livello non ammesso'; end if;
  if exists (
    select 1 from public.tournament_team_members tm join public.tournament_teams tt on tt.id = tm.team_id
    where tt.tournament_id = p_tournament_id and tm.profile_id = actor and tm.status <> 'rejected'
      and tt.status in ('proposed', 'confirmed', 'waitlisted')
  ) then raise exception 'Sei già iscritto o invitato'; end if;

  insert into public.tournament_teams(tournament_id, status, created_by)
  values (p_tournament_id, 'proposed', actor) returning id into created_team;
  insert into public.tournament_team_members(team_id, profile_id, status, invited_by, responded_at)
  values (created_team, actor, 'accepted', actor, now());
  return created_team;
end;
$$;

-- ---- 4) Le funzioni che interrogavano le due liste ora ne guardano una sola ----
create or replace function public.is_tournament_participant(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tournament_team_members tm
    join public.tournament_teams tt on tt.id = tm.team_id
    where tt.tournament_id = p_tournament_id and tm.profile_id = (select auth.uid()) and tm.status <> 'rejected'
  );
$$;

create or replace function public.tournament_profile_is_registered(p_tournament_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tournament_team_members tm
    join public.tournament_teams tt on tt.id = tm.team_id
    where tt.tournament_id = p_tournament_id and tm.profile_id = p_profile_id
      and tt.status in ('proposed', 'confirmed', 'waitlisted') and tm.status <> 'rejected'
  );
$$;

create or replace function public.can_access_chat(p_type public.chat_resource, p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'match' then exists (
      select 1 from public.matches m where m.id = p_id and (
        m.creator_id = (select auth.uid())
        or exists (select 1 from public.match_participants mp where mp.match_id = m.id and mp.profile_id = (select auth.uid()))
      )
    )
    when 'tournament' then exists (
      select 1 from public.tournaments t where t.id = p_id and (
        t.organizer_id = (select auth.uid()) or public.is_admin()
        or exists (
          select 1 from public.tournament_team_members tm
          join public.tournament_teams tt on tt.id = tm.team_id
          where tt.tournament_id = t.id and tm.profile_id = (select auth.uid()) and tm.status <> 'rejected'
        )
      )
    )
    else false
  end;
$$;

create or replace function public.notify_chat_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_recipients uuid[]; v_mentions uuid[];
begin
  select coalesce(array_agg((mention.value)::uuid), array[]::uuid[]) into v_mentions
  from jsonb_array_elements_text(coalesce(new.mentions, '[]'::jsonb)) as mention;

  if new.resource_type = 'match' then
    select array_agg(distinct profile_id) into v_recipients
    from public.match_participants
    where match_id = new.resource_id and not (profile_id = any(v_mentions));
    perform public.create_notifications(v_recipients, 'chat_message', new.resource_id, null, new.author_id, '{}'::jsonb);
  elsif new.resource_type = 'tournament' then
    select array_agg(distinct m.profile_id) into v_recipients
    from public.tournament_team_members m
    join public.tournament_teams tt on tt.id = m.team_id
    where tt.tournament_id = new.resource_id
      and tt.status in ('proposed','confirmed','waitlisted') and m.status <> 'rejected'
      and not (m.profile_id = any(v_mentions));
    perform public.create_notifications(v_recipients, 'chat_message', null, new.resource_id, new.author_id, '{}'::jsonb);
  end if;
  return null;
end $$;

create or replace function public.notify_tournament_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_recipients uuid[];
begin
  if new.status is distinct from old.status then
    if new.status = 'registration_closed' then
      select array_agg(distinct m.profile_id) into v_recipients
      from public.tournament_team_members m
      join public.tournament_teams tt on tt.id = m.team_id
      where tt.tournament_id = new.id and tt.status = 'confirmed' and m.status = 'accepted';
      perform public.create_notifications(v_recipients, 'tournament_registration_closed',
        null, new.id, v_actor, '{}'::jsonb);
    elsif new.status = 'cancelled' then
      select array_agg(distinct m.profile_id) into v_recipients
      from public.tournament_team_members m
      join public.tournament_teams tt on tt.id = m.team_id
      where tt.tournament_id = new.id
        and tt.status in ('proposed','confirmed','waitlisted') and m.status <> 'rejected';
      perform public.create_notifications(v_recipients, 'tournament_cancelled',
        null, new.id, v_actor, '{}'::jsonb);
    end if;
  end if;
  return null;
end $$;

-- La chiusura iscrizioni non deve più pretendere che i liberi siano stati abbinati:
-- le iscrizioni singole restano legittime e semplicemente non sono coppie confermate.
create or replace function public.close_tournament_registrations(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target public.tournaments; team_count integer;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then raise exception 'Permesso organizzatore richiesto'; end if;
  if target.status <> 'published' then raise exception 'Il torneo non accetta questa operazione'; end if;
  select count(*) into team_count from public.tournament_teams where tournament_id = p_tournament_id and status = 'confirmed';
  if team_count < 2 then raise exception 'Servono almeno due coppie confermate'; end if;
  update public.tournaments set status = 'registration_closed', rules_locked_at = null where id = p_tournament_id;
end;
$$;

create or replace function public.withdraw_from_tournament(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  target public.tournaments;
  affected_team uuid;
  affected_status public.tournament_team_status;
  promoted_team uuid;
begin
  select * into target from public.tournaments where id = p_tournament_id for update;
  if actor is null or target.status <> 'published' or target.registration_deadline <= now() then
    raise exception 'Ritiro non disponibile';
  end if;

  select team.id, team.status into affected_team, affected_status
  from public.tournament_teams team
  join public.tournament_team_members member on member.team_id = team.id
  where team.tournament_id = p_tournament_id and member.profile_id = actor
    and team.status in ('proposed', 'confirmed', 'waitlisted')
  for update of team;

  if affected_team is null then raise exception 'Iscrizione non trovata'; end if;

  update public.tournament_teams set status = 'withdrawn', waitlist_position = null where id = affected_team;

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
end;
$$;

-- La visibilità dei profili degli iscritti passava anche dai giocatori liberi:
-- ora tutti gli iscritti sono membri di un'iscrizione, quindi basta il primo ramo.
drop policy if exists "profiles_select_tournament_participants" on public.profiles;
create policy "profiles_select_tournament_participants" on public.profiles
for select to authenticated using (
  public.is_active_user() and exists (
    select 1 from public.tournament_team_members tm
    join public.tournament_teams tt on tt.id = tm.team_id
    join public.tournaments t on t.id = tt.tournament_id
    where tm.profile_id = profiles.id
      and tt.status in ('proposed', 'confirmed', 'waitlisted')
      and t.status <> 'draft'
  )
);

-- ---- 5) Via il vecchio concetto ----
drop function if exists public.organizer_pair_free_players(uuid, uuid, uuid);
drop trigger if exists tournament_free_players_no_duplicates on public.tournament_free_players;
drop function if exists public.prevent_duplicate_tournament_free_player();
drop table if exists public.tournament_free_players;
drop type if exists public.tournament_free_player_status;

revoke all on function public.join_tournament_as_single_player(uuid) from public;
grant execute on function public.join_tournament_as_single_player(uuid) to authenticated;

notify pgrst, 'reload schema';
