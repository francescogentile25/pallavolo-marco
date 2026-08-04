export type FriendRelation = 'none' | 'friend' | 'outgoing' | 'incoming';

export interface FriendProfile {
  id: string;
  nome: string;
  cognome: string;
  livello: number;
}

export interface FriendRequest {
  request_id: number;
  id: string;
  nome: string;
  cognome: string;
  livello: number;
}

export interface AddableUser extends FriendProfile {
  relation: FriendRelation;
}

export interface FriendProfileDetails {
  id: string;
  nome: string;
  cognome: string;
  livello: number;
  affidabilita: number;
  lato_preferito: string;
  avatar_url: string | null;
  matches_played: number;
  tournaments_played: number;
  tournaments_won: number;
  tournament_games_played: number;
  tournament_games_won: number;
  best_set_score: number;
}
