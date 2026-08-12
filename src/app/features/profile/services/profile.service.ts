import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { UserProfile } from '../../auth/models/auth.model';
import { AuthStore } from '../../auth/store/auth.store';
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
  private readonly auth = inject(AuthStore);

  async getProfile(userId: string): Promise<UserProfile> {
    if (this.auth.isDemo()) return this.auth.profile()!;
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single<UserProfile>();

    if (error) throw error;
    return data;
  }

  async getLevelHistory(userId: string): Promise<readonly LevelHistoryEntry[]> {
    if (this.auth.isDemo()) return [
      { id: 1, profile_id: userId, autovalutazione: 4, livello_calcolato: 3.8, motivo: 'Valutazioni partite', created_at: new Date(Date.now() - 90 * 86400000).toISOString() },
      { id: 2, profile_id: userId, autovalutazione: 4, livello_calcolato: 4.1, motivo: 'Valutazioni partite', created_at: new Date(Date.now() - 45 * 86400000).toISOString() },
      { id: 3, profile_id: userId, autovalutazione: 4, livello_calcolato: 4.3, motivo: 'Valutazioni partite', created_at: new Date().toISOString() },
    ];
    const { data, error } = await this.supabase.client
      .from('profile_level_history')
      .select('*')
      .eq('profile_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as LevelHistoryEntry[];
  }

  async getReliabilityHistory(userId: string): Promise<readonly ReliabilityHistoryEntry[]> {
    if (this.auth.isDemo()) return [
      { id: 1, profile_id: userId, affidabilita: 92, variazione: 2, motivo: 'Presenza confermata', created_at: new Date(Date.now() - 90 * 86400000).toISOString() },
      { id: 2, profile_id: userId, affidabilita: 94, variazione: 2, motivo: 'Presenza confermata', created_at: new Date(Date.now() - 45 * 86400000).toISOString() },
      { id: 3, profile_id: userId, affidabilita: 96, variazione: 2, motivo: 'Presenza confermata', created_at: new Date().toISOString() },
    ];
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
    if (this.auth.isDemo()) return { first_places: 1, second_places: 1, third_places: 1 };
    const { data, error } = await this.supabase.client.rpc('get_profile_tournament_podiums', { p_profile_id: userId });
    if (error) throw error;
    const row = (data as TournamentPodiums[] | null)?.[0];
    return row ?? NO_PODIUMS;
  }

  async setNotifications(enabled: boolean): Promise<void> {
    if (this.auth.isDemo()) return;
    const { error } = await this.supabase.client.rpc('set_in_app_notifications', { p_enabled: enabled });
    if (error) throw error;
  }

  async requestNameChange(nome: string, cognome: string): Promise<void> {
    if (this.auth.isDemo()) return;
    const { error } = await this.supabase.client.rpc('request_name_change', { p_nome: nome, p_cognome: cognome });
    if (error) throw error;
  }

  async changePassword(password: string): Promise<void> {
    if (this.auth.isDemo()) return;
    const { error } = await this.supabase.client.auth.updateUser({ password });
    if (error) throw error;
  }

  async uploadAvatar(userId: string, file: File): Promise<string> {
    if (this.auth.isDemo()) return URL.createObjectURL(file);
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
    if (this.auth.isDemo()) return { ...this.auth.profile()!, city, city_latitude: latitude, city_longitude: longitude, city_place_id: placeId };
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
    if (this.auth.isDemo()) return { ...this.auth.profile()!, ...request };
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
