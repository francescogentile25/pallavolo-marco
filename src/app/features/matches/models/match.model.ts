export type MatchStatus =
  | 'draft'
  | 'open'
  | 'full'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type MatchGender = 'male' | 'female' | 'mixed';
export type MatchAttendanceStatus = 'present' | 'no_show';

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
}

export interface Court {
  id: string;
  venue_id: string;
  name: string;
  surface: string;
  indoor: boolean;
  venue: Venue;
}

export interface MatchParticipantSummary {
  profile_id: string;
  joined_at?: string;
}

export interface MatchParticipant {
  profile_id: string;
  nome: string;
  cognome: string;
  avatar_url: string | null;
  livello: number;
  joined_at: string;
  is_creator: boolean;
  attendance_status: MatchAttendanceStatus | null;
  my_rating: number | null;
}

export interface BeachMatch {
  id: string;
  creator_id: string;
  court_id: string;
  status: MatchStatus;
  gender: MatchGender;
  min_level: number;
  max_level: number;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  court: Court;
  participants: readonly MatchParticipantSummary[];
}

export interface MatchDetails extends BeachMatch {
  participantDetails: readonly MatchParticipant[];
}

export interface InvitablePlayer {
  id: string;
  nome: string;
  cognome: string;
  avatar_url: string | null;
  livello: number;
}

export interface CreateMatchRequest {
  courtId: string;
  gender: MatchGender;
  minLevel: number;
  maxLevel: number;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  notes: string | null;
  invitedPlayerIds: readonly string[];
}

export interface UpdateMatchRequest {
  matchId: string;
  courtId: string;
  gender: MatchGender;
  minLevel: number;
  maxLevel: number;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  notes: string | null;
}

export interface CreateCourtRequest {
  venueName: string;
  address: string;
  city: string;
  courtName: string;
  indoor: boolean;
}

export interface MatchFilters {
  query: string;
  gender: MatchGender | 'all';
  level: number | null;
  onlyAvailable: boolean;
  date: 'all' | 'today' | 'weekend';
}

export interface MatchesState {
  matches: readonly BeachMatch[];
  myMatches: readonly BeachMatch[];
  selected: MatchDetails | null;
  courts: readonly Court[];
  invitablePlayers: readonly InvitablePlayer[];
  loading: boolean;
  saving: boolean;
  actionMatchId: string | null;
  feedbackProfileId: string | null;
  error: string | null;
}
