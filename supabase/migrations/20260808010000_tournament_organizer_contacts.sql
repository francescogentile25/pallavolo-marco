-- Contatti della societa organizzatrice, accanto al logo: chi guarda il torneo
-- deve poter scrivere o telefonare senza cercare altrove. Solo l'organizzatore
-- li scrive, chiunque veda il torneo li legge.
alter table public.tournaments
  add column if not exists organizer_email text,
  add column if not exists organizer_phone text;

create or replace function public.set_tournament_contacts(
  p_tournament_id uuid,
  p_email text,
  p_phone text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
  clean_email text := nullif(btrim(coalesce(p_email, '')), '');
  clean_phone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  if clean_email is not null and clean_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    raise exception 'Email della societa non valida';
  end if;
  if clean_phone is not null and (
       char_length(clean_phone) not between 6 and 25
       or clean_phone !~ '^[0-9+()./ -]+$'
     ) then
    raise exception 'Telefono della societa non valido';
  end if;

  update public.tournaments
    set organizer_email = clean_email,
        organizer_phone = clean_phone
  where id = p_tournament_id;
end;
$$;

-- PUBLIC va tolto esplicitamente: senza revoke la funzione resterebbe
-- chiamabile anche dal ruolo anonimo, come le altre del progetto non sono.
revoke execute on function public.set_tournament_contacts(uuid, text, text) from public, anon;
grant execute on function public.set_tournament_contacts(uuid, text, text) to authenticated;
