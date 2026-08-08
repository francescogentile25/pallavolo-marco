-- "Set nella finale" veniva applicato a tutte le partite a eliminazione
-- diretta: impostare al meglio di 3 obbligava tre set anche ai turni
-- preliminari. Ora la formula lunga vale solo per l'ultima partita di ogni
-- tabellone, quella che non alimenta nessun altro incontro; tutto il resto,
-- gironi e turni intermedi, usa la formula base.
create or replace function public.submit_tournament_result(p_game_id uuid, p_team1_scores smallint[], p_team2_scores smallint[])
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  actor uuid := (select auth.uid());
  game public.tournament_games;
  target public.tournaments;
  wins1 integer := 0;
  wins2 integer := 0;
  needed integer;
  score_index integer;
  winner uuid;
  set_target integer;
  score_gap integer;
  is_final boolean;
begin
  select * into game from public.tournament_games where id = p_game_id for update;
  if not found then raise exception 'Incontro non trovato'; end if;
  select * into target from public.tournaments where id = game.tournament_id for update;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then raise exception 'Permesso organizzatore richiesto'; end if;
  if game.team1_id is null or game.team2_id is null or array_length(p_team1_scores, 1) is distinct from array_length(p_team2_scores, 1) then raise exception 'Risultato incompleto'; end if;

  is_final := game.phase = 'knockout' and game.next_game_id is null;
  needed := case when is_final then (target.knockout_best_of + 1) / 2 else (target.group_best_of + 1) / 2 end;
  if coalesce(array_length(p_team1_scores, 1), 0) < needed or array_length(p_team1_scores, 1) > needed * 2 - 1 then raise exception 'Numero di set non valido'; end if;

  for score_index in 1..array_length(p_team1_scores, 1) loop
    if p_team1_scores[score_index] < 0 or p_team2_scores[score_index] < 0 or p_team1_scores[score_index] = p_team2_scores[score_index] then
      raise exception 'Il pareggio non e consentito';
    end if;
    set_target := case
      when score_index = needed * 2 - 1 and needed > 1 then target.tiebreak_points
      when is_final then target.knockout_set_points
      else target.group_set_points
    end;
    score_gap := abs(p_team1_scores[score_index] - p_team2_scores[score_index]);
    if greatest(p_team1_scores[score_index], p_team2_scores[score_index]) < set_target or (target.win_by_two and score_gap < 2) then raise exception 'Punteggio set non valido'; end if;
    if p_team1_scores[score_index] > p_team2_scores[score_index] then wins1 := wins1 + 1; else wins2 := wins2 + 1; end if;
  end loop;

  if greatest(wins1, wins2) <> needed then raise exception 'L incontro non ha un vincitore valido'; end if;
  winner := case when wins1 > wins2 then game.team1_id else game.team2_id end;
  delete from public.tournament_result_confirmations where game_id = p_game_id;
  update public.tournament_games set team1_scores = p_team1_scores, team2_scores = p_team2_scores,
    winner_team_id = winner,
    status = (case when target.result_confirmation_required then 'pending_confirmation' else 'completed' end)::public.tournament_game_status
  where id = p_game_id;
  update public.tournaments set status = 'in_progress' where id = target.id and status = 'registration_closed';
  if not target.result_confirmation_required then perform public.finalize_tournament_game(p_game_id); end if;
end;
$$;
