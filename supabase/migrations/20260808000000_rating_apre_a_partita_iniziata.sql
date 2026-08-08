-- I voti erano legati alla chiusura della partita, che solo l'organizzatore puo
-- fare: se non la chiudeva, i compagni non riuscivano piu a valutarsi. Ora si
-- vota gia a partita in corso e la finestra di sette giorni parte dalla
-- chiusura quando c'e, altrimenti dall'orario di inizio.
create or replace function public.submit_match_rating(p_match_id uuid, p_rated_profile_id uuid, p_score smallint)
returns match_ratings
language plpgsql
security definer
set search_path to ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_match public.matches;
  created_rating public.match_ratings;
  rating_average numeric;
  self_rating smallint;
  calculated_level smallint;
  window_start timestamptz;
begin
  if actor_id is null or not public.is_active_user() then raise exception 'Profilo attivo richiesto'; end if;
  if p_score not between 1 and 7 or actor_id = p_rated_profile_id then raise exception 'Valutazione non valida'; end if;
  select * into target_match from public.matches where id = p_match_id;
  if not found or target_match.status not in ('in_progress', 'completed') then raise exception 'La partita non e ancora cominciata'; end if;
  window_start := coalesce(target_match.completed_at, target_match.starts_at);
  if now() > window_start + interval '7 days' then raise exception 'La finestra di valutazione e chiusa'; end if;
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
