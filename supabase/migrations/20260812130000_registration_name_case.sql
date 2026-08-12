-- Nome e cognome vengono salvati in formato leggibile anche se un client non
-- applica la normalizzazione del form Angular. Il trigger copre registrazione
-- email, onboarding Google e successive correzioni amministrative.
create or replace function public.normalize_person_name(p_value text)
returns text
language sql
immutable
set search_path to ''
as $$
  select initcap(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.normalize_profile_person_names()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.nome := public.normalize_person_name(new.nome);
  new.cognome := public.normalize_person_name(new.cognome);
  return new;
end;
$$;

drop trigger if exists normalize_profile_person_names on public.profiles;
create trigger normalize_profile_person_names
before insert or update of nome, cognome on public.profiles
for each row execute function public.normalize_profile_person_names();

-- Allinea anche i profili creati prima di questa regola.
update public.profiles
set nome = public.normalize_person_name(nome),
    cognome = public.normalize_person_name(cognome)
where nome is distinct from public.normalize_person_name(nome)
   or cognome is distinct from public.normalize_person_name(cognome);

comment on function public.normalize_person_name(text) is
  'Normalizza nome e cognome con iniziali maiuscole e spazi singoli.';
