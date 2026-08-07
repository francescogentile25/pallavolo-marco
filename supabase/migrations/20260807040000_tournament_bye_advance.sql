-- Bye nel tabellone: quando in un incontro c'e una sola squadra, l'organizzatore
-- la fa passare senza punteggio. Nessun perdente, quindi niente ripescaggio per
-- la finale terzo posto: l'avanzamento e scritto qui invece di riusare
-- finalize_tournament_game, che presuppone due squadre.
create or replace function public.advance_tournament_bye(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  actor uuid := (select auth.uid());
  game public.tournament_games;
  target public.tournaments;
  sole_team uuid;
begin
  select * into game from public.tournament_games where id = p_game_id for update;
  if not found then raise exception 'Incontro non trovato'; end if;

  select * into target from public.tournaments where id = game.tournament_id for update;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then
    raise exception 'Permesso organizzatore richiesto';
  end if;

  if game.phase = 'group' then raise exception 'Il bye vale solo nel tabellone'; end if;
  if game.status in ('completed', 'walkover') then raise exception 'Incontro gia chiuso'; end if;
  if num_nonnulls(game.team1_id, game.team2_id) <> 1 then
    raise exception 'Il bye richiede una sola squadra nell incontro';
  end if;

  sole_team := coalesce(game.team1_id, game.team2_id);

  delete from public.tournament_result_confirmations where game_id = p_game_id;
  update public.tournament_games
    set winner_team_id = sole_team, team1_scores = null, team2_scores = null, status = 'walkover'
  where id = p_game_id;

  update public.tournaments set status = 'in_progress' where id = target.id and status = 'registration_closed';

  if game.next_game_id is not null then
    if game.position % 2 = 1 then
      update public.tournament_games set team1_id = sole_team where id = game.next_game_id;
    else
      update public.tournament_games set team2_id = sole_team where id = game.next_game_id;
    end if;
  elsif not exists (
    select 1 from public.tournament_games other
    where other.tournament_id = game.tournament_id and other.id <> game.id
      and other.status not in ('completed', 'walkover', 'cancelled')
  ) then
    update public.tournaments set status = 'completed' where id = game.tournament_id;
  end if;
end;
$$;

revoke all on function public.advance_tournament_bye(uuid) from public;
grant execute on function public.advance_tournament_bye(uuid) to authenticated;
