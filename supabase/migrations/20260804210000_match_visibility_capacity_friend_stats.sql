-- Fix ricerca/annullamento, capienza massima e statistiche social.

-- Le nuove partite e le modifiche non possono superare 8 giocatori.
alter table public.matches drop constraint if exists matches_capacity_check;
alter table public.matches
  add constraint matches_capacity_check check (capacity between 2 and 8) not valid;

-- L'annullamento notifica letteralmente tutti i membri, incluso l'organizzatore.
-- Per la chiusura resta il comportamento esistente (l'attore non riceve un avviso ridondante).
create or replace function public.notify_match_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_name text;
  v_recipients uuid[];
begin
  if new.status is distinct from old.status and new.status = 'cancelled' then
    select nome || ' ' || cognome into v_actor_name
    from public.profiles where id = v_actor;

    insert into public.notifications (recipient_id, type, match_id, actor_id, actor_name, payload)
    select recipients.profile_id, 'match_cancelled', new.id, v_actor, v_actor_name, '{}'::jsonb
    from (
      select profile_id from public.match_participants where match_id = new.id
      union
      select new.creator_id
    ) recipients
    join public.profiles profile on profile.id = recipients.profile_id
    where profile.in_app_notifications_enabled;
  elsif new.status is distinct from old.status and new.status = 'completed' then
    select array_agg(distinct profile_id) into v_recipients
    from public.match_participants where match_id = new.id;
    perform public.create_notifications(v_recipients, 'match_closed', new.id, null, v_actor, '{}'::jsonb);
  end if;
  return null;
end;
$$;

-- Statistiche sintetiche degli amici. I conteggi sono calcolati server-side e
-- rispettano il perimetro già protetto delle RPC social.
drop function if exists public.list_friends();
create function public.list_friends()
returns table(
  id uuid, nome text, cognome text, livello smallint,
  matches_played bigint, tournaments_played bigint, tournaments_won bigint
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nome, p.cognome, p.livello,
    (select count(distinct mp.match_id) from public.match_participants mp
      join public.matches m on m.id = mp.match_id
      where mp.profile_id = p.id and m.status = 'completed') as matches_played,
    (select count(distinct tt.tournament_id) from public.tournament_team_members tm
      join public.tournament_teams tt on tt.id = tm.team_id
      join public.tournaments t on t.id = tt.tournament_id
      where tm.profile_id = p.id and tm.status = 'accepted' and t.status in ('completed', 'archived')) as tournaments_played,
    (select count(distinct g.tournament_id) from public.tournament_team_members tm
      join public.tournament_games g on g.winner_team_id = tm.team_id
      join public.tournaments t on t.id = g.tournament_id
      where tm.profile_id = p.id and tm.status = 'accepted'
        and g.phase = 'knockout' and g.next_game_id is null
        and g.status in ('completed', 'walkover') and t.status in ('completed', 'archived')) as tournaments_won
  from public.friendships f
  join public.profiles p on p.id = case when f.requester_id = (select auth.uid()) then f.addressee_id else f.requester_id end
  where f.status = 'accepted'
    and (f.requester_id = (select auth.uid()) or f.addressee_id = (select auth.uid()))
  order by p.nome, p.cognome;
$$;

drop function if exists public.get_friend_profile(uuid);
create function public.get_friend_profile(p_id uuid)
returns table(
  id uuid, nome text, cognome text, livello smallint, affidabilita numeric,
  lato_preferito public.preferred_side, avatar_url text,
  matches_played bigint, tournaments_played bigint, tournaments_won bigint
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nome, p.cognome, p.livello, p.affidabilita, p.lato_preferito, p.avatar_url,
    (select count(distinct mp.match_id) from public.match_participants mp
      join public.matches m on m.id = mp.match_id
      where mp.profile_id = p.id and m.status = 'completed') as matches_played,
    (select count(distinct tt.tournament_id) from public.tournament_team_members tm
      join public.tournament_teams tt on tt.id = tm.team_id
      join public.tournaments t on t.id = tt.tournament_id
      where tm.profile_id = p.id and tm.status = 'accepted' and t.status in ('completed', 'archived')) as tournaments_played,
    (select count(distinct g.tournament_id) from public.tournament_team_members tm
      join public.tournament_games g on g.winner_team_id = tm.team_id
      join public.tournaments t on t.id = g.tournament_id
      where tm.profile_id = p.id and tm.status = 'accepted'
        and g.phase = 'knockout' and g.next_game_id is null
        and g.status in ('completed', 'walkover') and t.status in ('completed', 'archived')) as tournaments_won
  from public.profiles p
  where p.id = p_id and (
    p_id = (select auth.uid()) or public.is_admin()
    or exists (select 1 from public.friendships f where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least((select auth.uid()), p_id)
      and greatest(f.requester_id, f.addressee_id) = greatest((select auth.uid()), p_id))
  );
$$;

revoke all on function public.list_friends() from public;
revoke all on function public.get_friend_profile(uuid) from public;
grant execute on function public.list_friends(), public.get_friend_profile(uuid) to authenticated;

notify pgrst, 'reload schema';
