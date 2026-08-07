import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CourtInput, CourtItem } from '../models/court.model';

interface CourtRow {
  id: string;
  name: string;
  indoor: boolean;
  surface: string;
  owned: boolean;
  venue_id: string;
  venue_name: string;
  address: string;
  city: string;
}

@Injectable({ providedIn: 'root' })
export class CourtsService {
  private readonly supabase = inject(SupabaseService);

  async listMine(): Promise<CourtItem[]> {
    const { data, error } = await this.supabase.client.rpc('list_my_courts');
    if (error) throw error;
    return ((data ?? []) as CourtRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      indoor: r.indoor,
      surface: r.surface,
      owned: r.owned,
      venue: { id: r.venue_id, name: r.venue_name, address: r.address, city: r.city },
    }));
  }

  async create(input: CourtInput): Promise<string> {
    const { data, error } = await this.supabase.client.rpc('create_court_with_venue', {
      p_venue_name: input.venueName,
      p_address: input.address,
      p_city: input.city,
      p_court_name: input.courtName,
      p_indoor: input.indoor,
      p_place_id: input.placeId,
      p_latitude: input.latitude,
      p_longitude: input.longitude,
    });
    if (error) throw error;
    return (data as { id: string }).id;
  }

  async update(id: string, input: CourtInput): Promise<void> {
    const { error } = await this.supabase.client.rpc('update_court', {
      p_court_id: id,
      p_court_name: input.courtName,
      p_indoor: input.indoor,
      p_venue_name: input.venueName,
      p_address: input.address,
      p_city: input.city,
      p_place_id: input.placeId,
      p_latitude: input.latitude,
      p_longitude: input.longitude,
    });
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('delete_court', { p_court_id: id });
    if (error) throw error;
  }
}
