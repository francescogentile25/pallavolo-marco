-- Distingue un profilo ancora da completare da uno completo in attesa
-- dell'approvazione amministrativa. Gli account gia attivi e le registrazioni
-- che hanno gia una citta vengono considerati completi.
alter table public.profiles
  add column if not exists registration_completed_at timestamptz;

update public.profiles
set registration_completed_at = coalesce(registration_completed_at, created_at)
where registration_completed_at is null
  and (attivo or city is not null);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_city text := nullif(btrim(new.raw_user_meta_data ->> 'city'), '');
  selected_latitude double precision := (new.raw_user_meta_data ->> 'city_latitude')::double precision;
  selected_longitude double precision := (new.raw_user_meta_data ->> 'city_longitude')::double precision;
  selected_place_id bigint := (new.raw_user_meta_data ->> 'city_place_id')::bigint;
  selected_nome text := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'given_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    'Giocatore'
  );
  selected_cognome text := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'cognome'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'family_name'), ''),
    'Google'
  );
  city_is_complete boolean;
begin
  city_is_complete := num_nonnulls(
    selected_city, selected_latitude, selected_longitude, selected_place_id
  ) = 4;

  if num_nonnulls(selected_city, selected_latitude, selected_longitude, selected_place_id) not in (0, 4)
     or (selected_city is not null and char_length(selected_city) > 120)
     or (selected_latitude is not null and selected_latitude not between -90 and 90)
     or (selected_longitude is not null and selected_longitude not between -180 and 180)
     or (selected_place_id is not null and selected_place_id <= 0) then
    raise exception 'Citta non valida';
  end if;

  insert into public.profiles (
    id, nome, cognome, email,
    city, city_latitude, city_longitude, city_place_id,
    registration_completed_at
  )
  values (
    new.id,
    left(selected_nome, 80),
    left(selected_cognome, 80),
    coalesce(new.email, ''),
    selected_city, selected_latitude, selected_longitude, selected_place_id,
    case when city_is_complete then now() else null end
  );
  return new;
end;
$$;

create or replace function public.complete_my_registration(
  p_nome text,
  p_cognome text,
  p_city text,
  p_latitude double precision,
  p_longitude double precision,
  p_place_id bigint
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_profile public.profiles;
  updated_profile public.profiles;
begin
  if actor_id is null then raise exception 'Autenticazione richiesta'; end if;

  select * into current_profile
  from public.profiles
  where id = actor_id
  for update;

  if not found then raise exception 'Profilo non trovato'; end if;
  if current_profile.attivo then raise exception 'Il profilo e gia attivo'; end if;
  if current_profile.registration_completed_at is not null then
    raise exception 'La registrazione e gia completa';
  end if;

  if char_length(btrim(coalesce(p_nome, ''))) not between 1 and 80
     or char_length(btrim(coalesce(p_cognome, ''))) not between 1 and 80
     or char_length(btrim(coalesce(p_city, ''))) not between 1 and 120
     or p_latitude is null or p_latitude not between -90 and 90
     or p_longitude is null or p_longitude not between -180 and 180
     or p_place_id is null or p_place_id <= 0 then
    raise exception 'Dati di registrazione non validi';
  end if;

  update public.profiles set
    nome = btrim(p_nome),
    cognome = btrim(p_cognome),
    city = btrim(p_city),
    city_latitude = p_latitude,
    city_longitude = p_longitude,
    city_place_id = p_place_id,
    registration_completed_at = now()
  where id = actor_id
  returning * into updated_profile;

  return updated_profile;
end;
$$;

revoke all on function public.complete_my_registration(
  text, text, text, double precision, double precision, bigint
) from public;
grant execute on function public.complete_my_registration(
  text, text, text, double precision, double precision, bigint
) to authenticated;

create or replace function public.admin_update_profile_access(
  p_profile_id uuid,
  p_attivo boolean,
  p_ruolo public.user_role
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_profile public.profiles;
  updated_profile public.profiles;
begin
  if actor_id is null or not public.is_admin() then
    raise exception 'Operazione riservata agli amministratori';
  end if;
  if p_profile_id is null or p_attivo is null or p_ruolo is null then
    raise exception 'Dati amministrativi non validi';
  end if;

  select * into current_profile
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then raise exception 'Profilo non trovato'; end if;
  if p_attivo and current_profile.registration_completed_at is null then
    raise exception 'La registrazione deve essere completata prima dell attivazione';
  end if;
  if p_profile_id = actor_id
     and (current_profile.attivo is distinct from p_attivo
       or current_profile.ruolo is distinct from p_ruolo) then
    raise exception 'Non puoi modificare il tuo accesso amministrativo';
  end if;
  if current_profile.attivo is not distinct from p_attivo
     and current_profile.ruolo is not distinct from p_ruolo then
    return current_profile;
  end if;

  update public.profiles
  set attivo = p_attivo, ruolo = p_ruolo
  where id = p_profile_id
  returning * into updated_profile;

  insert into public.profile_admin_audit (
    target_profile_id, actor_profile_id, previous_role, new_role,
    previous_active, new_active
  ) values (
    p_profile_id, actor_id, current_profile.ruolo, updated_profile.ruolo,
    current_profile.attivo, updated_profile.attivo
  );

  return updated_profile;
end;
$$;

comment on function public.complete_my_registration(
  text, text, text, double precision, double precision, bigint
) is 'Completa una sola volta il profilo creato tramite OAuth prima dell approvazione amministrativa.';
