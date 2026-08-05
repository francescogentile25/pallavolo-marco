-- Chat — allineamento a CHAT-SPEC.
-- 1) Menzioni @ persistite in colonna JSONB sulla riga del messaggio (nessuna tabella figlia).
-- 2) Timeline completa risolta lato server (nomi autore, autore del citato, reagenti, menzionati,
--    autore dell'eliminazione) da un'unica RPC: single source per query e per ogni mutazione.
-- 3) Ogni mutazione ritorna la timeline completa aggiornata: il client sostituisce l'intera lista.
-- 4) Il testo di un tombstone non transita mai sul wire; reazioni e menzioni sono svuotate.

alter table public.chat_messages
  add column if not exists mentions jsonb not null default '[]'::jsonb;

alter table public.chat_messages
  drop constraint if exists chat_messages_mentions_is_array;
alter table public.chat_messages
  add constraint chat_messages_mentions_is_array check (jsonb_typeof(mentions) = 'array');

-- ---- Helper: menzionabile = ha già scritto almeno un messaggio in QUESTA chat ----
-- (inclusi gli autori di messaggi poi eliminati: hanno comunque scritto).
create or replace function public.chat_valid_mentions(
  p_type public.chat_resource, p_id uuid, p_mentions uuid[]
) returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct candidate), array[]::uuid[])
  from unnest(coalesce(p_mentions, array[]::uuid[])) as candidate
  where exists (
    select 1 from public.chat_messages c
    where c.resource_type = p_type and c.resource_id = p_id and c.author_id = candidate
  );
$$;

-- Avvisi di menzione: create_notifications esclude già l'attore (mai avviso a sé stessi).
create or replace function public.push_chat_mention_alerts(
  p_type public.chat_resource, p_id uuid, p_mentions uuid[], p_actor uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_mentions is null or cardinality(p_mentions) = 0 then return; end if;
  if p_type = 'match' then
    perform public.create_notifications(p_mentions, 'chat_mention', p_id, null, p_actor, '{}'::jsonb);
  else
    perform public.create_notifications(p_mentions, 'chat_mention', null, p_id, p_actor, '{}'::jsonb);
  end if;
end $$;

-- ---- Timeline completa (mapper unico) ----
create or replace function public.get_chat_timeline(p_type public.chat_resource, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_result jsonb;
begin
  if v_uid is null or not public.can_access_chat(p_type, p_id) then
    raise exception 'Chat non disponibile';
  end if;

  select coalesce(jsonb_agg(timeline.item order by timeline.sort_at, timeline.sort_id), '[]'::jsonb) into v_result
  from (
    select
      m.created_at as sort_at,
      m.id as sort_id,
      jsonb_build_object(
        'id', m.id,
        'resource_type', m.resource_type,
        'resource_id', m.resource_id,
        'author_id', m.author_id,
        'author_name', coalesce(nullif(btrim(author.nome || ' ' || author.cognome), ''), '—'),
        'mine', m.author_id = v_uid,
        'body', case when m.deleted then '' else m.body end,
        'created_at', m.created_at,
        'text_edited_at', case when m.deleted then null else m.text_edited_at end,
        'deleted', m.deleted,
        'deleted_at', m.deleted_at,
        'deleted_by_name', case when m.deleted
          then coalesce(nullif(btrim(remover.nome || ' ' || remover.cognome), ''), '—') else null end,
        'reply_to_id', m.reply_to_id,
        'reply_to', case when quoted.id is null then null else jsonb_build_object(
          'id', quoted.id,
          'deleted', quoted.deleted,
          'author_name', coalesce(nullif(btrim(quoted_author.nome || ' ' || quoted_author.cognome), ''), '—'),
          'body', case when quoted.deleted then null
            else left(quoted.body, 80) || case when char_length(quoted.body) > 80 then '…' else '' end end
        ) end,
        'reactions', case when m.deleted then '[]'::jsonb else coalesce((
          select jsonb_agg(jsonb_build_object(
            'type', entry.value->>'type',
            'user_id', entry.value->>'user_id',
            'author_name', coalesce(nullif(btrim(reactor.nome || ' ' || reactor.cognome), ''), '—'),
            'mine', (entry.value->>'user_id') = v_uid::text))
          from jsonb_array_elements(m.reactions) as entry
          left join public.profiles reactor on reactor.id = (entry.value->>'user_id')::uuid
        ), '[]'::jsonb) end,
        'mentions', case when m.deleted then '[]'::jsonb else coalesce((
          select jsonb_agg(jsonb_build_object(
            'user_id', mention.value,
            'user_name', coalesce(nullif(btrim(mentioned.nome || ' ' || mentioned.cognome), ''), '—')))
          from jsonb_array_elements_text(m.mentions) as mention
          left join public.profiles mentioned on mentioned.id = (mention.value)::uuid
        ), '[]'::jsonb) end
      ) as item
    from public.chat_messages m
    left join public.profiles author on author.id = m.author_id
    left join public.profiles remover on remover.id = m.deleted_by
    left join public.chat_messages quoted on quoted.id = m.reply_to_id
    left join public.profiles quoted_author on quoted_author.id = quoted.author_id
    where m.resource_type = p_type and m.resource_id = p_id
  ) timeline;

  return v_result;
end $$;

-- Utenti menzionabili: autori distinti dei messaggi della chat, ordinati per nominativo.
create or replace function public.get_chat_mentionable(p_type public.chat_resource, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if (select auth.uid()) is null or not public.can_access_chat(p_type, p_id) then
    raise exception 'Chat non disponibile';
  end if;
  select coalesce(jsonb_agg(
    jsonb_build_object('user_id', p.id, 'name', btrim(p.nome || ' ' || p.cognome))
    order by p.cognome, p.nome), '[]'::jsonb) into v_result
  from (
    select distinct author_id from public.chat_messages
    where resource_type = p_type and resource_id = p_id
  ) authors
  join public.profiles p on p.id = authors.author_id;
  return v_result;
end $$;

-- ---- Mutazioni: firma nuova (menzioni) e ritorno full-timeline ----
drop function if exists public.post_chat_message(public.chat_resource, uuid, text, bigint);
drop function if exists public.edit_chat_message(bigint, text);
drop function if exists public.delete_chat_message(bigint);
drop function if exists public.set_chat_reaction(bigint, public.chat_reaction);

create function public.post_chat_message(
  p_type public.chat_resource, p_id uuid, p_body text,
  p_reply_to bigint default null, p_mentions uuid[] default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_body text := btrim(p_body);
  v_mentions uuid[];
  v_id bigint;
begin
  if v_uid is null or not public.is_active_user() then raise exception 'Profilo attivo richiesto'; end if;
  if not public.can_access_chat(p_type, p_id) then raise exception 'Chat non disponibile'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 4000 then raise exception 'Messaggio non valido'; end if;
  if p_reply_to is not null and not exists (
    select 1 from public.chat_messages m
    where m.id = p_reply_to and m.resource_type = p_type and m.resource_id = p_id and not m.deleted
  ) then raise exception 'Il messaggio a cui rispondi non è disponibile'; end if;

  -- gli id non menzionabili vengono scartati in silenzio, mai errore
  v_mentions := public.chat_valid_mentions(p_type, p_id, p_mentions);

  insert into public.chat_messages (resource_type, resource_id, author_id, body, reply_to_id, mentions)
  values (p_type, p_id, v_uid, v_body, p_reply_to,
    coalesce((select jsonb_agg(to_jsonb(mention_id::text)) from unnest(v_mentions) as mention_id), '[]'::jsonb))
  returning id into v_id;

  perform public.push_chat_mention_alerts(p_type, p_id, v_mentions, v_uid);
  return public.get_chat_timeline(p_type, p_id);
end $$;

create function public.edit_chat_message(p_id bigint, p_body text, p_mentions uuid[] default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_body text := btrim(p_body);
  v_mentions uuid[];
  msg public.chat_messages;
begin
  select * into msg from public.chat_messages where id = p_id for update;
  if not found then raise exception 'Messaggio non trovato'; end if;
  if msg.deleted then raise exception 'Messaggio eliminato'; end if;
  if msg.author_id <> v_uid then raise exception 'Solo l''autore può modificare il messaggio'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 4000 then raise exception 'Messaggio non valido'; end if;

  -- menzioni: replace totale, ricalcolate da zero
  v_mentions := public.chat_valid_mentions(msg.resource_type, msg.resource_id, p_mentions);

  update public.chat_messages set
    body = v_body,
    text_edited_at = now(),
    mentions = coalesce((select jsonb_agg(to_jsonb(mention_id::text)) from unnest(v_mentions) as mention_id), '[]'::jsonb)
  where id = p_id;

  perform public.push_chat_mention_alerts(msg.resource_type, msg.resource_id, v_mentions, v_uid);
  return public.get_chat_timeline(msg.resource_type, msg.resource_id);
end $$;

create function public.delete_chat_message(p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); msg public.chat_messages;
begin
  select * into msg from public.chat_messages where id = p_id for update;
  if not found then raise exception 'Messaggio non trovato'; end if;
  if msg.author_id <> v_uid then raise exception 'Solo l''autore può eliminare il messaggio'; end if;
  if not msg.deleted then
    -- soft-delete: la riga resta in timeline come tombstone
    update public.chat_messages
      set deleted = true, deleted_at = now(), deleted_by = v_uid,
          body = '', reactions = '[]'::jsonb, mentions = '[]'::jsonb
      where id = p_id;
  end if;
  return public.get_chat_timeline(msg.resource_type, msg.resource_id);
end $$;

create function public.set_chat_reaction(p_id bigint, p_type public.chat_reaction)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); msg public.chat_messages; v_new jsonb; v_had_same boolean;
begin
  select * into msg from public.chat_messages where id = p_id for update;
  if not found then raise exception 'Messaggio non trovato'; end if;
  if msg.deleted then raise exception 'Messaggio eliminato'; end if;
  -- nessun owner-check: la reazione è ammessa anche sui propri messaggi
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
  return public.get_chat_timeline(msg.resource_type, msg.resource_id);
end $$;

-- I menzionati ricevono l'avviso dedicato: escluderli dall'avviso generico di nuovo messaggio.
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
    select array_agg(distinct pid) into v_recipients from (
      select m.profile_id pid from public.tournament_team_members m
        join public.tournament_teams tt on tt.id = m.team_id
        where tt.tournament_id = new.resource_id and tt.status in ('proposed','confirmed','waitlisted') and m.status <> 'rejected'
      union
      select fp.profile_id from public.tournament_free_players fp
        where fp.tournament_id = new.resource_id and fp.status in ('active','waitlisted')
    ) s where not (s.pid = any(v_mentions));
    perform public.create_notifications(v_recipients, 'chat_message', null, new.resource_id, new.author_id, '{}'::jsonb);
  end if;
  return null;
end $$;

revoke all on function public.chat_valid_mentions(public.chat_resource, uuid, uuid[]) from public;
revoke all on function public.push_chat_mention_alerts(public.chat_resource, uuid, uuid[], uuid) from public;
revoke all on function public.get_chat_timeline(public.chat_resource, uuid) from public;
revoke all on function public.get_chat_mentionable(public.chat_resource, uuid) from public;
revoke all on function public.post_chat_message(public.chat_resource, uuid, text, bigint, uuid[]) from public;
revoke all on function public.edit_chat_message(bigint, text, uuid[]) from public;
revoke all on function public.delete_chat_message(bigint) from public;
revoke all on function public.set_chat_reaction(bigint, public.chat_reaction) from public;

grant execute on function
  public.get_chat_timeline(public.chat_resource, uuid),
  public.get_chat_mentionable(public.chat_resource, uuid),
  public.post_chat_message(public.chat_resource, uuid, text, bigint, uuid[]),
  public.edit_chat_message(bigint, text, uuid[]),
  public.delete_chat_message(bigint),
  public.set_chat_reaction(bigint, public.chat_reaction) to authenticated;

notify pgrst, 'reload schema';
