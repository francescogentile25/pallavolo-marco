import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';
import { TourDefinition } from './tour.model';

export const APP_TOURS: readonly TourDefinition[] = [
  { id: 'beach-volley-hub-player-v1', label: 'Tour per giocatore', route: '/app', roles: ['giocatore'] },
  { id: 'beach-volley-hub-organizer-v1', label: 'Tour per organizzatore', route: '/app', roles: ['organizzatore', 'admin'] },
];

@Injectable({ providedIn: 'root' })
export class TourPersistenceService {
  private readonly supabase = inject(SupabaseService);

  definitionFor(role: string | null | undefined): TourDefinition {
    return role === 'organizzatore' || role === 'admin' ? APP_TOURS[1] : APP_TOURS[0];
  }

  canRun(definition: TourDefinition, role: string | null | undefined): boolean {
    return !definition.roles?.length || definition.roles.includes(role ?? '');
  }

  async hasSeen(definition: TourDefinition, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase.client
      .from('user_tour_preferences')
      .select('has_seen')
      .eq('profile_id', userId)
      .eq('tour_id', definition.id)
      .maybeSingle();
    if (error) throw error;
    return data?.has_seen === true;
  }

  async markSeen(definition: TourDefinition, userId: string): Promise<void> {
    const { error } = await this.supabase.client.from('user_tour_preferences').upsert({
      profile_id: userId,
      tour_id: definition.id,
      has_seen: true,
      seen_at: new Date().toISOString(),
    }, { onConflict: 'profile_id,tour_id' });
    if (error) throw error;
  }

  async reset(definition: TourDefinition, userId: string): Promise<void> {
    const { error } = await this.supabase.client.from('user_tour_preferences').upsert({
      profile_id: userId,
      tour_id: definition.id,
      has_seen: false,
      seen_at: null,
    }, { onConflict: 'profile_id,tour_id' });
    if (error) throw error;
  }
}
