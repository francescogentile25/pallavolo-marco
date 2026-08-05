import { Court, MatchGender, Venue } from '../../matches/models/match.model';

export type TournamentStatus = 'draft' | 'published' | 'registration_closed' | 'in_progress' | 'completed' | 'cancelled' | 'archived';
export type TournamentRegistrationMode = 'pairs' | 'individual' | 'hybrid';
export type TournamentFormat = 'groups' | 'knockout' | 'mixed';
export type TournamentTeamStatus = 'proposed' | 'confirmed' | 'waitlisted' | 'withdrawn';
export type TournamentMemberStatus = 'invited' | 'accepted' | 'rejected';
export type TournamentGamePhase = 'group' | 'knockout' | 'third_place';
export type TournamentGameStatus = 'scheduled' | 'pending_confirmation' | 'completed' | 'walkover' | 'cancelled';

export interface TournamentCourtLink { court_id: string; court?: Court; }
export interface TournamentMember {
  profile_id: string;
  status: TournamentMemberStatus;
  profile?: { id: string; nome: string; cognome: string; livello: number; lato_preferito: string; avatar_url: string | null };
}
export interface TournamentTeam {
  id: string;
  tournament_id: string;
  status: TournamentTeamStatus;
  seed: number | null;
  waitlist_position: number | null;
  members: readonly TournamentMember[];
}
export interface TournamentFreePlayer {
  tournament_id: string;
  profile_id: string;
  status: 'active' | 'waitlisted' | 'withdrawn';
  profile?: { id: string; nome: string; cognome: string; livello: number; lato_preferito: string; avatar_url: string | null };
}
export interface TournamentGroup {
  id: string;
  tournament_id: string;
  name: string;
  position: number;
  /** Numero di giocatori previsti nel girone. */
  capacity: number | null;
  /** Numero di slot partita pianificati per il girone. */
  planned_matches: number | null;
}
export interface TournamentGroupTeam { group_id: string; team_id: string; position: number; }
export interface TournamentGame {
  id: string;
  tournament_id: string;
  phase: TournamentGamePhase;
  group_id: string | null;
  round_no: number;
  position: number;
  team1_id: string | null;
  team2_id: string | null;
  court_id: string | null;
  scheduled_at: string | null;
  status: TournamentGameStatus;
  team1_scores: readonly number[] | null;
  team2_scores: readonly number[] | null;
  winner_team_id: string | null;
  next_game_id: string | null;
  confirmations?: readonly { team_id: string; profile_id: string; confirmed_at: string }[];
}

export interface Tournament {
  id: string;
  organizer_id: string;
  venue_id: string;
  status: TournamentStatus;
  visibility: 'public' | 'private';
  title: string;
  description: string | null;
  registration_mode: TournamentRegistrationMode;
  format: TournamentFormat;
  gender: MatchGender;
  min_level: number;
  max_level: number;
  max_teams: number;
  registration_deadline: string;
  starts_at: string;
  ends_at: string;
  cost_cents: number;
  guaranteed_matches: number;
  group_size: number | null;
  qualifiers_per_group: number | null;
  group_best_of: 1 | 3 | 5;
  group_set_points: number;
  knockout_best_of: 1 | 3 | 5;
  knockout_set_points: number;
  tiebreak_points: number;
  win_by_two: boolean;
  third_place: boolean;
  standings_win_points: number;
  standings_loss_points: number;
  minimum_rest_minutes: number;
  result_confirmation_required: boolean;
  /** Valorizzato quando l'organizzatore chiude i gironi: sblocca i risultati del tabellone. */
  groups_closed_at: string | null;
  venue: Venue;
  courts: readonly TournamentCourtLink[];
  teams: readonly TournamentTeam[];
  free_players?: readonly TournamentFreePlayer[];
  groups?: readonly TournamentGroup[];
  group_teams?: readonly TournamentGroupTeam[];
  games?: readonly TournamentGame[];
}

export interface TournamentRules {
  registrationMode: TournamentRegistrationMode;
  format: TournamentFormat;
  maxTeams: number;
  guaranteedMatches: number;
  groupSize: number | null;
  qualifiersPerGroup: number | null;
  groupBestOf: 1 | 3 | 5;
  groupSetPoints: number;
  knockoutBestOf: 1 | 3 | 5;
  knockoutSetPoints: number;
  tiebreakPoints: number;
  winByTwo: boolean;
  thirdPlace: boolean;
  standingsWinPoints: number;
  standingsLossPoints: number;
  minimumRestMinutes: number;
  resultConfirmationRequired: boolean;
}

export interface TournamentGameDraft {
  id?: string;
  phase: TournamentGamePhase;
  groupId: string | null;
  roundNo: number;
  position: number;
  team1Id: string | null;
  team2Id: string | null;
}

export interface CreateTournamentRequest {
  title: string;
  description: string | null;
  venueId: string;
  courtIds: readonly string[];
  gender: MatchGender;
  minLevel: number;
  maxLevel: number;
  registrationDeadline: string;
  startsAt: string;
  endsAt: string;
  costCents: number;
  visibility: 'public' | 'private';
}

export interface TournamentState {
  tournaments: readonly Tournament[];
  selected: Tournament | null;
  courts: readonly Court[];
  players: readonly { id: string; nome: string; cognome: string; livello: number; lato_preferito?: string }[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

export interface GroupStanding {
  teamId: string;
  played: number;
  wins: number;
  losses: number;
  setsFor: number;
  setsAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
  rankingPoints: number;
}
