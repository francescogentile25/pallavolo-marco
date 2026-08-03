export type AppNotificationType =
  | 'match_participant_joined'
  | 'match_participant_withdrew'
  | 'match_cancelled'
  | 'match_closed'
  | 'match_invited'
  | 'match_rating_received'
  | 'match_no_show_reported'
  | 'tournament_team_invite'
  | 'tournament_invite_accepted'
  | 'tournament_invite_rejected'
  | 'tournament_registration_closed'
  | 'tournament_cancelled'
  | 'tournament_result_recorded'
  | 'tournament_result_pending'
  | 'tournament_waitlist_promoted'
  | 'friend_request_received'
  | 'friend_request_accepted';

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
