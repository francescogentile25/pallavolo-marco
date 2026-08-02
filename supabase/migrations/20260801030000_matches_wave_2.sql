create type public.match_status as enum (
  'draft',
  'open',
  'full',
  'in_progress',
  'completed',
  'cancelled'
);

create type public.match_gender as enum ('male', 'female', 'mixed');

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  address text not null check (char_length(trim(address)) between 3 and 180),
  city text not null check (char_length(trim(city)) between 2 and 100),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venues_coordinates_check check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

create unique index venues_identity_idx
  on public.venues (lower(name), lower(address), lower(city));

create table public.courts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 80),
  surface text not null default 'sabbia' check (char_length(trim(surface)) between 2 and 40),
  indoor boolean not null default false,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index courts_venue_name_idx on public.courts (venue_id, lower(name));
create index courts_venue_active_idx on public.courts (venue_id, active);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete restrict,
  court_id uuid not null references public.courts(id) on delete restrict,
  status public.match_status not null default 'open',
  gender public.match_gender not null,
  min_level smallint not null check (min_level between 1 and 7),
  max_level smallint not null check (max_level between 1 and 7),
  starts_at timestamptz not null,
  duration_minutes smallint not null check (duration_minutes between 30 and 360),
  capacity smallint not null default 4 check (capacity between 2 and 12),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_level_range_check check (min_level <= max_level)
);

create index matches_discovery_idx on public.matches (status, starts_at);
create index matches_court_starts_idx on public.matches (court_id, starts_at);
create index matches_creator_starts_idx on public.matches (creator_id, starts_at desc);

create table public.match_participants (
  match_id uuid not null references public.matches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  joined_at timestamptz not null default now(),
  primary key (match_id, profile_id)
);

create index match_participants_profile_idx
  on public.match_participants (profile_id, joined_at desc);

create trigger venues_set_updated_at
before update on public.venues
for each row execute procedure public.set_updated_at();

create trigger courts_set_updated_at
before update on public.courts
for each row execute procedure public.set_updated_at();

create trigger matches_set_updated_at
before update on public.matches
for each row execute procedure public.set_updated_at();

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and attivo = true
  );
$$;

revoke all on function public.is_active_user() from public;
grant execute on function public.is_active_user() to authenticated;

alter table public.venues enable row level security;
alter table public.courts enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;

create policy "venues_select_active_users"
on public.venues for select to authenticated
using (public.is_active_user() and active = true);

create policy "courts_select_active_users"
on public.courts for select to authenticated
using (public.is_active_user() and active = true);

create policy "matches_select_active_users"
on public.matches for select to authenticated
using (
  public.is_active_user()
  and (status <> 'draft' or creator_id = (select auth.uid()))
);

create policy "match_participants_select_visible_match"
on public.match_participants for select to authenticated
using (
  public.is_active_user()
  and exists (
    select 1 from public.matches
    where matches.id = match_participants.match_id
  )
);

grant select on public.venues, public.courts, public.matches, public.match_participants
  to authenticated;

create or replace function public.create_court_with_venue(
  p_venue_name text,
  p_address text,
  p_city text,
  p_court_name text,
  p_indoor boolean default false
)
returns public.courts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  venue_record public.venues;
  court_record public.courts;
begin
  if actor_id is null or not public.is_active_user() then
    raise exception 'Profilo attivo richiesto';
  end if;

  if char_length(trim(p_venue_name)) not between 2 and 120
     or char_length(trim(p_address)) not between 3 and 180
     or char_length(trim(p_city)) not between 2 and 100
     or char_length(trim(p_court_name)) not between 1 and 80 then
    raise exception 'Dati del campo non validi';
  end if;

  select * into venue_record
  from public.venues
  where lower(name) = lower(trim(p_venue_name))
    and lower(address) = lower(trim(p_address))
    and lower(city) = lower(trim(p_city));

  if not found then
    insert into public.venues (name, address, city, created_by)
    values (trim(p_venue_name), trim(p_address), trim(p_city), actor_id)
    returning * into venue_record;
  end if;

  select * into court_record
  from public.courts
  where venue_id = venue_record.id
    and lower(name) = lower(trim(p_court_name));

  if found then
    if not court_record.active then
      raise exception 'Il campo esiste ma non e attivo';
    end if;
    return court_record;
  end if;

  insert into public.courts (venue_id, name, indoor, created_by)
  values (venue_record.id, trim(p_court_name), coalesce(p_indoor, false), actor_id)
  returning * into court_record;

  return court_record;
end;
$$;

create or replace function public.create_match(
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
  actor_level smallint;
  created_match public.matches;
begin
  if actor_id is null or not public.is_active_user() then
    raise exception 'Profilo attivo richiesto';
  end if;

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

  insert into public.matches (
    creator_id, court_id, status, gender, min_level, max_level,
    starts_at, duration_minutes, capacity, notes
  ) values (
    actor_id, p_court_id, 'open', p_gender, p_min_level, p_max_level,
    p_starts_at, p_duration_minutes, p_capacity, nullif(trim(p_notes), '')
  ) returning * into created_match;

  insert into public.match_participants (match_id, profile_id)
  values (created_match.id, actor_id);

  return created_match;
end;
$$;

create or replace function public.join_match(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_level smallint;
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

  if not found then raise exception 'Partita non trovata'; end if;
  if target_match.status <> 'open' or target_match.starts_at <= now() then
    raise exception 'La partita non accetta nuove iscrizioni';
  end if;

  select livello into actor_level from public.profiles where id = actor_id;
  if actor_level not between target_match.min_level and target_match.max_level then
    raise exception 'Il tuo livello non rientra nella fascia ammessa';
  end if;

  if exists (
    select 1 from public.match_participants
    where match_id = p_match_id and profile_id = actor_id
  ) then
    raise exception 'Sei gia iscritto a questa partita';
  end if;

  if exists (
    select 1
    from public.matches m
    join public.match_participants mp on mp.match_id = m.id
    where mp.profile_id = actor_id
      and m.id <> p_match_id
      and m.status in ('open', 'full', 'in_progress')
      and tstzrange(m.starts_at, m.starts_at + make_interval(mins => m.duration_minutes), '[)')
        && tstzrange(target_match.starts_at, target_match.starts_at + make_interval(mins => target_match.duration_minutes), '[)')
  ) then
    raise exception 'Hai gia una partita in questa fascia oraria';
  end if;

  select count(*) into participant_count
  from public.match_participants where match_id = p_match_id;

  if participant_count >= target_match.capacity then
    update public.matches set status = 'full' where id = p_match_id returning * into target_match;
    raise exception 'La partita e al completo';
  end if;

  insert into public.match_participants (match_id, profile_id)
  values (p_match_id, actor_id);

  if participant_count + 1 >= target_match.capacity then
    update public.matches set status = 'full' where id = p_match_id returning * into target_match;
  end if;

  return target_match;
end;
$$;

create or replace function public.withdraw_from_match(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_match public.matches;
begin
  if actor_id is null or not public.is_active_user() then
    raise exception 'Profilo attivo richiesto';
  end if;

  select * into target_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Partita non trovata'; end if;
  if target_match.creator_id = actor_id then
    raise exception 'Il creatore deve annullare la partita';
  end if;
  if target_match.status not in ('open', 'full') or target_match.starts_at <= now() then
    raise exception 'Non puoi ritirarti da questa partita';
  end if;

  delete from public.match_participants
  where match_id = p_match_id and profile_id = actor_id;
  if not found then raise exception 'Non risulti iscritto a questa partita'; end if;

  if target_match.status = 'full' then
    update public.matches set status = 'open' where id = p_match_id returning * into target_match;
  end if;
  return target_match;
end;
$$;

create or replace function public.cancel_match(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_match public.matches;
begin
  select * into target_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Partita non trovata'; end if;
  if actor_id is null or target_match.creator_id <> actor_id then
    raise exception 'Solo il creatore puo annullare la partita';
  end if;
  if target_match.status not in ('draft', 'open', 'full') or target_match.starts_at <= now() then
    raise exception 'La partita non puo essere annullata';
  end if;
  update public.matches set status = 'cancelled' where id = p_match_id returning * into target_match;
  return target_match;
end;
$$;

create or replace function public.refresh_match_statuses()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Autenticazione richiesta'; end if;
  update public.matches
  set status = case
    when starts_at + make_interval(mins => duration_minutes) <= now() then 'completed'::public.match_status
    else 'in_progress'::public.match_status
  end
  where status in ('open', 'full', 'in_progress')
    and starts_at <= now();
end;
$$;

create or replace function public.get_match_participants(p_match_id uuid)
returns table (
  profile_id uuid,
  nome text,
  cognome text,
  avatar_url text,
  livello smallint,
  joined_at timestamptz,
  is_creator boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_user() or not exists (
    select 1 from public.matches m
    where m.id = p_match_id and (m.status <> 'draft' or m.creator_id = (select auth.uid()))
  ) then
    raise exception 'Partita non accessibile';
  end if;

  return query
  select p.id, p.nome, p.cognome, p.avatar_url, p.livello, mp.joined_at,
    p.id = m.creator_id
  from public.match_participants mp
  join public.profiles p on p.id = mp.profile_id
  join public.matches m on m.id = mp.match_id
  where mp.match_id = p_match_id
  order by (p.id = m.creator_id) desc, mp.joined_at;
end;
$$;

revoke all on function public.create_court_with_venue(text, text, text, text, boolean) from public;
revoke all on function public.create_match(uuid, public.match_gender, smallint, smallint, timestamptz, smallint, smallint, text) from public;
revoke all on function public.join_match(uuid) from public;
revoke all on function public.withdraw_from_match(uuid) from public;
revoke all on function public.cancel_match(uuid) from public;
revoke all on function public.refresh_match_statuses() from public;
revoke all on function public.get_match_participants(uuid) from public;

grant execute on function public.create_court_with_venue(text, text, text, text, boolean) to authenticated;
grant execute on function public.create_match(uuid, public.match_gender, smallint, smallint, timestamptz, smallint, smallint, text) to authenticated;
grant execute on function public.join_match(uuid) to authenticated;
grant execute on function public.withdraw_from_match(uuid) to authenticated;
grant execute on function public.cancel_match(uuid) to authenticated;
grant execute on function public.refresh_match_statuses() to authenticated;
grant execute on function public.get_match_participants(uuid) to authenticated;

alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.match_participants;

comment on function public.join_match(uuid) is
  'Serializza le iscrizioni sulla riga partita e impedisce overbooking, duplicati e sovrapposizioni.';
comment on function public.withdraw_from_match(uuid) is
  'Rimuove atomicamente un partecipante e riapre la partita se era completa.';
