import { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'giocatore';

export interface UserProfile {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: UserRole;
  attivo: boolean;
  livello: number;
  affidabilita: number;
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
