-- La città scelta in registrazione segue lo stesso flusso del profilo: comune
-- canonico, coordinate per il meteo e identificativo condiviso per la vicinanza.
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
begin
  -- Le creazioni amministrative esistenti non passano dalla registrazione e
  -- possono non avere una città. Se uno dei dati è presente, però, il comune
  -- deve essere completo e coerente.
  if num_nonnulls(selected_city, selected_latitude, selected_longitude, selected_place_id) not in (0, 4)
     or (selected_city is not null and char_length(selected_city) > 120)
     or (selected_latitude is not null and selected_latitude not between -90 and 90)
     or (selected_longitude is not null and selected_longitude not between -180 and 180)
     or (selected_place_id is not null and selected_place_id <= 0) then
    raise exception 'Città non valida';
  end if;

  insert into public.profiles (
    id, nome, cognome, email,
    city, city_latitude, city_longitude, city_place_id
  )
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''), 'Giocatore'),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'cognome'), ''), 'Beach Volley'),
    coalesce(new.email, ''),
    selected_city, selected_latitude, selected_longitude, selected_place_id
  );
  return new;
end;
$$;
