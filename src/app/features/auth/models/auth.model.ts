import { User } from '@supabase/supabase-js';

export type UserRole = 'giocatore' | 'organizzatore' | 'admin';
export type PreferredSide = 'sinistra' | 'destra' | 'indifferente';

export interface UserProfile {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: UserRole;
  attivo: boolean;
  livello: number;
  affidabilita: number;
  lato_preferito: PreferredSide;
  avatar_url: string | null;
  autovalutazione: number;
  in_app_notifications_enabled: boolean;
  /** Citta di riferimento del giocatore e coordinate risolte alla scelta: alimentano il meteo. */
  city: string | null;
  city_latitude: number | null;
  city_longitude: number | null;
  /** Identificativo del comune nell'anagrafica condivisa. */
  city_place_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  nome: string;
  cognome: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthState {
  authUser: User | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

export interface UserCapabilities {
  manageOwnProfile: boolean;
  createMatches: boolean;
  joinMatches: boolean;
  joinTournaments: boolean;
  organizeTournaments: boolean;
  administerApplication: boolean;
}
