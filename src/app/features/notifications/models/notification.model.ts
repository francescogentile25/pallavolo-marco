export type AppNotificationType =
  | 'match_participant_joined'
  | 'match_participant_withdrew'
  | 'match_cancelled'
  | 'match_closed'
  | 'tournament_team_invite'
  | 'tournament_invite_accepted'
  | 'tournament_invite_rejected'
  | 'tournament_registration_closed'
  | 'tournament_cancelled'
  | 'tournament_result_recorded';

export interface AppNotification {
  id: number;
  type: AppNotificationType;
  match_id: string | null;
  tournament_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface NotificationsPage {
  items: AppNotification[];
  total: number;
}
