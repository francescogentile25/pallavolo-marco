-- I comuni smettono di essere testo libero: ogni luogo porta con se
-- l'identificativo geonames scelto in fase di inserimento, piu le coordinate.
-- Cosi due utenti che scrivono "Roma" indicano lo stesso comune, il confronto
-- fra partite e tornei e affidabile e il meteo usa gli stessi punti.

alter table public.profiles add column if not exists city_place_id bigint;
alter table public.venues add column if not exists place_id bigint;
alter table public.tournaments
  add column if not exists city_place_id bigint,
  add column if not exists city_latitude double precision,
  add column if not exists city_longitude double precision;

create index if not exists venues_place_id_idx on public.venues (place_id);
create index if not exists tournaments_city_place_id_idx on public.tournaments (city_place_id);

alter table public.tournaments drop constraint if exists tournaments_city_coords_check;
alter table public.tournaments add constraint tournaments_city_coords_check check (
  (city_latitude is null) = (city_longitude is null)
  and (city_latitude is null or city_latitude between -90 and 90)
  and (city_longitude is null or city_longitude between -180 and 180)
);

-- ---- citta del profilo, ora con identificativo del comune ----
drop function if exists public.set_my_city(text, double precision, double precision);

create or replace function public.set_my_city(
  p_city text,
  p_latitude double precision,
  p_longitude double precision,
  p_place_id bigint default null
)
returns public.profiles
language plpgsql
security definer
set search_path to ''
as $$
declare
  updated_profile public.profiles;
  normalized_city text := nullif(btrim(coalesce(p_city, '')), '');
begin
  if (select auth.uid()) is null then raise exception 'Autenticazione richiesta'; end if;

  if normalized_city is not null and (
       p_latitude is null or p_longitude is null
       or p_latitude not between -90 and 90
       or p_longitude not between -180 and 180
       or char_length(normalized_city) > 120
     ) then
    raise exception 'Citta non valida';
  end if;

  update public.profiles set
    city = normalized_city,
    city_latitude = case when normalized_city is null then null else p_latitude end,
    city_longitude = case when normalized_city is null then null else p_longitude end,
    city_place_id = case when normalized_city is null then null else p_place_id end
  where id = (select auth.uid())
  returning * into updated_profile;

  if not found then raise exception 'Profilo non trovato'; end if;
  return updated_profile;
end;
$$;

revoke all on function public.set_my_city(text, double precision, double precision, bigint) from public;
grant execute on function public.set_my_city(text, double precision, double precision, bigint) to authenticated;

-- ---- sede del campo: il comune arriva dalla stessa anagrafica ----
drop function if exists public.create_court_with_venue(text, text, text, text, boolean);

create or replace function public.create_court_with_venue(
  p_venue_name text,
  p_address text,
  p_city text,
  p_court_name text,
  p_indoor boolean default false,
  p_place_id bigint default null,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns public.courts
language plpgsql
security definer
set search_path to ''
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

  select * into venue_record from public.venues
  where lower(name) = lower(trim(p_venue_name))
    and lower(address) = lower(trim(p_address))
    and lower(city) = lower(trim(p_city))
    and created_by = actor_id;
  if not found then
    insert into public.venues (name, address, city, created_by, place_id, latitude, longitude)
    values (trim(p_venue_name), trim(p_address), trim(p_city), actor_id, p_place_id, p_latitude, p_longitude)
    returning * into venue_record;
  elsif p_place_id is not null and venue_record.place_id is distinct from p_place_id then
    -- La sede esisteva da prima dell'anagrafica: la completiamo alla prima occasione.
    update public.venues set place_id = p_place_id, latitude = p_latitude, longitude = p_longitude
    where id = venue_record.id returning * into venue_record;
  end if;

  select * into court_record from public.courts
  where venue_id = venue_record.id
    and lower(name) = lower(trim(p_court_name))
    and created_by = actor_id;
  if found then
    if not court_record.active then
      update public.courts set active = true, indoor = coalesce(p_indoor, false), updated_at = now()
      where id = court_record.id returning * into court_record;
    end if;
    return court_record;
  end if;

  insert into public.courts (venue_id, name, indoor, created_by)
  values (venue_record.id, trim(p_court_name), coalesce(p_indoor, false), actor_id)
  returning * into court_record;
  return court_record;
end;
$$;

revoke all on function public.create_court_with_venue(text, text, text, text, boolean, bigint, double precision, double precision) from public;
grant execute on function public.create_court_with_venue(text, text, text, text, boolean, bigint, double precision, double precision) to authenticated;

-- ---- citta del torneo ----
create or replace function public.set_tournament_city(
  p_tournament_id uuid,
  p_city text,
  p_place_id bigint,
  p_latitude double precision,
  p_longitude double precision
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
  normalized_city text := nullif(btrim(coalesce(p_city, '')), '');
begin
  if normalized_city is not null and (
       p_latitude is null or p_longitude is null
       or p_latitude not between -90 and 90
       or p_longitude not between -180 and 180
     ) then
    raise exception 'Citta non valida';
  end if;

  update public.tournaments set
    city = normalized_city,
    city_place_id = case when normalized_city is null then null else p_place_id end,
    city_latitude = case when normalized_city is null then null else p_latitude end,
    city_longitude = case when normalized_city is null then null else p_longitude end
  where id = target.id;
end;
$$;

revoke all on function public.set_tournament_city(uuid, text, bigint, double precision, double precision) from public;
grant execute on function public.set_tournament_city(uuid, text, bigint, double precision, double precision) to authenticated;

-- ---- modifica di un campo esistente ----
drop function if exists public.update_court(uuid, text, boolean, text, text, text);

create or replace function public.update_court(
  p_court_id uuid,
  p_court_name text,
  p_indoor boolean,
  p_venue_name text,
  p_address text,
  p_city text,
  p_place_id bigint default null,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare c public.courts;
begin
  select * into c from public.courts where id = p_court_id for update;
  if not found then raise exception 'Campo non trovato'; end if;
  if not public.can_access_court(p_court_id) then raise exception 'Campo non disponibile'; end if;
  if char_length(trim(p_court_name)) not between 1 and 80 or char_length(trim(p_venue_name)) not between 2 and 120
     or char_length(trim(p_address)) not between 3 and 180 or char_length(trim(p_city)) not between 2 and 100 then
    raise exception 'Dati del campo non validi';
  end if;

  update public.courts set name = trim(p_court_name), indoor = coalesce(p_indoor, false), updated_at = now()
  where id = p_court_id;

  update public.venues set
    name = trim(p_venue_name),
    address = trim(p_address),
    city = trim(p_city),
    place_id = coalesce(p_place_id, place_id),
    latitude = coalesce(p_latitude, latitude),
    longitude = coalesce(p_longitude, longitude),
    updated_at = now()
  where id = c.venue_id;
end;
$$;

revoke all on function public.update_court(uuid, text, boolean, text, text, text, bigint, double precision, double precision) from public;
grant execute on function public.update_court(uuid, text, boolean, text, text, text, bigint, double precision, double precision) to authenticated;
