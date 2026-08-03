import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { UserProfile } from '../../auth/models/auth.model';
import {
  LevelHistoryEntry,
  ReliabilityHistoryEntry,
  UpdatePlayerProfileRequest,
} from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly supabase = inject(SupabaseService);

  async getProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single<UserProfile>();

    if (error) throw error;
    return data;
  }

  async getLevelHistory(userId: string): Promise<readonly LevelHistoryEntry[]> {
    const { data, error } = await this.supabase.client
      .from('profile_level_history')
      .select('*')
      .eq('profile_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as LevelHistoryEntry[];
  }

  async getReliabilityHistory(userId: string): Promise<readonly ReliabilityHistoryEntry[]> {
    const { data, error } = await this.supabase.client
      .from('profile_reliability_history')
      .select('*')
      .eq('profile_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ReliabilityHistoryEntry[];
  }

  async setNotifications(enabled: boolean): Promise<void> {
    const { error } = await this.supabase.client.rpc('set_in_app_notifications', { p_enabled: enabled });
    if (error) throw error;
  }

  async requestNameChange(nome: string, cognome: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('request_name_change', { p_nome: nome, p_cognome: cognome });
    if (error) throw error;
  }

  async changePassword(password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.updateUser({ password });
    if (error) throw error;
  }

  async updateMyProfile(request: UpdatePlayerProfileRequest): Promise<UserProfile> {
    const { data, error } = await this.supabase.client.rpc('update_my_profile', {
      p_nome: request.nome,
      p_cognome: request.cognome,
      p_lato_preferito: request.lato_preferito,
      p_avatar_url: request.avatar_url ?? '',
      p_autovalutazione: request.autovalutazione,
    });

    if (error) throw error;
    return data as UserProfile;
  }
}
