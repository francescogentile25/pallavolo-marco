create or replace function public.list_invitable_players()
returns table (
  id uuid,
  nome text,
  cognome text,
  avatar_url text,
  livello smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_active_user() then
    raise exception 'Profilo attivo richiesto';
  end if;

  return query
  select p.id, p.nome, p.cognome, p.avatar_url, p.livello
  from public.profiles p
  where p.attivo = true
    and p.id <> (select auth.uid())
  order by lower(p.nome), lower(p.cognome), p.id;
end;
$$;

drop function if exists public.create_match(
  uuid,
  public.match_gender,
  smallint,
  smallint,
  timestamptz,
  smallint,
  smallint,
  text
);

create function public.create_match(
  p_court_id uuid,
  p_gender public.match_gender,
  p_min_level smallint,
  p_max_level smallint,
  p_starts_at timestamptz,
  p_duration_minutes smallint,
  p_capacity smallint,
  p_notes text default null,
  p_participant_ids uuid[] default array[]::uuid[]
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_level smallint;
  invited_ids uuid[];
  created_match public.matches;
begin
  if actor_id is null or not public.is_active_user() then
    raise exception 'Profilo attivo richiesto';
  end if;

  select coalesce(array_agg(candidate.id order by candidate.id), array[]::uuid[])
  into invited_ids
  from (
    select distinct supplied.id
    from unnest(coalesce(p_participant_ids, array[]::uuid[])) as supplied(id)
    where supplied.id is not null and supplied.id <> actor_id
  ) candidate;

  perform p.id
  from public.profiles p
  where p.id = actor_id or p.id = any(invited_ids)
  order by p.id
  for update;

  select livello into actor_level from public.profiles where id = actor_id;

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
     or p_starts_at <= now() + interval '15 minutes'
     or p_duration_minutes not between 30 and 360
     or p_capacity not between 2 and 12
     or char_length(coalesce(p_notes, '')) > 1000 then
    raise exception 'Dati partita non validi';
  end if;

  if actor_level not between p_min_level and p_max_level then
    raise exception 'Il tuo livello non rientra nella fascia scelta';
  end if;

  if cardinality(invited_ids) > p_capacity - 1 then
    raise exception 'Gli invitati superano i posti disponibili';
  end if;

  if (
    select count(*)
    from public.profiles p
    where p.id = any(invited_ids)
      and p.attivo = true
  ) <> cardinality(invited_ids) then
    raise exception 'Uno o piu giocatori invitati non sono disponibili';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = any(invited_ids)
      and p.livello not between p_min_level and p_max_level
  ) then
    raise exception 'Uno o piu giocatori invitati non rientrano nella fascia di livello';
  end if;

  if exists (
    select 1
    from public.matches m
    join public.match_participants mp on mp.match_id = m.id
    where mp.profile_id = actor_id
      and m.status in ('open', 'full', 'in_progress')
      and tstzrange(m.starts_at, m.starts_at + make_interval(mins => m.duration_minutes), '[)')
        && tstzrange(p_starts_at, p_starts_at + make_interval(mins => p_duration_minutes), '[)')
  ) then
    raise exception 'Hai gia una partita in questa fascia oraria';
  end if;

  if exists (
    select 1
    from public.matches m
    join public.match_participants mp on mp.match_id = m.id
    where mp.profile_id = any(invited_ids)
      and m.status in ('open', 'full', 'in_progress')
      and tstzrange(m.starts_at, m.starts_at + make_interval(mins => m.duration_minutes), '[)')
        && tstzrange(p_starts_at, p_starts_at + make_interval(mins => p_duration_minutes), '[)')
  ) then
    raise exception 'Uno o piu invitati hanno gia una partita in questa fascia oraria';
  end if;

  insert into public.matches (
    creator_id, court_id, status, gender, min_level, max_level,
    starts_at, duration_minutes, capacity, notes
  ) values (
    actor_id,
    p_court_id,
    case
      when cardinality(invited_ids) + 1 >= p_capacity then 'full'::public.match_status
      else 'open'::public.match_status
    end,
    p_gender,
    p_min_level,
    p_max_level,
    p_starts_at,
    p_duration_minutes,
    p_capacity,
    nullif(trim(p_notes), '')
  ) returning * into created_match;

  insert into public.match_participants (match_id, profile_id)
  select created_match.id, participant_id
  from unnest(array_prepend(actor_id, invited_ids)) as participant(participant_id);

  return created_match;
end;
$$;

revoke all on function public.list_invitable_players() from public;
revoke all on function public.create_match(
  uuid,
  public.match_gender,
  smallint,
  smallint,
  timestamptz,
  smallint,
  smallint,
  text,
  uuid[]
) from public;

grant execute on function public.list_invitable_players() to authenticated;
grant execute on function public.create_match(
  uuid,
  public.match_gender,
  smallint,
  smallint,
  timestamptz,
  smallint,
  smallint,
  text,
  uuid[]
) to authenticated;

comment on function public.list_invitable_players() is
  'Restituisce soltanto i dati pubblici minimi dei giocatori attivi invitabili.';
comment on function public.create_match(
  uuid,
  public.match_gender,
  smallint,
  smallint,
  timestamptz,
  smallint,
  smallint,
  text,
  uuid[]
) is 'Crea una partita e iscrive atomicamente organizzatore e giocatori invitati.';
