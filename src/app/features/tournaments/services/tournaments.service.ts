import { inject, Injectable } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Court } from '../../matches/models/match.model';
import { CreateTournamentRequest, Tournament, TournamentGameDraft, TournamentRules } from '../models/tournament.model';

const TOURNAMENT_SELECT = `
  *,
  venue:venues!tournaments_venue_id_fkey(id,name,address,city,latitude,longitude),
  courts:tournament_courts(court_id,court:courts!tournament_courts_court_id_fkey(id,venue_id,name,surface,indoor,venue:venues!courts_venue_id_fkey(id,name,address,city,latitude,longitude))),
  teams:tournament_teams(id,tournament_id,status,seed,waitlist_position,members:tournament_team_members(profile_id,status,profile:profiles!tournament_team_members_profile_id_fkey(id,nome,cognome,livello,lato_preferito,avatar_url))),
  brackets:tournament_brackets(bracket_no,name),
  groups:tournament_groups(id,tournament_id,name,position,capacity,planned_matches,links:tournament_group_teams(group_id,team_id,position)),
  games:tournament_games(*,confirmations:tournament_result_confirmations(team_id,profile_id,confirmed_at))
`;

@Injectable({ providedIn: 'root' })
export class TournamentsService {
  private readonly supabase = inject(SupabaseService);

  async getTournaments(): Promise<readonly Tournament[]> {
    const { data, error } = await this.supabase.client.from('tournaments').select(TOURNAMENT_SELECT).order('starts_at');
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
      p_court_ids: request.courtIds, p_gender: request.gender,
      p_min_level: request.minLevel, p_max_level: request.maxLevel,
      p_registration_deadline: request.registrationDeadline, p_starts_at: request.startsAt,
      p_ends_at: request.endsAt, p_cost_cents: request.costCents, p_city: request.city,
    });
    if (error) throw error;
    return this.getTournament((data as { id: string }).id);
  }

  async publish(id: string): Promise<void> { await this.rpc('publish_tournament', { p_tournament_id: id }); }
  async joinSingle(id: string): Promise<void> { await this.rpc('join_tournament_as_single_player', { p_tournament_id: id }); }
  async proposeTeam(id: string, partnerId: string): Promise<void> { await this.rpc('propose_tournament_team', { p_tournament_id: id, p_partner_id: partnerId }); }
  async respondInvite(teamId: string, accept: boolean): Promise<void> { await this.rpc('respond_tournament_team_invite', { p_team_id: teamId, p_accept: accept }); }
  async inviteTeam(id: string, player1: string, player2: string): Promise<void> { await this.rpc('organizer_invite_tournament_team', { p_tournament_id: id, p_player1: player1, p_player2: player2 }); }
  async addPlayer(id: string, playerId: string, groupId: string | null): Promise<void> { await this.rpc('organizer_add_tournament_player', { p_tournament_id: id, p_profile_id: playerId, p_group_id: groupId }); }
  async withdraw(id: string): Promise<void> { await this.rpc('withdraw_from_tournament', { p_tournament_id: id }); }
  async closeRegistrations(id: string): Promise<void> { await this.rpc('close_tournament_registrations', { p_tournament_id: id }); }
  async advanceGroups(id: string): Promise<void> { await this.rpc('advance_tournament_group_stage', { p_tournament_id: id }); }
  async submitResult(gameId: string, first: readonly number[], second: readonly number[]): Promise<void> { await this.rpc('submit_tournament_result', { p_game_id: gameId, p_team1_scores: first, p_team2_scores: second }); }
  async confirmResult(gameId: string): Promise<void> { await this.rpc('confirm_tournament_result', { p_game_id: gameId }); }
  async rescheduleGame(gameId: string, scheduledAt: string, courtId: string): Promise<void> { await this.rpc('reschedule_tournament_game', { p_game_id: gameId, p_scheduled_at: scheduledAt, p_court_id: courtId }); }
  async cancel(id: string): Promise<void> { await this.rpc('cancel_tournament', { p_tournament_id: id }); }
  async archive(id: string): Promise<void> { await this.rpc('archive_tournament', { p_tournament_id: id }); }
  async updateRules(id: string, rules: TournamentRules): Promise<void> { await this.rpc('update_tournament_rules', { p_tournament_id: id, p_rules: rules }); }
  async saveGroup(
    tournamentId: string, groupId: string | null, name: string,
    capacity: number | null = null, plannedMatches: number | null = null,
  ): Promise<void> {
    await this.rpc('upsert_tournament_group', {
      p_tournament_id: tournamentId, p_group_id: groupId, p_name: name, p_position: null,
      p_capacity: capacity, p_planned_matches: plannedMatches,
    });
  }
  async pairSingleTeams(tournamentId: string, first: string, second: string): Promise<void> {
    await this.rpc('organizer_pair_single_teams', { p_tournament_id: tournamentId, p_team1_id: first, p_team2_id: second });
  }
  async removeTeam(tournamentId: string, teamId: string): Promise<void> {
    await this.rpc('organizer_remove_tournament_team', { p_tournament_id: tournamentId, p_team_id: teamId });
  }
  async splitTeam(tournamentId: string, teamId: string): Promise<void> {
    await this.rpc('organizer_split_tournament_team', { p_tournament_id: tournamentId, p_team_id: teamId });
  }
  async setGameCourt(gameId: string, courtId: string | null): Promise<void> {
    await this.rpc('set_tournament_game_court', { p_game_id: gameId, p_court_id: courtId });
  }
  async closeGroups(tournamentId: string): Promise<void> { await this.rpc('close_tournament_groups', { p_tournament_id: tournamentId }); }
  async reopenGroups(tournamentId: string): Promise<void> { await this.rpc('reopen_tournament_groups', { p_tournament_id: tournamentId }); }
  async addBracketRound(tournamentId: string, roundNo: number, slots: number, bracketNo = 1): Promise<void> {
    await this.rpc('generate_tournament_bracket_round', { p_tournament_id: tournamentId, p_round_no: roundNo, p_slots: slots, p_bracket_no: bracketNo });
  }
  async deleteBracket(tournamentId: string, bracketNo: number): Promise<void> {
    await this.rpc('delete_tournament_bracket', { p_tournament_id: tournamentId, p_bracket_no: bracketNo });
  }
  async deleteGroup(tournamentId: string, groupId: string, force = false): Promise<void> {
    await this.rpc('delete_tournament_group', { p_tournament_id: tournamentId, p_group_id: groupId, p_force: force });
  }
  async resetGroups(tournamentId: string): Promise<void> { await this.rpc('reset_tournament_groups', { p_tournament_id: tournamentId }); }
  async setBracketName(tournamentId: string, bracketNo: number, name: string): Promise<void> {
    await this.rpc('set_tournament_bracket_name', { p_tournament_id: tournamentId, p_bracket_no: bracketNo, p_name: name });
  }
  async reopenTournament(tournamentId: string): Promise<void> { await this.rpc('reopen_tournament', { p_tournament_id: tournamentId }); }
  async assignTeamToGroup(tournamentId: string, teamId: string, groupId: string | null): Promise<void> {
    await this.rpc('assign_tournament_team_to_group', { p_tournament_id: tournamentId, p_team_id: teamId, p_group_id: groupId });
  }
  async saveGame(tournamentId: string, game: TournamentGameDraft): Promise<void> {
    await this.rpc('save_tournament_game', {
      p_tournament_id: tournamentId, p_game_id: game.id ?? null, p_phase: game.phase,
      p_group_id: game.groupId, p_round_no: game.roundNo, p_position: game.position,
      p_team1_id: game.team1Id, p_team2_id: game.team2Id, p_bracket_no: game.bracketNo ?? null,
    });
  }
  async deleteGame(tournamentId: string, gameId: string, force = false): Promise<void> {
    await this.rpc('delete_tournament_game', { p_tournament_id: tournamentId, p_game_id: gameId, p_force: force });
  }
  async setPodium(tournamentId: string, first: string | null, second: string | null, third: string | null): Promise<void> {
    await this.rpc('set_tournament_podium', { p_tournament_id: tournamentId, p_first: first, p_second: second, p_third: third });
  }
  async finishTournament(tournamentId: string): Promise<void> { await this.rpc('finish_tournament', { p_tournament_id: tournamentId }); }
  async generateGroupGames(tournamentId: string, groupId: string): Promise<void> { await this.rpc('generate_tournament_group_games', { p_tournament_id: tournamentId, p_group_id: groupId }); }

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
