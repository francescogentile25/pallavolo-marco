import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { UserProfile } from '../../auth/models/auth.model';
import {
  LevelHistoryEntry,
  ReliabilityHistoryEntry,
  TournamentPodiums,
  UpdatePlayerProfileRequest,
} from '../models/profile.model';

const NO_PODIUMS: TournamentPodiums = { first_places: 0, second_places: 0, third_places: 0 };

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

  /** L'albo d'oro e ricavato dai tornei conclusi, non da contatori memorizzati. */
  async getTournamentPodiums(userId: string): Promise<TournamentPodiums> {
    const { data, error } = await this.supabase.client.rpc('get_profile_tournament_podiums', { p_profile_id: userId });
    if (error) throw error;
    const row = (data as TournamentPodiums[] | null)?.[0];
    return row ?? NO_PODIUMS;
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

  async uploadAvatar(userId: string, file: File): Promise<string> {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await this.supabase.client.storage.from('avatars').upload(path, file, {
      upsert: true,
      cacheControl: '3600',
      contentType: file.type || 'image/jpeg',
    });
    if (error) throw error;
    return this.supabase.client.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  }

  /** La citta si salva da sola alla scelta, come l'avatar: non passa dal modulo. */
  async setCity(city: string | null, latitude: number | null, longitude: number | null, placeId: number | null): Promise<UserProfile> {
    const { data, error } = await this.supabase.client.rpc('set_my_city', {
      p_city: city,
      p_latitude: latitude,
      p_longitude: longitude,
      p_place_id: placeId,
    });

    if (error) throw error;
    return data as UserProfile;
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
