-- Batch: campi ereditati modificabili, fix amicizia, notifica chat, profilo
-- amico, livello svincolato dall'autovalutazione, richiesta cambio nome,
-- visibilità partite ristretta.

-- 1) Campi: anche gli ereditati (chi ha giocato lì) possono modificare/eliminare.
create or replace function public.can_access_court(p_court_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.courts c where c.id = p_court_id and (
      c.created_by = (select auth.uid())
      or exists (select 1 from public.matches m join public.match_participants mp on mp.match_id = m.id
                 where m.court_id = c.id and mp.profile_id = (select auth.uid()))
    )
  );
$$;

create or replace function public.update_court(
  p_court_id uuid, p_court_name text, p_indoor boolean, p_venue_name text, p_address text, p_city text
) returns void language plpgsql security definer set search_path = '' as $$
declare c public.courts;
begin
  select * into c from public.courts where id = p_court_id for update;
  if not found then raise exception 'Campo non trovato'; end if;
  if not public.can_access_court(p_court_id) then raise exception 'Campo non disponibile'; end if;
  if char_length(trim(p_court_name)) not between 1 and 80 or char_length(trim(p_venue_name)) not between 2 and 120
     or char_length(trim(p_address)) not between 3 and 180 or char_length(trim(p_city)) not between 2 and 100 then
    raise exception 'Dati del campo non validi';
  end if;
  update public.courts set name = trim(p_court_name), indoor = coalesce(p_indoor, false), updated_at = now() where id = p_court_id;
  update public.venues set name = trim(p_venue_name), address = trim(p_address), city = trim(p_city), updated_at = now() where id = c.venue_id;
end;
$$;

create or replace function public.delete_court(p_court_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.courts where id = p_court_id) then raise exception 'Campo non trovato'; end if;
  if not public.can_access_court(p_court_id) then raise exception 'Campo non disponibile'; end if;
  update public.courts set active = false, updated_at = now() where id = p_court_id;
end;
$$;

-- 2) Fix accettazione amicizia: cast esplicito all'enum.
create or replace function public.respond_friend_request(p_id bigint, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); f public.friendships;
begin
  select * into f from public.friendships where id = p_id for update;
  if not found then raise exception 'Richiesta non trovata'; end if;
  if f.addressee_id <> v_uid or f.status <> 'pending' then raise exception 'Richiesta non gestibile'; end if;
  update public.friendships
    set status = (case when p_accept then 'accepted' else 'declined' end)::public.friendship_status, responded_at = now()
  where id = p_id;
  if p_accept then
    perform public.create_notifications(array[f.requester_id], 'friend_request_accepted', null, null, v_uid, '{}'::jsonb);
  end if;
end;
$$;

-- 3) Notifica ai partecipanti quando arriva un messaggio in chat.
create or replace function public.notify_chat_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_recipients uuid[];
begin
  if new.resource_type = 'match' then
    select array_agg(distinct profile_id) into v_recipients from public.match_participants where match_id = new.resource_id;
    perform public.create_notifications(v_recipients, 'chat_message', new.resource_id, null, new.author_id, '{}'::jsonb);
  elsif new.resource_type = 'tournament' then
    select array_agg(distinct pid) into v_recipients from (
      select m.profile_id pid from public.tournament_team_members m
        join public.tournament_teams tt on tt.id = m.team_id
        where tt.tournament_id = new.resource_id and tt.status in ('proposed','confirmed','waitlisted') and m.status <> 'rejected'
      union
      select fp.profile_id from public.tournament_free_players fp
        where fp.tournament_id = new.resource_id and fp.status in ('active','waitlisted')
    ) s;
    perform public.create_notifications(v_recipients, 'chat_message', null, new.resource_id, new.author_id, '{}'::jsonb);
  end if;
  return null;
end;
$$;
drop trigger if exists chat_messages_notify on public.chat_messages;
create trigger chat_messages_notify after insert on public.chat_messages
for each row execute function public.notify_chat_message();

-- 4) Profilo base di un amico (o sé stesso / admin).
create or replace function public.get_friend_profile(p_id uuid)
returns table(id uuid, nome text, cognome text, livello smallint, affidabilita numeric, lato_preferito public.preferred_side, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nome, p.cognome, p.livello, p.affidabilita, p.lato_preferito, p.avatar_url
  from public.profiles p
  where p.id = p_id and (
    p_id = (select auth.uid()) or public.is_admin()
    or exists (select 1 from public.friendships f where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least((select auth.uid()), p_id)
      and greatest(f.requester_id, f.addressee_id) = greatest((select auth.uid()), p_id))
  );
$$;

-- 5) Livello svincolato dall'autovalutazione: solo media delle valutazioni ricevute.
create or replace function public.submit_match_rating(p_match_id uuid, p_rated_profile_id uuid, p_score smallint)
returns public.match_ratings language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  target_match public.matches;
  created_rating public.match_ratings;
  rating_average numeric;
  self_rating smallint;
  calculated_level smallint;
begin
  if actor_id is null or not public.is_active_user() then raise exception 'Profilo attivo richiesto'; end if;
  if p_score not between 1 and 7 or actor_id = p_rated_profile_id then raise exception 'Valutazione non valida'; end if;
  select * into target_match from public.matches where id = p_match_id;
  if not found or target_match.status <> 'completed' or target_match.completed_at is null then raise exception 'La partita non e conclusa'; end if;
  if now() > target_match.completed_at + interval '7 days' then raise exception 'La finestra di valutazione e chiusa'; end if;
  if not exists (select 1 from public.match_participants where match_id = p_match_id and profile_id = actor_id)
     or not exists (select 1 from public.match_participants where match_id = p_match_id and profile_id = p_rated_profile_id) then
    raise exception 'Puoi valutare solo i partecipanti'; end if;
  if exists (select 1 from public.match_attendance where match_id = p_match_id and profile_id in (actor_id, p_rated_profile_id) and status = 'no_show') then
    raise exception 'I no-show non possono inviare o ricevere valutazioni'; end if;

  insert into public.match_ratings (match_id, evaluator_id, rated_profile_id, score)
  values (p_match_id, actor_id, p_rated_profile_id, p_score) returning * into created_rating;

  select avg(score)::numeric into rating_average from public.match_ratings where rated_profile_id = p_rated_profile_id and valid;
  select autovalutazione into self_rating from public.profiles where id = p_rated_profile_id for update;
  -- Solo valutazioni ricevute: l'autovalutazione non incide sul livello.
  calculated_level := greatest(1, least(7, round(rating_average)::smallint));

  update public.profiles set livello = calculated_level where id = p_rated_profile_id;
  insert into public.profile_level_history (profile_id, autovalutazione, livello_calcolato, motivo)
  values (p_rated_profile_id, self_rating, calculated_level, 'valutazione_partita');
  return created_rating;
exception when unique_violation then raise exception 'Hai gia valutato questo giocatore';
end;
$$;

-- 6) Richiesta cambio nome: notifica agli admin.
create or replace function public.request_name_change(p_nome text, p_cognome text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_admins uuid[];
begin
  if v_uid is null or not public.is_active_user() then raise exception 'Profilo attivo richiesto'; end if;
  if char_length(trim(p_nome)) not between 1 and 80 or char_length(trim(p_cognome)) not between 1 and 80 then raise exception 'Dati non validi'; end if;
  select array_agg(id) into v_admins from public.profiles where ruolo = 'admin' and attivo;
  perform public.create_notifications(v_admins, 'name_change_request', null, null, v_uid,
    jsonb_build_object('nome', trim(p_nome), 'cognome', trim(p_cognome)));
end;
$$;

revoke all on function public.can_access_court(uuid) from public;
revoke all on function public.get_friend_profile(uuid) from public;
revoke all on function public.request_name_change(text, text) from public;
grant execute on function public.get_friend_profile(uuid), public.request_name_change(text, text) to authenticated;

-- 7) Visibilità partite: solo le proprie (partecipante/creatore); l'admin vede tutto.
create or replace function public.is_match_participant(p_match_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.match_participants where match_id = p_match_id and profile_id = (select auth.uid()));
$$;
revoke all on function public.is_match_participant(uuid) from public;
grant execute on function public.is_match_participant(uuid) to authenticated;

drop policy if exists "matches_select_active_users" on public.matches;
create policy "matches_select_visible" on public.matches for select to authenticated
using (
  public.is_active_user() and (
    public.is_admin() or creator_id = (select auth.uid()) or public.is_match_participant(id)
  )
);

notify pgrst, 'reload schema';
