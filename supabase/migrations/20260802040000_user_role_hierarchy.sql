alter type public.user_role add value if not exists 'organizzatore' after 'giocatore';

create or replace function public.can_organize_tournaments()
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
      and ruolo::text in ('organizzatore', 'admin')
  );
$$;

revoke all on function public.can_organize_tournaments() from public;
grant execute on function public.can_organize_tournaments() to authenticated;

comment on type public.user_role is
  'Ruoli cumulativi: giocatore (utente comune), organizzatore (utente comune + gestione tornei), admin (accesso completo).';
comment on function public.can_organize_tournaments() is
  'Autorizza la gestione dei tornei agli organizzatori attivi e agli amministratori attivi.';
