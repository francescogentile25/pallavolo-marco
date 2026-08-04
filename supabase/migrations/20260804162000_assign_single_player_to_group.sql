drop function if exists public.organizer_add_tournament_player(uuid, uuid);

create function public.organizer_add_tournament_player(p_tournament_id uuid, p_profile_id uuid, p_group_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
  actor uuid := (select auth.uid());
  created_team uuid;
begin
  if not exists (select 1 from public.profiles where id = p_profile_id) then raise exception 'Giocatore non trovato'; end if;
  if public.is_profile_in_tournament(p_tournament_id, p_profile_id) then raise exception 'Giocatore gia presente nel torneo'; end if;
  if p_group_id is not null and not exists (select 1 from public.tournament_groups where id = p_group_id and tournament_id = p_tournament_id) then raise exception 'Girone non valido'; end if;

  insert into public.tournament_teams(tournament_id, status, created_by)
  values (p_tournament_id, 'proposed', actor)
  returning id into created_team;
  insert into public.tournament_team_members(team_id, profile_id, status, invited_by, responded_at)
  values (created_team, p_profile_id, 'accepted', actor, now());

  if p_group_id is not null then
    insert into public.tournament_group_teams(group_id, team_id, position)
    values (p_group_id, created_team, coalesce((select max(position) + 1 from public.tournament_group_teams where group_id = p_group_id), 1));
  end if;
  return created_team;
end;
$$;

revoke all on function public.organizer_add_tournament_player(uuid, uuid, uuid) from public;
grant execute on function public.organizer_add_tournament_player(uuid, uuid, uuid) to authenticated;
