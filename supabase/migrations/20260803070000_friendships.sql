-- Sistema di amicizie stile social: A invia richiesta a B (notifica), B accetta.
-- Una riga per coppia (direzione indipendente). Scritture solo via RPC.

create type public.friendship_status as enum ('pending', 'accepted', 'declined');

create table public.friendships (
  id bigint generated always as identity primary key,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_distinct check (requester_id <> addressee_id)
);

-- Una sola relazione per coppia, indipendente dalla direzione.
create unique index friendships_pair_uidx on public.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);

alter table public.friendships enable row level security;
create policy "friendships_select_own" on public.friendships
  for select to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));
grant select on public.friendships to authenticated;

-- ---- Mutazioni ----
create or replace function public.send_friend_request(p_target uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); existing public.friendships;
begin
  if v_uid is null or not public.is_active_user() then raise exception 'Profilo attivo richiesto'; end if;
  if p_target = v_uid or not exists (select 1 from public.profiles where id = p_target and attivo) then
    raise exception 'Utente non valido'; end if;

  select * into existing from public.friendships
  where least(requester_id, addressee_id) = least(v_uid, p_target)
    and greatest(requester_id, addressee_id) = greatest(v_uid, p_target)
  for update;

  if found then
    if existing.status = 'accepted' then raise exception 'Siete già amici'; end if;
    if existing.status = 'pending' then
      if existing.addressee_id = v_uid then
        -- l'altro mi aveva già inviato una richiesta: accetto
        update public.friendships set status = 'accepted', responded_at = now() where id = existing.id;
        perform public.create_notifications(array[existing.requester_id], 'friend_request_accepted', null, null, v_uid, '{}'::jsonb);
        return;
      else
        raise exception 'Richiesta già inviata';
      end if;
    end if;
    -- declined: consenti una nuova richiesta
    update public.friendships
      set requester_id = v_uid, addressee_id = p_target, status = 'pending', created_at = now(), responded_at = null
      where id = existing.id;
    perform public.create_notifications(array[p_target], 'friend_request_received', null, null, v_uid, '{}'::jsonb);
    return;
  end if;

  insert into public.friendships (requester_id, addressee_id) values (v_uid, p_target);
  perform public.create_notifications(array[p_target], 'friend_request_received', null, null, v_uid, '{}'::jsonb);
end $$;

create or replace function public.respond_friend_request(p_id bigint, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); f public.friendships;
begin
  select * into f from public.friendships where id = p_id for update;
  if not found then raise exception 'Richiesta non trovata'; end if;
  if f.addressee_id <> v_uid or f.status <> 'pending' then raise exception 'Richiesta non gestibile'; end if;
  update public.friendships set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = p_id;
  if p_accept then
    perform public.create_notifications(array[f.requester_id], 'friend_request_accepted', null, null, v_uid, '{}'::jsonb);
  end if;
end $$;

create or replace function public.remove_friend(p_other uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'Autenticazione richiesta'; end if;
  delete from public.friendships
  where least(requester_id, addressee_id) = least(v_uid, p_other)
    and greatest(requester_id, addressee_id) = greatest(v_uid, p_other);
end $$;

-- ---- Letture ----
create or replace function public.list_friends()
returns table(id uuid, nome text, cognome text, livello smallint)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nome, p.cognome, p.livello
  from public.friendships f
  join public.profiles p on p.id = case when f.requester_id = (select auth.uid()) then f.addressee_id else f.requester_id end
  where f.status = 'accepted'
    and (f.requester_id = (select auth.uid()) or f.addressee_id = (select auth.uid()))
  order by p.nome, p.cognome;
$$;

create or replace function public.list_friend_requests()
returns table(request_id bigint, id uuid, nome text, cognome text, livello smallint)
language sql stable security definer set search_path = '' as $$
  select f.id, p.id, p.nome, p.cognome, p.livello
  from public.friendships f
  join public.profiles p on p.id = f.requester_id
  where f.addressee_id = (select auth.uid()) and f.status = 'pending'
  order by f.created_at desc;
$$;

create or replace function public.list_addable_users()
returns table(id uuid, nome text, cognome text, livello smallint, relation text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nome, p.cognome, p.livello,
    coalesce((
      select case
        when f.status = 'accepted' then 'friend'
        when f.status = 'pending' and f.requester_id = (select auth.uid()) then 'outgoing'
        when f.status = 'pending' and f.addressee_id = (select auth.uid()) then 'incoming'
        else 'none' end
      from public.friendships f
      where least(f.requester_id, f.addressee_id) = least((select auth.uid()), p.id)
        and greatest(f.requester_id, f.addressee_id) = greatest((select auth.uid()), p.id)
    ), 'none') as relation
  from public.profiles p
  where p.attivo and p.id <> (select auth.uid())
  order by p.nome, p.cognome;
$$;

revoke all on function public.send_friend_request(uuid) from public;
revoke all on function public.respond_friend_request(bigint, boolean) from public;
revoke all on function public.remove_friend(uuid) from public;
revoke all on function public.list_friends() from public;
revoke all on function public.list_friend_requests() from public;
revoke all on function public.list_addable_users() from public;
grant execute on function public.send_friend_request(uuid), public.respond_friend_request(bigint, boolean),
  public.remove_friend(uuid), public.list_friends(), public.list_friend_requests(),
  public.list_addable_users() to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.friendships;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
