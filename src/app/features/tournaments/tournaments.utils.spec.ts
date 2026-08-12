import { Tournament, TournamentRules } from './models/tournament.model';
import { calculateStandings, isFinalGame, setsForGame, teamLabel, tournamentErrorMessage, tournamentSummary } from './tournaments.utils';

describe('tournaments utilities', () => {
  it('keeps registration mode independent from tournament format', () => {
    const rules: TournamentRules = { registrationMode: 'individual', format: 'mixed', maxTeams: 12, guaranteedMatches: 0, groupSize: 4, qualifiersPerGroup: 2, groupBestOf: 1, groupSetPoints: 21, knockoutBestOf: 3, knockoutSetPoints: 21, tiebreakPoints: 15, winByTwo: true, thirdPlace: false, standingsWinPoints: 2, standingsLossPoints: 0, minimumRestMinutes: 0, resultConfirmationRequired: false };
    expect(tournamentSummary(rules)).toContain('Solo individuale');
    expect(tournamentSummary(rules)).toContain('Gironi + eliminazione');
  });

  it('riserva la formula lunga all’ultima partita del tabellone', () => {
    const semifinal = { id: 'semi', phase: 'knockout' as const, bracket_no: 1, round_no: 1, position: 1 };
    const final = { id: 'final', phase: 'knockout' as const, bracket_no: 1, round_no: 2, position: 1 };
    const consolationFinal = { id: 'consolation', phase: 'knockout' as const, bracket_no: 2, round_no: 2, position: 1 };
    const groupGame = { id: 'group', phase: 'group' as const, bracket_no: 1, round_no: 1, position: 1 };
    const thirdPlace = { id: 'third', phase: 'third_place' as const, bracket_no: 1, round_no: 2, position: 1 };
    const rules = {
      group_best_of: 1,
      knockout_best_of: 3,
      games: [semifinal, final, consolationFinal, groupGame, thirdPlace],
    } as unknown as Pick<Tournament, 'group_best_of' | 'knockout_best_of' | 'games'>;

    expect(isFinalGame(rules, final)).toBeTrue();
    expect(isFinalGame(rules, semifinal)).toBeFalse();
    expect(isFinalGame(rules, consolationFinal)).toBeFalse();
    expect(isFinalGame(rules, groupGame)).toBeFalse();

    expect(setsForGame(rules, final)).toBe(3);
    expect(setsForGame(rules, semifinal)).toBe(1);
    expect(setsForGame(rules, groupGame)).toBe(1);
    expect(setsForGame(rules, thirdPlace)).toBe(1);
  });

  it('renders accepted team members only', () => {
    expect(teamLabel({ id: 'team', tournament_id: 't', status: 'confirmed', seed: null, waitlist_position: null, members: [
      { profile_id: 'a', status: 'accepted', profile: { id: 'a', nome: 'Anna', cognome: 'Rossi', livello: 3, lato_preferito: 'sinistra', avatar_url: null } },
      { profile_id: 'b', status: 'invited', profile: { id: 'b', nome: 'Luca', cognome: 'Blu', livello: 3, lato_preferito: 'destra', avatar_url: null } },
    ] })).toBe('Anna Rossi');
  });

  it('orders group standings by ranking points and set difference', () => {
    const tournament = {
      standings_win_points: 2, standings_loss_points: 0,
      group_teams: [{ group_id: 'g', team_id: 'a', position: 1 }, { group_id: 'g', team_id: 'b', position: 2 }],
      games: [{ id: 'game', tournament_id: 't', phase: 'group', group_id: 'g', round_no: 1, position: 1, team1_id: 'a', team2_id: 'b', court_id: null, scheduled_at: null, status: 'completed', team1_scores: [21, 21], team2_scores: [12, 18], winner_team_id: 'a', next_game_id: null }],
    } as unknown as Tournament;
    const standings = calculateStandings(tournament, 'g');
    expect(standings[0].teamId).toBe('a');
    expect(standings[0].rankingPoints).toBe(2);
    expect(standings[0].setsFor).toBe(2);
  });

  it('turns database invariants into actionable messages', () => {
    expect(tournamentErrorMessage(new Error('Servono almeno due coppie confermate'))).toContain('due coppie');
    expect(tournamentErrorMessage(new Error('Permesso organizzatore richiesto'))).toContain('organizzatori');
  });
});
