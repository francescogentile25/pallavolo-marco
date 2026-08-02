create or replace function public.list_invitable_players()
returns table (
  id uuid,
  nome text,
  cognome text,
  avatar_url text,
  livello smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_active_user() then
    raise exception 'Profilo attivo richiesto';
  end if;

  return query
  select p.id, p.nome, p.cognome, p.avatar_url, p.livello
  from public.profiles p
  where p.attivo = true
    and p.id <> (select auth.uid())
  order by lower(p.nome), lower(p.cognome), p.id;
end;
$$;

revoke all on function public.list_invitable_players() from public;
grant execute on function public.list_invitable_players() to authenticated;

comment on function public.list_invitable_players() is
  'Restituisce soltanto i dati pubblici minimi dei giocatori attivi invitabili.';

notify pgrst, 'reload schema';
