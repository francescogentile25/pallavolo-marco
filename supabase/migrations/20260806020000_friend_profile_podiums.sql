-- Albo d'oro anche nella scheda degli altri giocatori.
--
-- "tournaments_won" contava i tornei in cui il giocatore aveva vinto una partita
-- knockout senza next_game_id. Nei tabelloni costruiti a mano nessuna partita ha
-- next_game_id, quindi bastava vincere un incontro qualsiasi per risultare vincitore
-- del torneo. Ora la fonte e il podio dichiarato dall'organizzatore, coerente con
-- quanto mostrato nel profilo personale.

drop function if exists public.get_friend_profile(uuid);

create function public.get_friend_profile(p_id uuid)
returns table(
  id uuid, nome text, cognome text, livello smallint, affidabilita numeric,
  lato_preferito public.preferred_side, avatar_url text,
  matches_played bigint, tournaments_played bigint,
  tournaments_won bigint, tournaments_second bigint, tournaments_third bigint,
  tournament_games_played bigint, tournament_games_won bigint, best_set_score smallint
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
    -- podio dichiarato dall'organizzatore
    (select count(*) from public.tournament_team_members tm
      join public.tournament_teams tt on tt.id = tm.team_id
      join public.tournaments t on t.id = tt.tournament_id
      where tm.profile_id = p.id and tm.status = 'accepted'
        and t.status in ('completed', 'archived') and t.champion_team_id = tm.team_id) as tournaments_won,
    (select count(*) from public.tournament_team_members tm
      join public.tournament_teams tt on tt.id = tm.team_id
      join public.tournaments t on t.id = tt.tournament_id
      where tm.profile_id = p.id and tm.status = 'accepted'
        and t.status in ('completed', 'archived') and t.runner_up_team_id = tm.team_id) as tournaments_second,
    (select count(*) from public.tournament_team_members tm
      join public.tournament_teams tt on tt.id = tm.team_id
      join public.tournaments t on t.id = tt.tournament_id
      where tm.profile_id = p.id and tm.status = 'accepted'
        and t.status in ('completed', 'archived') and t.third_place_team_id = tm.team_id) as tournaments_third,
    (select count(g.id) from public.tournament_team_members tm
      join public.tournament_games g on tm.team_id in (g.team1_id, g.team2_id)
      join public.tournaments t on t.id = g.tournament_id
      where tm.profile_id = p.id and tm.status = 'accepted'
        and g.status in ('completed', 'walkover') and t.status in ('completed', 'archived')) as tournament_games_played,
    (select count(g.id) from public.tournament_team_members tm
      join public.tournament_games g on g.winner_team_id = tm.team_id
      join public.tournaments t on t.id = g.tournament_id
      where tm.profile_id = p.id and tm.status = 'accepted'
        and g.status in ('completed', 'walkover') and t.status in ('completed', 'archived')) as tournament_games_won,
    coalesce((select max(score)::smallint from public.tournament_team_members tm
      join public.tournament_games g on tm.team_id in (g.team1_id, g.team2_id)
      join public.tournaments t on t.id = g.tournament_id
      cross join lateral unnest(case when g.team1_id = tm.team_id then g.team1_scores else g.team2_scores end) as score
      where tm.profile_id = p.id and tm.status = 'accepted'
        and g.status = 'completed' and t.status in ('completed', 'archived')), 0) as best_set_score
  from public.profiles p
  where p.id = p_id and (
    p_id = (select auth.uid()) or public.is_admin()
    or exists (select 1 from public.friendships f where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least((select auth.uid()), p_id)
      and greatest(f.requester_id, f.addressee_id) = greatest((select auth.uid()), p_id))
  );
$$;

revoke all on function public.get_friend_profile(uuid) from public;
grant execute on function public.get_friend_profile(uuid) to authenticated;

notify pgrst, 'reload schema';
