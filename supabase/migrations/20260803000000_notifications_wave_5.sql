-- Onda 5 — Notifiche in-app persistite + realtime.
-- Una riga per destinatario; il testo non è persistito (tipo + contesto + attore + payload),
-- il frontend compone il messaggio. Scritture solo via RPC/trigger security definer.

create type public.notification_type as enum (
  'match_participant_joined',
  'match_participant_withdrew',
  'match_cancelled',
  'match_closed',
  'tournament_team_invite',
  'tournament_invite_accepted',
  'tournament_invite_rejected',
  'tournament_registration_closed',
  'tournament_cancelled',
  'tournament_result_recorded'
);

alter table public.profiles
  add column in_app_notifications_enabled boolean not null default true;

create table public.notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  -- puntatori di contesto per la navigazione, senza vincolo FK (le risorse possono sparire)
  match_id uuid,
  tournament_id uuid,
  actor_id uuid,
  actor_name text,
  payload jsonb not null default '{}',
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_unread_idx on public.notifications (recipient_id, is_read);
create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select to authenticated using (recipient_id = (select auth.uid()));

grant select on public.notifications to authenticated;

-- ---- Sink centrale: una riga per destinatario, esclude l'attore, rispetta la preferenza ----
create or replace function public.create_notifications(
  p_recipients uuid[], p_type public.notification_type,
  p_match uuid default null, p_tournament uuid default null,
  p_actor uuid default null, p_payload jsonb default '{}'
) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor_name text;
begin
  if p_recipients is null or cardinality(p_recipients) = 0 then return; end if;
  if p_actor is not null then
    select nome || ' ' || cognome into v_actor_name from public.profiles where id = p_actor;
  end if;
  insert into public.notifications (recipient_id, type, match_id, tournament_id, actor_id, actor_name, payload)
  select r.id, p_type, p_match, p_tournament, p_actor, v_actor_name, coalesce(p_payload, '{}'::jsonb)
  from (select distinct unnest(p_recipients) as id) r
  join public.profiles pr on pr.id = r.id
  where r.id is not null
    and (p_actor is null or r.id <> p_actor)
    and pr.in_app_notifications_enabled;
end $$;

-- ---- RPC lato utente ----
create or replace function public.mark_notification_read(p_id bigint)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'Autenticazione richiesta'; end if;
  update public.notifications set is_read = true, read_at = now()
  where id = p_id and recipient_id = v_uid and is_read = false;
  return (select count(*)::integer from public.notifications where recipient_id = v_uid and is_read = false);
end $$;

create or replace function public.mark_all_notifications_read()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'Autenticazione richiesta'; end if;
  update public.notifications set is_read = true, read_at = now()
  where recipient_id = v_uid and is_read = false;
  return 0;
end $$;

create or replace function public.set_in_app_notifications(p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'Autenticazione richiesta'; end if;
  update public.profiles set in_app_notifications_enabled = coalesce(p_enabled, true) where id = v_uid;
end $$;

revoke all on function public.create_notifications(uuid[], public.notification_type, uuid, uuid, uuid, jsonb) from public;
revoke all on function public.mark_notification_read(bigint) from public;
revoke all on function public.mark_all_notifications_read() from public;
revoke all on function public.set_in_app_notifications(boolean) from public;
grant execute on function public.mark_notification_read(bigint),
  public.mark_all_notifications_read(), public.set_in_app_notifications(boolean) to authenticated;

-- ================= Trigger di dominio =================

-- Tornei: invito coppia
create or replace function public.notify_tournament_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_tournament uuid; v_actor uuid;
begin
  if new.status = 'invited' then
    select tournament_id into v_tournament from public.tournament_teams where id = new.team_id;
    perform public.create_notifications(array[new.profile_id], 'tournament_team_invite',
      null, v_tournament, new.invited_by, '{}'::jsonb);
  end if;
  return null;
end $$;
create trigger tournament_team_members_notify_invite after insert on public.tournament_team_members
for each row execute function public.notify_tournament_invite();

-- Tornei: risposta all'invito -> notifica al creatore della coppia
create or replace function public.notify_tournament_invite_response()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_creator uuid; v_tournament uuid; v_type public.notification_type;
begin
  if new.status is distinct from old.status and new.status in ('accepted','rejected') then
    select created_by, tournament_id into v_creator, v_tournament
    from public.tournament_teams where id = new.team_id;
    v_type := case when new.status = 'accepted' then 'tournament_invite_accepted'
                   else 'tournament_invite_rejected' end;
    perform public.create_notifications(array[v_creator], v_type,
      null, v_tournament, new.profile_id, '{}'::jsonb);
  end if;
  return null;
end $$;
create trigger tournament_team_members_notify_response after update of status on public.tournament_team_members
for each row execute function public.notify_tournament_invite_response();

-- Tornei: chiusura iscrizioni / annullamento
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
      select array_agg(distinct pid) into v_recipients from (
        select m.profile_id as pid
        from public.tournament_team_members m
        join public.tournament_teams tt on tt.id = m.team_id
        where tt.tournament_id = new.id
          and tt.status in ('proposed','confirmed','waitlisted') and m.status <> 'rejected'
        union
        select fp.profile_id
        from public.tournament_free_players fp
        where fp.tournament_id = new.id and fp.status in ('active','waitlisted')
      ) s;
      perform public.create_notifications(v_recipients, 'tournament_cancelled',
        null, new.id, v_actor, '{}'::jsonb);
    end if;
  end if;
  return null;
end $$;
create trigger tournaments_notify_status after update of status on public.tournaments
for each row execute function public.notify_tournament_status();

-- Tornei: risultato registrato -> notifica alle due coppie
create or replace function public.notify_tournament_result()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_recipients uuid[];
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    select array_agg(distinct m.profile_id) into v_recipients
    from public.tournament_team_members m
    where m.team_id in (new.team1_id, new.team2_id) and m.status = 'accepted';
    perform public.create_notifications(v_recipients, 'tournament_result_recorded',
      null, new.tournament_id, v_actor, jsonb_build_object('game_id', new.id));
  end if;
  return null;
end $$;
create trigger tournament_games_notify_result after update of status on public.tournament_games
for each row execute function public.notify_tournament_result();

-- Partite: iscrizione di un giocatore -> notifica al creatore
create or replace function public.notify_match_join()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_creator uuid;
begin
  select creator_id into v_creator from public.matches where id = new.match_id;
  perform public.create_notifications(array[v_creator], 'match_participant_joined',
    new.match_id, null, new.profile_id, '{}'::jsonb);
  return null;
end $$;
create trigger match_participants_notify_join after insert on public.match_participants
for each row execute function public.notify_match_join();

-- Partite: ritiro di un giocatore -> notifica al creatore
create or replace function public.notify_match_withdraw()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_creator uuid;
begin
  select creator_id into v_creator from public.matches where id = old.match_id;
  perform public.create_notifications(array[v_creator], 'match_participant_withdrew',
    old.match_id, null, old.profile_id, '{}'::jsonb);
  return null;
end $$;
create trigger match_participants_notify_withdraw after delete on public.match_participants
for each row execute function public.notify_match_withdraw();

-- Partite: annullamento / chiusura -> notifica ai partecipanti
create or replace function public.notify_match_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_recipients uuid[]; v_type public.notification_type;
begin
  if new.status is distinct from old.status and new.status in ('cancelled','completed') then
    v_type := case when new.status = 'cancelled' then 'match_cancelled' else 'match_closed' end;
    select array_agg(distinct profile_id) into v_recipients
    from public.match_participants where match_id = new.id;
    perform public.create_notifications(v_recipients, v_type, new.id, null, v_actor, '{}'::jsonb);
  end if;
  return null;
end $$;
create trigger matches_notify_status after update of status on public.matches
for each row execute function public.notify_match_status();

-- Realtime per la campanella
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
