import { inject, Injectable } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Court } from '../../matches/models/match.model';
import { CreateTournamentRequest, Tournament } from '../models/tournament.model';

const TOURNAMENT_SELECT = `
  *,
  venue:venues!tournaments_venue_id_fkey(id,name,address,city,latitude,longitude),
  courts:tournament_courts(court_id,court:courts!tournament_courts_court_id_fkey(id,venue_id,name,surface,indoor,venue:venues!courts_venue_id_fkey(id,name,address,city,latitude,longitude))),
  teams:tournament_teams(id,tournament_id,status,seed,waitlist_position,members:tournament_team_members(profile_id,status,profile:profiles!tournament_team_members_profile_id_fkey(id,nome,cognome,livello,lato_preferito,avatar_url))),
  free_players:tournament_free_players(tournament_id,profile_id,status,profile:profiles!tournament_free_players_profile_id_fkey(id,nome,cognome,livello,lato_preferito,avatar_url)),
  groups:tournament_groups(id,tournament_id,name,position,links:tournament_group_teams(group_id,team_id,position)),
  games:tournament_games(*,confirmations:tournament_result_confirmations(team_id,profile_id,confirmed_at))
`;

@Injectable({ providedIn: 'root' })
export class TournamentsService {
  private readonly supabase = inject(SupabaseService);

  async getTournaments(): Promise<readonly Tournament[]> {
    const { data, error } = await this.supabase.client.from('tournaments').select(TOURNAMENT_SELECT).neq('status', 'draft').order('starts_at');
    if (error) throw error;
    return (data ?? []).map(item => this.normalize(item));
  }

  async getTournament(id: string): Promise<Tournament> {
    const { data, error } = await this.supabase.client.from('tournaments').select(TOURNAMENT_SELECT).eq('id', id).single();
    if (error) throw error;
    return this.normalize(data);
  }

  async getCourts(): Promise<readonly Court[]> {
    const { data, error } = await this.supabase.client.from('courts').select('id,venue_id,name,surface,indoor,venue:venues!courts_venue_id_fkey(id,name,address,city,latitude,longitude)').eq('active', true).order('name');
    if (error) throw error;
    return (data ?? []) as unknown as Court[];
  }

  async getPlayers(): Promise<readonly { id: string; nome: string; cognome: string; livello: number; lato_preferito?: string }[]> {
    const { data, error } = await this.supabase.client.rpc('list_invitable_players');
    if (error) throw error;
    return data ?? [];
  }

  async create(request: CreateTournamentRequest): Promise<Tournament> {
    const { data, error } = await this.supabase.client.rpc('create_tournament', {
      p_title: request.title, p_description: request.description, p_venue_id: request.venueId,
      p_court_ids: request.courtIds, p_preset: request.preset, p_registration_mode: request.registrationMode,
      p_format: request.format, p_gender: request.gender, p_min_level: request.minLevel, p_max_level: request.maxLevel,
      p_max_teams: request.maxTeams, p_registration_deadline: request.registrationDeadline,
      p_starts_at: request.startsAt, p_ends_at: request.endsAt, p_cost_cents: request.costCents,
      p_guaranteed_matches: request.guaranteedMatches, p_group_size: request.groupSize,
      p_qualifiers_per_group: request.qualifiersPerGroup, p_group_best_of: request.groupBestOf,
      p_group_set_points: request.groupSetPoints, p_knockout_best_of: request.knockoutBestOf,
      p_knockout_set_points: request.knockoutSetPoints, p_tiebreak_points: request.tiebreakPoints,
      p_win_by_two: request.winByTwo, p_third_place: request.thirdPlace,
      p_standings_win_points: request.standingsWinPoints, p_standings_loss_points: request.standingsLossPoints,
      p_minimum_rest_minutes: request.minimumRestMinutes,
      p_result_confirmation_required: request.resultConfirmationRequired,
    });
    if (error) throw error;
    return this.getTournament((data as { id: string }).id);
  }

  async publish(id: string): Promise<void> { await this.rpc('publish_tournament', { p_tournament_id: id }); }
  async joinFree(id: string): Promise<void> { await this.rpc('join_tournament_as_free_player', { p_tournament_id: id }); }
  async proposeTeam(id: string, partnerId: string): Promise<void> { await this.rpc('propose_tournament_team', { p_tournament_id: id, p_partner_id: partnerId }); }
  async respondInvite(teamId: string, accept: boolean): Promise<void> { await this.rpc('respond_tournament_team_invite', { p_team_id: teamId, p_accept: accept }); }
  async pairFreePlayers(id: string, player1: string, player2: string): Promise<void> { await this.rpc('organizer_pair_free_players', { p_tournament_id: id, p_player1: player1, p_player2: player2 }); }
  async inviteTeam(id: string, player1: string, player2: string): Promise<void> { await this.rpc('organizer_invite_tournament_team', { p_tournament_id: id, p_player1: player1, p_player2: player2 }); }
  async withdraw(id: string): Promise<void> { await this.rpc('withdraw_from_tournament', { p_tournament_id: id }); }
  async closeRegistrations(id: string): Promise<void> { await this.rpc('close_tournament_registrations', { p_tournament_id: id }); }
  async advanceGroups(id: string): Promise<void> { await this.rpc('advance_tournament_group_stage', { p_tournament_id: id }); }
  async submitResult(gameId: string, first: readonly number[], second: readonly number[]): Promise<void> { await this.rpc('submit_tournament_result', { p_game_id: gameId, p_team1_scores: first, p_team2_scores: second }); }
  async confirmResult(gameId: string): Promise<void> { await this.rpc('confirm_tournament_result', { p_game_id: gameId }); }
  async rescheduleGame(gameId: string, scheduledAt: string, courtId: string): Promise<void> { await this.rpc('reschedule_tournament_game', { p_game_id: gameId, p_scheduled_at: scheduledAt, p_court_id: courtId }); }
  async cancel(id: string): Promise<void> { await this.rpc('cancel_tournament', { p_tournament_id: id }); }
  async archive(id: string): Promise<void> { await this.rpc('archive_tournament', { p_tournament_id: id }); }

  subscribe(id: string | null, onChange: () => void): RealtimeChannel {
    const filter = id ? `tournament_id=eq.${id}` : undefined;
    return this.supabase.client.channel(`tournaments-wave-4-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_teams', filter }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_team_members' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_games', filter }, onChange).subscribe();
  }
  async setVisibility(tournamentId: string, visibility: 'public' | 'private'): Promise<void> {
    const { error } = await this.supabase.client.rpc('set_tournament_visibility', {
      p_tournament_id: tournamentId, p_visibility: visibility,
    });
    if (error) throw error;
  }

  removeChannel(channel: RealtimeChannel): void { void this.supabase.client.removeChannel(channel); }

  private async rpc(name: string, args: Record<string, unknown>): Promise<void> {
    const { error } = await this.supabase.client.rpc(name, args); if (error) throw error;
  }
  private normalize(value: unknown): Tournament {
    const raw = value as Record<string, unknown> & { groups?: readonly { id: string; tournament_id: string; name: string; position: number; links?: readonly { group_id: string; team_id: string; position: number }[] }[] };
    return { ...raw, group_teams: (raw.groups ?? []).flatMap(group => group.links ?? []) } as unknown as Tournament;
  }
}
