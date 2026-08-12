import { GroupStanding, Tournament, TournamentGame, TournamentRules, TournamentTeam } from './models/tournament.model';

export const TOURNAMENT_STATUS_LABELS = { draft: 'Bozza', published: 'Iscrizioni aperte', registration_closed: 'Iscrizioni chiuse', in_progress: 'In corso', completed: 'Concluso', cancelled: 'Annullato', archived: 'Archiviato' } as const;
export const REGISTRATION_MODE_LABELS = { pairs: 'Solo coppie', individual: 'Solo individuale', hybrid: 'Ibrida' } as const;
export const FORMAT_LABELS = { groups: 'Gironi', knockout: 'Eliminazione diretta', mixed: 'Gironi + eliminazione' } as const;

export function teamLabel(team: TournamentTeam | undefined): string {
  if (!team) return 'Da definire';
  const names = team.members.filter(member => member.status === 'accepted').map(member => member.profile ? `${member.profile.nome} ${member.profile.cognome}` : 'Giocatore');
  return names.length ? names.join(' / ') : 'Coppia proposta';
}

/**
 * La finalissima e una sola: l'incontro dell'ultimo turno del tabellone
 * principale. `next_game_id` non e affidabile per i tabelloni costruiti a mano,
 * perche i loro incontri nascono tutti scollegati.
 */
export function isFinalGame(
  tournament: Pick<Tournament, 'games'>,
  game: Pick<TournamentGame, 'id' | 'phase' | 'bracket_no' | 'round_no' | 'position'>,
): boolean {
  if (game.phase !== 'knockout' || game.bracket_no !== 1) return false;
  const final = (tournament.games ?? [])
    .filter(item => item.phase === 'knockout' && item.bracket_no === 1)
    .sort((first, second) => second.round_no - first.round_no || first.position - second.position)[0];
  return final?.id === game.id;
}

/** Quanti set prevede la formula per questa partita. */
export function setsForGame(
  tournament: Pick<Tournament, 'group_best_of' | 'knockout_best_of' | 'games'>,
  game: Pick<TournamentGame, 'id' | 'phase' | 'bracket_no' | 'round_no' | 'position'>,
): number {
  return isFinalGame(tournament, game) ? tournament.knockout_best_of : tournament.group_best_of;
}

export function tournamentSummary(rules: TournamentRules): string {
  const registration = REGISTRATION_MODE_LABELS[rules.registrationMode];
  const format = FORMAT_LABELS[rules.format];
  const groups = rules.format === 'knockout' ? '' : ` · gironi da ${rules.groupSize}`;
  const final = rules.format === 'groups' ? '' : ` · finalissima al meglio di ${rules.knockoutBestOf}`;
  return `${rules.maxTeams} coppie · ${registration} · ${format}${groups}${final}`;
}

export function calculateStandings(tournament: Tournament, groupId: string): readonly GroupStanding[] {
  const teamIds = new Set((tournament.group_teams ?? []).filter(link => link.group_id === groupId).map(link => link.team_id));
  const rows = new Map<string, GroupStanding>();
  for (const id of teamIds) rows.set(id, { teamId: id, played: 0, wins: 0, losses: 0, setsFor: 0, setsAgainst: 0, pointsFor: 0, pointsAgainst: 0, rankingPoints: 0 });
  for (const game of (tournament.games ?? []).filter(item => item.group_id === groupId && item.status === 'completed')) applyGame(rows, game, tournament);
  return [...rows.values()].sort((a, b) => b.rankingPoints - a.rankingPoints || b.wins - a.wins || (b.setsFor - b.setsAgainst) - (a.setsFor - a.setsAgainst) || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst) || a.teamId.localeCompare(b.teamId));
}

function applyGame(rows: Map<string, GroupStanding>, game: TournamentGame, tournament: Tournament): void {
  if (!game.team1_id || !game.team2_id || !game.team1_scores || !game.team2_scores) return;
  const first = rows.get(game.team1_id); const second = rows.get(game.team2_id); if (!first || !second) return;
  const wins1 = game.team1_scores.filter((score, index) => score > game.team2_scores![index]).length;
  const wins2 = game.team2_scores.length - wins1;
  const points1 = game.team1_scores.reduce((sum, score) => sum + score, 0); const points2 = game.team2_scores.reduce((sum, score) => sum + score, 0);
  first.played++; second.played++; first.setsFor += wins1; first.setsAgainst += wins2; second.setsFor += wins2; second.setsAgainst += wins1;
  first.pointsFor += points1; first.pointsAgainst += points2; second.pointsFor += points2; second.pointsAgainst += points1;
  const firstWon = game.winner_team_id === game.team1_id;
  (firstWon ? first : second).wins++; (firstWon ? second : first).losses++;
  (firstWon ? first : second).rankingPoints += tournament.standings_win_points;
  (firstWon ? second : first).rankingPoints += tournament.standings_loss_points;
}

export function tournamentErrorMessage(error: unknown): string {
  const raw = rawErrorMessage(error);
  const value = raw.toLocaleLowerCase('it');
  // Poche riscritture, solo dove il messaggio del database non basterebbe a capire cosa fare.
  if (value.includes('permesso organizzatore')) return 'Questa azione è riservata a organizzatori e amministratori.';
  if (value.includes('già iscritto') || value.includes('già coinvolto')) return 'Uno dei giocatori è già coinvolto nel torneo.';
  if (value.includes('disputato una partita')) return 'Il giocatore ha già disputato una partita: non può essere spostato o rimosso.';
  if (value.includes('contiene gia dei risultati')) return 'Ci sono già dei risultati registrati: elimina prima quelli.';
  // Per tutto il resto vince il messaggio del server: dice esattamente cosa non va.
  return raw || 'Operazione non riuscita. Controlla i dati e riprova.';
}

/** Gli errori di Supabase non sono istanze di Error: il messaggio va estratto a mano. */
export function rawErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  const source = error as { message?: unknown; error_description?: unknown; details?: unknown; hint?: unknown };
  return String(source.message ?? source.error_description ?? source.details ?? source.hint ?? '').trim();
}
