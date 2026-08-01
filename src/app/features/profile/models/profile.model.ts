import { PreferredSide, UserProfile } from '../../auth/models/auth.model';

export interface UpdatePlayerProfileRequest {
  nome: string;
  cognome: string;
  lato_preferito: PreferredSide;
  avatar_url: string | null;
  autovalutazione: number;
}

export interface LevelHistoryEntry {
  id: number;
  profile_id: string;
  autovalutazione: number;
  livello_calcolato: number;
  motivo: string;
  created_at: string;
}

export interface ReliabilityHistoryEntry {
  id: number;
  profile_id: string;
  affidabilita: number;
  variazione: number;
  motivo: string;
  created_at: string;
}

export interface ProfileState {
  profile: UserProfile | null;
  levelHistory: readonly LevelHistoryEntry[];
  reliabilityHistory: readonly ReliabilityHistoryEntry[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

export interface ProfileMetricPoint {
  id: number;
  value: number;
  createdAt: string;
}
