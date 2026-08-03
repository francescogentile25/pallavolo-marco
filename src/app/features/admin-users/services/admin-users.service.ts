import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { UserProfile } from '../../auth/models/auth.model';
import { AdminUserUpdateRequest, ProfileAdminAudit } from '../models/admin-user.model';

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly supabase = inject(SupabaseService);

  async getUsers(): Promise<readonly UserProfile[]> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as UserProfile[];
  }

  async getAudit(): Promise<readonly ProfileAdminAudit[]> {
    const { data, error } = await this.supabase.client
      .from('profile_admin_audit')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data ?? []) as ProfileAdminAudit[];
  }

  async updateAccess(request: AdminUserUpdateRequest): Promise<UserProfile> {
    const { data, error } = await this.supabase.client.rpc('admin_update_profile_access', {
      p_profile_id: request.profileId,
      p_attivo: request.attivo,
      p_ruolo: request.ruolo,
    });
    if (error) throw error;
    return data as UserProfile;
  }

  async updateName(profileId: string, nome: string, cognome: string): Promise<UserProfile> {
    const { data, error } = await this.supabase.client.rpc('admin_update_profile_name', {
      p_profile_id: profileId,
      p_nome: nome,
      p_cognome: cognome,
    });
    if (error) throw error;
    return data as UserProfile;
  }

  async createUser(payload: { email: string; nome: string; cognome: string; password: string }): Promise<void> {
    const { error } = await this.supabase.client.functions.invoke('admin-create-user', { body: payload });
    if (error) {
      let message = error.message;
      try {
        const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
        if (body?.error) message = body.error;
      } catch { /* keep default */ }
      throw new Error(message);
    }
  }
}
