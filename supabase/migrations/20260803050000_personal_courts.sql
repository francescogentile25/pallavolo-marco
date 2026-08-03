-- Campi personali: ogni utente crea i propri campi/strutture; li eredita chi
-- partecipa a una partita giocata su quel campo. Modifica/eliminazione solo
-- dal proprietario. Eliminazione = soft (active=false).

-- create_court_with_venue: dedup per-utente (venue e court scoped a created_by),
-- riattiva un campo proprio precedentemente eliminato.
create or replace function public.create_court_with_venue(
  p_venue_name text, p_address text, p_city text, p_court_name text, p_indoor boolean default false
) returns public.courts language plpgsql security definer set search_path = '' as $$
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
    insert into public.venues (name, address, city, created_by)
    values (trim(p_venue_name), trim(p_address), trim(p_city), actor_id)
    returning * into venue_record;
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

-- I miei campi: creati da me OPPURE campi di partite a cui ho partecipato (ereditati).
create or replace function public.list_my_courts()
returns table(
  id uuid, name text, indoor boolean, surface text, owned boolean,
  venue_id uuid, venue_name text, address text, city text
) language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.indoor, c.surface,
    (c.created_by = (select auth.uid())) as owned,
    v.id, v.name, v.address, v.city
  from public.courts c
  join public.venues v on v.id = c.venue_id
  where c.active and (
    c.created_by = (select auth.uid())
    or exists (
      select 1 from public.matches m
      join public.match_participants mp on mp.match_id = m.id
      where m.court_id = c.id and mp.profile_id = (select auth.uid())
    )
  )
  order by owned desc, v.name, c.name;
$$;

create or replace function public.update_court(
  p_court_id uuid, p_court_name text, p_indoor boolean,
  p_venue_name text, p_address text, p_city text
) returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); c public.courts;
begin
  select * into c from public.courts where id = p_court_id for update;
  if not found then raise exception 'Campo non trovato'; end if;
  if c.created_by <> actor then raise exception 'Solo chi ha creato il campo può modificarlo'; end if;
  if char_length(trim(p_court_name)) not between 1 and 80
     or char_length(trim(p_venue_name)) not between 2 and 120
     or char_length(trim(p_address)) not between 3 and 180
     or char_length(trim(p_city)) not between 2 and 100 then
    raise exception 'Dati del campo non validi';
  end if;
  update public.courts set name = trim(p_court_name), indoor = coalesce(p_indoor, false), updated_at = now()
  where id = p_court_id;
  update public.venues set name = trim(p_venue_name), address = trim(p_address), city = trim(p_city), updated_at = now()
  where id = c.venue_id;
end;
$$;

create or replace function public.delete_court(p_court_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); c public.courts;
begin
  select * into c from public.courts where id = p_court_id for update;
  if not found then raise exception 'Campo non trovato'; end if;
  if c.created_by <> actor then raise exception 'Solo chi ha creato il campo può eliminarlo'; end if;
  update public.courts set active = false, updated_at = now() where id = p_court_id;
end;
$$;

revoke all on function public.list_my_courts() from public;
revoke all on function public.update_court(uuid, text, boolean, text, text, text) from public;
revoke all on function public.delete_court(uuid) from public;
grant execute on function public.list_my_courts(),
  public.update_court(uuid, text, boolean, text, text, text),
  public.delete_court(uuid) to authenticated;

notify pgrst, 'reload schema';
