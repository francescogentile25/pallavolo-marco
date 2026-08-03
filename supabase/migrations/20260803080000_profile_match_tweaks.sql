-- Ritocchi: durata partita opzionale (non definita), chiusura anche prima della
-- fine (basta che sia iniziata), nome/cognome modificabili solo dall'admin.

alter table public.matches alter column duration_minutes drop not null;

-- create_match: durata opzionale; overlap calcolati con durata di default 90 se assente.
create or replace function public.create_match(
  p_court_id uuid, p_gender public.match_gender, p_min_level smallint, p_max_level smallint,
  p_starts_at timestamptz, p_duration_minutes smallint, p_capacity smallint,
  p_notes text default null, p_participant_ids uuid[] default array[]::uuid[]
) returns public.matches language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  actor_level smallint;
  invited_ids uuid[];
  created_match public.matches;
begin
  if actor_id is null or not public.is_active_user() then raise exception 'Profilo attivo richiesto'; end if;

  select coalesce(array_agg(candidate.id order by candidate.id), array[]::uuid[]) into invited_ids
  from (select distinct supplied.id from unnest(coalesce(p_participant_ids, array[]::uuid[])) as supplied(id)
        where supplied.id is not null and supplied.id <> actor_id) candidate;

  perform p.id from public.profiles p where p.id = actor_id or p.id = any(invited_ids) order by p.id for update;
  select livello into actor_level from public.profiles where id = actor_id;

  if p_court_id is null
     or not exists (select 1 from public.courts c join public.venues v on v.id = c.venue_id
                    where c.id = p_court_id and c.active and v.active)
     or p_gender is null or p_min_level not between 1 and 7 or p_max_level not between 1 and 7
     or p_min_level > p_max_level or p_starts_at <= now() + interval '15 minutes'
     or (p_duration_minutes is not null and p_duration_minutes not between 30 and 360)
     or p_capacity not between 2 and 12 or char_length(coalesce(p_notes, '')) > 1000 then
    raise exception 'Dati partita non validi';
  end if;
  if actor_level not between p_min_level and p_max_level then raise exception 'Il tuo livello non rientra nella fascia scelta'; end if;
  if cardinality(invited_ids) > p_capacity - 1 then raise exception 'Gli invitati superano i posti disponibili'; end if;
  if (select count(*) from public.profiles p where p.id = any(invited_ids) and p.attivo = true) <> cardinality(invited_ids) then
    raise exception 'Uno o piu giocatori invitati non sono disponibili'; end if;
  if exists (select 1 from public.profiles p where p.id = any(invited_ids) and p.livello not between p_min_level and p_max_level) then
    raise exception 'Uno o piu giocatori invitati non rientrano nella fascia di livello'; end if;

  if exists (
    select 1 from public.matches m join public.match_participants mp on mp.match_id = m.id
    where mp.profile_id = actor_id and m.status in ('open','full','in_progress')
      and tstzrange(m.starts_at, m.starts_at + make_interval(mins => coalesce(m.duration_minutes, 90)), '[)')
        && tstzrange(p_starts_at, p_starts_at + make_interval(mins => coalesce(p_duration_minutes, 90)), '[)')
  ) then raise exception 'Hai gia una partita in questa fascia oraria'; end if;
  if exists (
    select 1 from public.matches m join public.match_participants mp on mp.match_id = m.id
    where mp.profile_id = any(invited_ids) and m.status in ('open','full','in_progress')
      and tstzrange(m.starts_at, m.starts_at + make_interval(mins => coalesce(m.duration_minutes, 90)), '[)')
        && tstzrange(p_starts_at, p_starts_at + make_interval(mins => coalesce(p_duration_minutes, 90)), '[)')
  ) then raise exception 'Uno o piu invitati hanno gia una partita in questa fascia oraria'; end if;

  insert into public.matches (creator_id, court_id, status, gender, min_level, max_level, starts_at, duration_minutes, capacity, notes)
  values (actor_id, p_court_id,
    case when cardinality(invited_ids) + 1 >= p_capacity then 'full'::public.match_status else 'open'::public.match_status end,
    p_gender, p_min_level, p_max_level, p_starts_at, p_duration_minutes, p_capacity, nullif(trim(p_notes), ''))
  returning * into created_match;

  insert into public.match_participants (match_id, profile_id)
  select created_match.id, participant_id from unnest(array_prepend(actor_id, invited_ids)) as participant(participant_id);
  return created_match;
end;
$$;

create or replace function public.update_match(
  p_match_id uuid, p_court_id uuid, p_gender public.match_gender, p_min_level smallint, p_max_level smallint,
  p_starts_at timestamptz, p_duration_minutes smallint, p_capacity smallint, p_notes text default null
) returns public.matches language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); target_match public.matches; participant_count integer;
begin
  if actor_id is null or not public.is_active_user() then raise exception 'Profilo attivo richiesto'; end if;
  select * into target_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Partita non trovata'; end if;
  if target_match.creator_id <> actor_id then raise exception 'Solo il creatore puo modificare la partita'; end if;
  if target_match.status not in ('open','full') or target_match.starts_at <= now() then raise exception 'La partita non puo piu essere modificata'; end if;

  if p_court_id is null
     or not exists (select 1 from public.courts c join public.venues v on v.id = c.venue_id
                    where c.id = p_court_id and c.active and v.active)
     or p_gender is null or p_min_level not between 1 and 7 or p_max_level not between 1 and 7
     or p_min_level > p_max_level or p_starts_at <= now()
     or (p_duration_minutes is not null and p_duration_minutes not between 30 and 360)
     or p_capacity not between 2 and 12 or char_length(coalesce(p_notes, '')) > 1000 then
    raise exception 'Dati partita non validi';
  end if;

  perform p.id from public.profiles p join public.match_participants mp on mp.profile_id = p.id
    where mp.match_id = p_match_id order by p.id for update of p;
  select count(*) into participant_count from public.match_participants where match_id = p_match_id;
  if participant_count > p_capacity then raise exception 'La capienza non puo essere inferiore ai partecipanti attuali'; end if;
  if exists (select 1 from public.match_participants mp join public.profiles p on p.id = mp.profile_id
             where mp.match_id = p_match_id and p.livello not between p_min_level and p_max_level) then
    raise exception 'La fascia di livello esclude uno o piu partecipanti'; end if;

  if exists (
    select 1 from public.match_participants target_participant
    join public.match_participants other_participant on other_participant.profile_id = target_participant.profile_id
    join public.matches other_match on other_match.id = other_participant.match_id
    where target_participant.match_id = p_match_id and other_match.id <> p_match_id
      and other_match.status in ('open','full','in_progress')
      and tstzrange(other_match.starts_at, other_match.starts_at + make_interval(mins => coalesce(other_match.duration_minutes, 90)), '[)')
        && tstzrange(p_starts_at, p_starts_at + make_interval(mins => coalesce(p_duration_minutes, 90)), '[)')
  ) then raise exception 'Il nuovo orario si sovrappone a un impegno di uno o piu partecipanti'; end if;

  update public.matches set court_id = p_court_id,
    status = case when participant_count >= p_capacity then 'full'::public.match_status else 'open'::public.match_status end,
    gender = p_gender, min_level = p_min_level, max_level = p_max_level, starts_at = p_starts_at,
    duration_minutes = p_duration_minutes, capacity = p_capacity, notes = nullif(trim(p_notes), '')
  where id = p_match_id returning * into target_match;
  return target_match;
end;
$$;

-- close_match: consenti la chiusura una volta iniziata (anche prima della fine).
create or replace function public.close_match(p_match_id uuid)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); target_match public.matches;
begin
  select * into target_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Partita non trovata'; end if;
  if actor_id is null or target_match.creator_id <> actor_id then raise exception 'Solo il creatore puo chiudere la partita'; end if;
  if target_match.status not in ('open','full','in_progress') or target_match.starts_at > now() then
    raise exception 'La partita non puo ancora essere chiusa';
  end if;
  update public.matches set status = 'completed', completed_at = now() where id = p_match_id returning * into target_match;
  insert into public.match_attendance (match_id, profile_id)
  select match_id, profile_id from public.match_participants where match_id = p_match_id
  on conflict (match_id, profile_id) do nothing;
  return target_match;
end;
$$;

-- update_my_profile: nome/cognome modificabili solo dall'admin (per gli altri restano invariati).
create or replace function public.update_my_profile(
  p_nome text, p_cognome text, p_lato_preferito public.preferred_side, p_avatar_url text, p_autovalutazione smallint
) returns public.profiles language plpgsql security definer set search_path = '' as $$
declare
  current_profile public.profiles;
  updated_profile public.profiles;
  is_admin_user boolean := public.is_admin();
  normalized_avatar_url text := nullif(trim(p_avatar_url), '');
begin
  if (select auth.uid()) is null then raise exception 'Autenticazione richiesta'; end if;
  if p_autovalutazione is null or p_lato_preferito is null or p_autovalutazione not between 1 and 7
     or (is_admin_user and (p_nome is null or p_cognome is null
        or char_length(trim(p_nome)) not between 1 and 80 or char_length(trim(p_cognome)) not between 1 and 80))
     or (normalized_avatar_url is not null and (char_length(normalized_avatar_url) > 2048 or normalized_avatar_url !~* '^https://')) then
    raise exception 'Dati profilo non validi';
  end if;

  select * into current_profile from public.profiles where id = (select auth.uid()) for update;
  if not found then raise exception 'Profilo non trovato'; end if;

  update public.profiles set
    nome = case when is_admin_user then trim(p_nome) else nome end,
    cognome = case when is_admin_user then trim(p_cognome) else cognome end,
    lato_preferito = p_lato_preferito,
    avatar_url = normalized_avatar_url,
    autovalutazione = p_autovalutazione
  where id = (select auth.uid()) returning * into updated_profile;

  if current_profile.autovalutazione is distinct from p_autovalutazione then
    insert into public.profile_level_history (profile_id, autovalutazione, livello_calcolato, motivo)
    values (updated_profile.id, updated_profile.autovalutazione, updated_profile.livello, 'autovalutazione_aggiornata');
  end if;
  return updated_profile;
end;
$$;

-- L'admin può correggere nome/cognome di qualunque utente (su richiesta).
create or replace function public.admin_update_profile_name(p_profile_id uuid, p_nome text, p_cognome text)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare updated public.profiles;
begin
  if not public.is_admin() then raise exception 'Permesso amministratore richiesto'; end if;
  if char_length(trim(p_nome)) not between 1 and 80 or char_length(trim(p_cognome)) not between 1 and 80 then
    raise exception 'Dati non validi'; end if;
  update public.profiles set nome = trim(p_nome), cognome = trim(p_cognome) where id = p_profile_id returning * into updated;
  if not found then raise exception 'Profilo non trovato'; end if;
  return updated;
end;
$$;

revoke all on function public.admin_update_profile_name(uuid, text, text) from public;
grant execute on function public.admin_update_profile_name(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
