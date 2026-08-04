-- Compatibility helper used by the organizer assignment RPCs.
-- The canonical registration check is tournament_profile_is_registered.
create or replace function public.is_profile_in_tournament(p_tournament_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tournament_profile_is_registered(p_tournament_id, p_profile_id);
$$;

revoke all on function public.is_profile_in_tournament(uuid, uuid) from public;
grant execute on function public.is_profile_in_tournament(uuid, uuid) to authenticated;
