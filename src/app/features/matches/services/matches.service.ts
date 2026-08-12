import { inject, Injectable } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
  BeachMatch,
  Court,
  CreateCourtRequest,
  CreateMatchRequest,
  InvitablePlayer,
  MatchDetails,
  MatchParticipant,
  MatchVisibility,
  UpdateMatchRequest,
} from '../models/match.model';
import { hasCompleteMatchRelations } from '../matches.utils';
import { AuthStore } from '../../auth/store/auth.store';
import { DemoData } from '../../demo/demo-data';

const MATCH_SELECT = `
  *,
  court:courts!matches_court_id_fkey(
    id, venue_id, name, surface, indoor,
    venue:venues!courts_venue_id_fkey(id, name, address, city, latitude, longitude, place_id)
  ),
  participants:match_participants(profile_id, joined_at)
`;

@Injectable({ providedIn: 'root' })
export class MatchesService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthStore);
  private readonly demo = inject(DemoData);

  async getMatches(): Promise<readonly BeachMatch[]> {
    if (this.auth.isDemo()) return this.demo.matches;
    await this.refreshStatuses();
    const { data, error } = await this.supabase.client
      .from('matches')
      .select(MATCH_SELECT)
      .neq('status', 'draft')
      .neq('status', 'cancelled')
      .gte('starts_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
      .order('starts_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).filter(hasCompleteMatchRelations);
  }

  async getMyMatches(userId: string): Promise<readonly BeachMatch[]> {
    if (this.auth.isDemo()) return this.demo.myMatches;
    await this.refreshStatuses();
    const { data: memberships, error: membershipError } = await this.supabase.client
      .from('match_participants')
      .select('match_id')
      .eq('profile_id', userId);
    if (membershipError) throw membershipError;
    const ids = (memberships ?? []).map((item) => item.match_id as string);
    if (!ids.length) return [];

    const { data, error } = await this.supabase.client
      .from('matches')
      .select(MATCH_SELECT)
      .in('id', ids)
      .order('starts_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).filter(hasCompleteMatchRelations);
  }

  async getMatch(matchId: string): Promise<MatchDetails> {
    if (this.auth.isDemo()) return this.demo.getMatch(matchId);
    await this.refreshStatuses();
    const [{ data, error }, participants] = await Promise.all([
      this.supabase.client.from('matches').select(MATCH_SELECT).eq('id', matchId).single(),
      this.getParticipants(matchId),
    ]);
    if (error) throw error;
    if (!hasCompleteMatchRelations(data)) {
      throw new Error('La partita non ha piu un campo valido.');
    }
    return { ...data, participantDetails: participants };
  }

  async getCourts(): Promise<readonly Court[]> {
    if (this.auth.isDemo()) return this.demo.courts;
    // Solo i campi personali (creati o ereditati giocando), via RPC.
    const { data, error } = await this.supabase.client.rpc('list_my_courts');
    if (error) throw error;
    type Row = { id: string; name: string; indoor: boolean; surface: string; venue_id: string; venue_name: string; address: string; city: string };
    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      venue_id: r.venue_id,
      name: r.name,
      surface: r.surface,
      indoor: r.indoor,
      venue: { id: r.venue_id, name: r.venue_name, address: r.address, city: r.city, latitude: null, longitude: null },
    }));
  }

  async getInvitablePlayers(): Promise<readonly InvitablePlayer[]> {
    if (this.auth.isDemo()) return this.demo.friends.map(item => ({ ...item, avatar_url: null }));
    const { data, error } = await this.supabase.client.rpc('list_invitable_players');
    if (error) throw error;
    return (data ?? []) as InvitablePlayer[];
  }

  async createCourt(request: CreateCourtRequest): Promise<Court> {
    if (this.auth.isDemo()) return this.demo.courts[0];
    const { data, error } = await this.supabase.client.rpc('create_court_with_venue', {
      p_venue_name: request.venueName,
      p_address: request.address,
      p_city: request.city,
      p_court_name: request.courtName,
      p_indoor: request.indoor,
      p_place_id: request.placeId,
      p_latitude: request.latitude,
      p_longitude: request.longitude,
    });
    if (error) throw error;
    const court = data as Omit<Court, 'venue'>;
    const courts = await this.getCourts();
    return courts.find((item) => item.id === court.id) ?? (court as Court);
  }

  async createMatch(request: CreateMatchRequest): Promise<MatchDetails> {
    if (this.auth.isDemo()) return this.demo.getMatch('match-aurora');
    const { data, error } = await this.supabase.client.rpc('create_match', {
      p_court_id: request.courtId,
      p_gender: request.gender,
      p_min_level: request.minLevel,
      p_max_level: request.maxLevel,
      p_starts_at: request.startsAt,
      p_duration_minutes: request.durationMinutes,
      p_capacity: request.capacity,
      p_notes: request.notes,
      p_participant_ids: request.invitedPlayerIds,
    });
    if (error) throw error;
    return this.getMatch((data as BeachMatch).id);
  }

  async updateMatch(request: UpdateMatchRequest): Promise<MatchDetails> {
    if (this.auth.isDemo()) return this.demo.getMatch(request.matchId);
    const { data, error } = await this.supabase.client.rpc('update_match', {
      p_match_id: request.matchId,
      p_court_id: request.courtId,
      p_gender: request.gender,
      p_min_level: request.minLevel,
      p_max_level: request.maxLevel,
      p_starts_at: request.startsAt,
      p_duration_minutes: request.durationMinutes,
      p_capacity: request.capacity,
      p_notes: request.notes,
    });
    if (error) throw error;
    return this.getMatch((data as BeachMatch).id);
  }

  async join(matchId: string): Promise<void> {
    if (this.auth.isDemo()) { this.demo.join(matchId); return; }
    const { error } = await this.supabase.client.rpc('join_match', { p_match_id: matchId });
    if (error) throw error;
  }

  async withdraw(matchId: string): Promise<void> {
    if (this.auth.isDemo()) { this.demo.withdraw(matchId); return; }
    const { error } = await this.supabase.client.rpc('withdraw_from_match', { p_match_id: matchId });
    if (error) throw error;
  }

  async cancel(matchId: string): Promise<void> {
    if (this.auth.isDemo()) return;
    const { error } = await this.supabase.client.rpc('cancel_match', { p_match_id: matchId });
    if (error) throw error;
  }

  async close(matchId: string): Promise<void> {
    if (this.auth.isDemo()) return;
    const { error } = await this.supabase.client.rpc('close_match', { p_match_id: matchId });
    if (error) throw error;
  }

  async rate(matchId: string, profileId: string, score: number): Promise<void> {
    if (this.auth.isDemo()) return;
    const { error } = await this.supabase.client.rpc('submit_match_rating', {
      p_match_id: matchId,
      p_rated_profile_id: profileId,
      p_score: score,
    });
    if (error) throw error;
  }

  async reportNoShow(matchId: string, profileId: string, reason: string): Promise<void> {
    if (this.auth.isDemo()) return;
    const { error } = await this.supabase.client.rpc('report_match_no_show', {
      p_match_id: matchId,
      p_profile_id: profileId,
      p_reason: reason,
    });
    if (error) throw error;
  }

  async setMatchVisibility(matchId: string, visibility: MatchVisibility): Promise<void> {
    if (this.auth.isDemo()) return;
    const { error } = await this.supabase.client.rpc('set_match_visibility', {
      p_match_id: matchId,
      p_visibility: visibility,
    });
    if (error) throw error;
  }

  subscribeToMatchChanges(onChange: () => void): RealtimeChannel {
    if (this.auth.isDemo()) return { unsubscribe: () => undefined } as unknown as RealtimeChannel;
    return this.supabase.client
      .channel(`matches-wave-2-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_participants' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_attendance' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_ratings' }, onChange)
      .subscribe();
  }

  removeChannel(channel: RealtimeChannel): void {
    if (this.auth.isDemo()) return;
    void this.supabase.client.removeChannel(channel);
  }

  private async getParticipants(matchId: string): Promise<readonly MatchParticipant[]> {
    const { data, error } = await this.supabase.client.rpc('get_match_participants', {
      p_match_id: matchId,
    });
    if (error) throw error;
    return (data ?? []) as MatchParticipant[];
  }

  private async refreshStatuses(): Promise<void> {
    if (this.auth.isDemo()) return;
    const { error } = await this.supabase.client.rpc('refresh_match_statuses');
    if (error) throw error;
  }
}
