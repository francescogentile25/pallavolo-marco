create or replace function public.update_match(
  p_match_id uuid,
  p_court_id uuid,
  p_gender public.match_gender,
  p_min_level smallint,
  p_max_level smallint,
  p_starts_at timestamptz,
  p_duration_minutes smallint,
  p_capacity smallint,
  p_notes text default null
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_match public.matches;
  participant_count integer;
begin
  if actor_id is null or not public.is_active_user() then
    raise exception 'Profilo attivo richiesto';
  end if;

  select * into target_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Partita non trovata';
  end if;
  if target_match.creator_id <> actor_id then
    raise exception 'Solo il creatore puo modificare la partita';
  end if;
  if target_match.status not in ('open', 'full') or target_match.starts_at <= now() then
    raise exception 'La partita non puo piu essere modificata';
  end if;

  if p_court_id is null
     or not exists (
       select 1 from public.courts c
       join public.venues v on v.id = c.venue_id
       where c.id = p_court_id and c.active and v.active
     )
     or p_gender is null
     or p_min_level not between 1 and 7
     or p_max_level not between 1 and 7
     or p_min_level > p_max_level
     or p_starts_at <= now()
     or p_duration_minutes not between 30 and 360
     or p_capacity not between 2 and 12
     or char_length(coalesce(p_notes, '')) > 1000 then
    raise exception 'Dati partita non validi';
  end if;

  perform p.id
  from public.profiles p
  join public.match_participants mp on mp.profile_id = p.id
  where mp.match_id = p_match_id
  order by p.id
  for update of p;

  select count(*) into participant_count
  from public.match_participants
  where match_id = p_match_id;

  if participant_count > p_capacity then
    raise exception 'La capienza non puo essere inferiore ai partecipanti attuali';
  end if;

  if exists (
    select 1
    from public.match_participants mp
    join public.profiles p on p.id = mp.profile_id
    where mp.match_id = p_match_id
      and p.livello not between p_min_level and p_max_level
  ) then
    raise exception 'La fascia di livello esclude uno o piu partecipanti';
  end if;

  if exists (
    select 1
    from public.match_participants target_participant
    join public.match_participants other_participant
      on other_participant.profile_id = target_participant.profile_id
    join public.matches other_match on other_match.id = other_participant.match_id
    where target_participant.match_id = p_match_id
      and other_match.id <> p_match_id
      and other_match.status in ('open', 'full', 'in_progress')
      and tstzrange(
        other_match.starts_at,
        other_match.starts_at + make_interval(mins => other_match.duration_minutes),
        '[)'
      ) && tstzrange(
        p_starts_at,
        p_starts_at + make_interval(mins => p_duration_minutes),
        '[)'
      )
  ) then
    raise exception 'Il nuovo orario si sovrappone a un impegno di uno o piu partecipanti';
  end if;

  update public.matches
  set court_id = p_court_id,
      status = case
        when participant_count >= p_capacity then 'full'::public.match_status
        else 'open'::public.match_status
      end,
      gender = p_gender,
      min_level = p_min_level,
      max_level = p_max_level,
      starts_at = p_starts_at,
      duration_minutes = p_duration_minutes,
      capacity = p_capacity,
      notes = nullif(trim(p_notes), '')
  where id = p_match_id
  returning * into target_match;

  return target_match;
end;
$$;

revoke all on function public.update_match(
  uuid,
  uuid,
  public.match_gender,
  smallint,
  smallint,
  timestamptz,
  smallint,
  smallint,
  text
) from public;

grant execute on function public.update_match(
  uuid,
  uuid,
  public.match_gender,
  smallint,
  smallint,
  timestamptz,
  smallint,
  smallint,
  text
) to authenticated;

comment on function public.update_match(
  uuid,
  uuid,
  public.match_gender,
  smallint,
  smallint,
  timestamptz,
  smallint,
  smallint,
  text
) is 'Modifica una partita futura preservando capienza, livelli e disponibilita dei partecipanti.';
