import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AddableUser, FriendProfile, FriendProfileDetails, FriendRequest } from '../models/friend.model';
import { AuthStore } from '../../auth/store/auth.store';
import { DemoData } from '../../demo/demo-data';

@Injectable({ providedIn: 'root' })
export class FriendsService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthStore);
  private readonly demo = inject(DemoData);

  readonly friends = signal<FriendProfile[]>([]);
  readonly requests = signal<FriendRequest[]>([]);
  readonly friendIds = computed(() => new Set(this.friends().map((f) => f.id)));
  private loaded = false;

  async loadAll(): Promise<void> {
    await Promise.all([this.loadFriends(), this.loadRequests()]);
  }

  /** Carica gli amici una sola volta (per i filtri Tutti/Amici). */
  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    await this.loadFriends();
  }

  async loadFriends(): Promise<void> {
    if (this.auth.isDemo()) { this.friends.set(this.demo.friends); return; }
    const { data, error } = await this.supabase.client.rpc('list_friends');
    if (error) throw error;
    this.friends.set((data ?? []) as FriendProfile[]);
  }

  async loadRequests(): Promise<void> {
    if (this.auth.isDemo()) { this.requests.set(this.demo.requests); return; }
    const { data, error } = await this.supabase.client.rpc('list_friend_requests');
    if (error) throw error;
    this.requests.set((data ?? []) as FriendRequest[]);
  }

  async listAddable(): Promise<AddableUser[]> {
    if (this.auth.isDemo()) return this.demo.addable;
    const { data, error } = await this.supabase.client.rpc('list_addable_users');
    if (error) throw error;
    return (data ?? []) as AddableUser[];
  }

  async send(targetId: string): Promise<void> {
    if (this.auth.isDemo()) return;
    const { error } = await this.supabase.client.rpc('send_friend_request', { p_target: targetId });
    if (error) throw error;
  }

  async respond(requestId: number, accept: boolean): Promise<void> {
    if (this.auth.isDemo()) { if (accept) this.friends.set([...this.friends(), { id: 'giulia', nome: 'Giulia', cognome: 'Conti', livello: 4 }]); this.requests.set([]); return; }
    const { error } = await this.supabase.client.rpc('respond_friend_request', { p_id: requestId, p_accept: accept });
    if (error) throw error;
  }

  async remove(otherId: string): Promise<void> {
    if (this.auth.isDemo()) { this.friends.update(items => items.filter(item => item.id !== otherId)); return; }
    const { error } = await this.supabase.client.rpc('remove_friend', { p_other: otherId });
    if (error) throw error;
  }

  async getProfile(id: string): Promise<FriendProfileDetails | null> {
    if (this.auth.isDemo()) { const friend = this.demo.friends.find(item => item.id === id) ?? this.demo.friends[0]; return { ...friend, affidabilita: 95, lato_preferito: 'indifferente', avatar_url: null, matches_played: 18, tournaments_played: 4, tournaments_won: 1, tournaments_second: 1, tournaments_third: 0, tournament_games_played: 14, tournament_games_won: 9, best_set_score: 21 }; }
    const { data, error } = await this.supabase.client.rpc('get_friend_profile', { p_id: id });
    if (error) throw error;
    const row = ((data ?? []) as FriendProfileDetails[])[0];
    return row ?? null;
  }
}
