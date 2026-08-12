-- Bootstrap una tantum dopo il reset dell'ambiente di test.
-- I profili demo hanno dominio .invalid; il primo profilo reale che ha
-- completato la registrazione diventa l'amministratore iniziale.
with first_real_profile as (
  select id
  from public.profiles
  where registration_completed_at is not null
    and email not ilike '%@demo.invalid'
  order by created_at, id
  limit 1
)
update public.profiles
set
  ruolo = 'admin'::public.user_role,
  attivo = true
where id = (select id from first_real_profile);
