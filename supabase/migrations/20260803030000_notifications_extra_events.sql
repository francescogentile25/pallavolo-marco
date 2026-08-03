-- Onda 5 — copertura eventi aggiuntivi: invito diretto in partita, valutazione
-- ricevuta, no-show segnalato, promozione da lista d'attesa, risultato torneo
-- in attesa di conferma.

-- Partite: distingue auto-iscrizione (notifica il creatore) da giocatore
-- aggiunto dal creatore (notifica il giocatore invitato).
create or replace function public.notify_match_join()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_creator uuid; v_actor uuid := (select auth.uid());
begin
  select creator_id into v_creator from public.matches where id = new.match_id;
  if v_actor is not null and new.profile_id <> v_actor then
    perform public.create_notifications(array[new.profile_id], 'match_invited',
      new.match_id, null, v_actor, '{}'::jsonb);
  else
    perform public.create_notifications(array[v_creator], 'match_participant_joined',
      new.match_id, null, new.profile_id, '{}'::jsonb);
  end if;
  return null;
end $$;

-- Partite: valutazione ricevuta (anonima, nessun attore mostrato)
create or replace function public.notify_match_rating()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.valid, true) then
    perform public.create_notifications(array[new.rated_profile_id], 'match_rating_received',
      new.match_id, null, null, '{}'::jsonb);
  end if;
  return null;
end $$;
create trigger match_ratings_notify after insert on public.match_ratings
for each row execute function public.notify_match_rating();

-- Partite: no-show segnalato -> notifica al giocatore
create or replace function public.notify_match_no_show()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'no_show' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.create_notifications(array[new.profile_id], 'match_no_show_reported',
      new.match_id, null, new.reported_by, jsonb_build_object('reason', new.reason));
  end if;
  return null;
end $$;
create trigger match_attendance_notify_no_show after insert or update of status on public.match_attendance
for each row execute function public.notify_match_no_show();

-- Tornei: promozione dalla lista d'attesa -> notifica alla coppia promossa
create or replace function public.notify_tournament_waitlist()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_recipients uuid[];
begin
  if old.status = 'waitlisted' and new.status = 'confirmed' then
    select array_agg(profile_id) into v_recipients
    from public.tournament_team_members where team_id = new.id and status = 'accepted';
    perform public.create_notifications(v_recipients, 'tournament_waitlist_promoted',
      null, new.tournament_id, v_actor, '{}'::jsonb);
  end if;
  return null;
end $$;
create trigger tournament_teams_notify_waitlist after update of status on public.tournament_teams
for each row execute function public.notify_tournament_waitlist();

-- Tornei: risultato registrato o in attesa di conferma -> notifica alle due coppie
create or replace function public.notify_tournament_result()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_recipients uuid[]; v_type public.notification_type;
begin
  if new.status is distinct from old.status and new.status in ('completed','pending_confirmation') then
    v_type := case when new.status = 'completed' then 'tournament_result_recorded'
                   else 'tournament_result_pending' end;
    select array_agg(distinct m.profile_id) into v_recipients
    from public.tournament_team_members m
    where m.team_id in (new.team1_id, new.team2_id) and m.status = 'accepted';
    perform public.create_notifications(v_recipients, v_type,
      null, new.tournament_id, v_actor, jsonb_build_object('game_id', new.id));
  end if;
  return null;
end $$;

-- Hardening: le nuove funzioni trigger non devono essere invocabili come RPC
revoke all on function public.notify_match_join() from public;
revoke all on function public.notify_match_rating() from public;
revoke all on function public.notify_match_no_show() from public;
revoke all on function public.notify_tournament_waitlist() from public;
revoke all on function public.notify_tournament_result() from public;

notify pgrst, 'reload schema';
