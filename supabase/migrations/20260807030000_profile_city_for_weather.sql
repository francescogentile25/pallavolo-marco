-- Citta di riferimento del giocatore: serve al meteo in home.
-- Le coordinate arrivano dalla geocodifica al momento della scelta, cosi il
-- frontend non deve geocodificare a ogni caricamento.
alter table public.profiles
  add column if not exists city text,
  add column if not exists city_latitude double precision,
  add column if not exists city_longitude double precision;

alter table public.profiles drop constraint if exists profiles_city_check;
alter table public.profiles add constraint profiles_city_check check (
  num_nonnulls(city, city_latitude, city_longitude) in (0, 3)
  and (city is null or char_length(btrim(city)) between 1 and 120)
  and (city_latitude is null or city_latitude between -90 and 90)
  and (city_longitude is null or city_longitude between -180 and 180)
);

create or replace function public.set_my_city(
  p_city text,
  p_latitude double precision,
  p_longitude double precision
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
    city_longitude = case when normalized_city is null then null else p_longitude end
  where id = (select auth.uid())
  returning * into updated_profile;

  if not found then raise exception 'Profilo non trovato'; end if;
  return updated_profile;
end;
$$;

revoke all on function public.set_my_city(text, double precision, double precision) from public;
grant execute on function public.set_my_city(text, double precision, double precision) to authenticated;
