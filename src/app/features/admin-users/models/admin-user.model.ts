import { UserProfile, UserRole } from '../../auth/models/auth.model';

export type AdminActiveFilter = 'tutti' | 'attivi' | 'in_attesa';
export type AdminRoleFilter = 'tutti' | UserRole;

export interface AdminUserUpdateRequest {
  profileId: string;
  attivo: boolean;
  ruolo: UserRole;
}

export interface ProfileAdminAudit {
  id: number;
  target_profile_id: string;
  actor_profile_id: string;
  previous_role: UserRole;
  new_role: UserRole;
  previous_active: boolean;
  new_active: boolean;
  created_at: string;
}

export interface AdminUsersState {
  users: readonly UserProfile[];
  audit: readonly ProfileAdminAudit[];
  loading: boolean;
  updatingId: string | null;
  error: string | null;
}
