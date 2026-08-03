-- Onda 6 — Chat di partita e torneo.
-- Tabella unica: un messaggio = una riga; reazioni in JSONB sulla riga.
-- Soft-delete = tombstone. Accesso limitato ai partecipanti della risorsa padre.
-- Scritture solo via RPC security definer; Supabase Realtime al posto di SignalR.

create type public.chat_resource as enum ('match', 'tournament');
create type public.chat_reaction as enum ('heart', 'thumbs_up', 'thumbs_down', 'laugh', 'emphasis', 'question');

create table public.chat_messages (
  id bigint generated always as identity primary key,
  resource_type public.chat_resource not null,
  resource_id uuid not null,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) <= 4000),
  reply_to_id bigint references public.chat_messages(id) on delete restrict,
  reactions jsonb not null default '[]',
  text_edited_at timestamptz,
  deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz not null default now()
);

create index chat_messages_resource_idx on public.chat_messages (resource_type, resource_id, created_at, id);

-- Predicato di accesso: partecipante/creatore (partita) oppure iscritto/organizzatore/admin (torneo).
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
        or exists (
          select 1 from public.tournament_free_players fp
          where fp.tournament_id = t.id and fp.profile_id = (select auth.uid()) and fp.status in ('active', 'waitlisted')
        )
      )
    )
    else false
  end;
$$;

alter table public.chat_messages enable row level security;
create policy "chat_messages_select_accessible" on public.chat_messages
  for select to authenticated using (public.can_access_chat(resource_type, resource_id));
grant select on public.chat_messages to authenticated;

-- ---- RPC mutazioni ----
create or replace function public.post_chat_message(
  p_type public.chat_resource, p_id uuid, p_body text, p_reply_to bigint default null
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_body text := btrim(p_body); v_id bigint;
begin
  if v_uid is null or not public.is_active_user() then raise exception 'Profilo attivo richiesto'; end if;
  if not public.can_access_chat(p_type, p_id) then raise exception 'Chat non disponibile'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 4000 then raise exception 'Messaggio non valido'; end if;
  if p_reply_to is not null and not exists (
    select 1 from public.chat_messages m
    where m.id = p_reply_to and m.resource_type = p_type and m.resource_id = p_id and not m.deleted
  ) then raise exception 'Il messaggio a cui rispondi non è disponibile'; end if;
  insert into public.chat_messages (resource_type, resource_id, author_id, body, reply_to_id)
  values (p_type, p_id, v_uid, v_body, p_reply_to) returning id into v_id;
  return v_id;
end $$;

create or replace function public.edit_chat_message(p_id bigint, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_body text := btrim(p_body); msg public.chat_messages;
begin
  select * into msg from public.chat_messages where id = p_id for update;
  if not found then raise exception 'Messaggio non trovato'; end if;
  if msg.deleted then raise exception 'Messaggio eliminato'; end if;
  if msg.author_id <> v_uid then raise exception 'Solo l''autore può modificare il messaggio'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 4000 then raise exception 'Messaggio non valido'; end if;
  update public.chat_messages set body = v_body, text_edited_at = now() where id = p_id;
end $$;

create or replace function public.delete_chat_message(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); msg public.chat_messages;
begin
  select * into msg from public.chat_messages where id = p_id for update;
  if not found then raise exception 'Messaggio non trovato'; end if;
  if msg.author_id <> v_uid then raise exception 'Solo l''autore può eliminare il messaggio'; end if;
  if msg.deleted then return; end if;
  update public.chat_messages
    set deleted = true, deleted_at = now(), deleted_by = v_uid, body = '', reactions = '[]'::jsonb
    where id = p_id;
end $$;

create or replace function public.set_chat_reaction(p_id bigint, p_type public.chat_reaction)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); msg public.chat_messages; v_new jsonb; v_had_same boolean;
begin
  select * into msg from public.chat_messages where id = p_id for update;
  if not found then raise exception 'Messaggio non trovato'; end if;
  if msg.deleted then raise exception 'Messaggio eliminato'; end if;
  if v_uid is null or not public.can_access_chat(msg.resource_type, msg.resource_id) then
    raise exception 'Chat non disponibile'; end if;
  v_had_same := exists (
    select 1 from jsonb_array_elements(msg.reactions) r
    where r->>'user_id' = v_uid::text and r->>'type' = p_type::text
  );
  v_new := coalesce((
    select jsonb_agg(r) from jsonb_array_elements(msg.reactions) r where r->>'user_id' <> v_uid::text
  ), '[]'::jsonb);
  if not v_had_same then
    v_new := v_new || jsonb_build_object('type', p_type::text, 'user_id', v_uid::text);
  end if;
  update public.chat_messages set reactions = v_new where id = p_id;
end $$;

revoke all on function public.can_access_chat(public.chat_resource, uuid) from public;
revoke all on function public.post_chat_message(public.chat_resource, uuid, text, bigint) from public;
revoke all on function public.edit_chat_message(bigint, text) from public;
revoke all on function public.delete_chat_message(bigint) from public;
revoke all on function public.set_chat_reaction(bigint, public.chat_reaction) from public;
grant execute on function public.can_access_chat(public.chat_resource, uuid),
  public.post_chat_message(public.chat_resource, uuid, text, bigint),
  public.edit_chat_message(bigint, text),
  public.delete_chat_message(bigint),
  public.set_chat_reaction(bigint, public.chat_reaction) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
