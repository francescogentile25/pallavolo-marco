import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AddableUser, FriendProfile, FriendProfileDetails, FriendRequest } from '../models/friend.model';

@Injectable({ providedIn: 'root' })
export class FriendsService {
  private readonly supabase = inject(SupabaseService);

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
    const { data, error } = await this.supabase.client.rpc('list_friends');
    if (error) throw error;
    this.friends.set((data ?? []) as FriendProfile[]);
  }

  async loadRequests(): Promise<void> {
    const { data, error } = await this.supabase.client.rpc('list_friend_requests');
    if (error) throw error;
    this.requests.set((data ?? []) as FriendRequest[]);
  }

  async listAddable(): Promise<AddableUser[]> {
    const { data, error } = await this.supabase.client.rpc('list_addable_users');
    if (error) throw error;
    return (data ?? []) as AddableUser[];
  }

  async send(targetId: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('send_friend_request', { p_target: targetId });
    if (error) throw error;
  }

  async respond(requestId: number, accept: boolean): Promise<void> {
    const { error } = await this.supabase.client.rpc('respond_friend_request', { p_id: requestId, p_accept: accept });
    if (error) throw error;
  }

  async remove(otherId: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('remove_friend', { p_other: otherId });
    if (error) throw error;
  }

  async getProfile(id: string): Promise<FriendProfileDetails | null> {
    const { data, error } = await this.supabase.client.rpc('get_friend_profile', { p_id: id });
    if (error) throw error;
    const row = ((data ?? []) as FriendProfileDetails[])[0];
    return row ?? null;
  }
}
