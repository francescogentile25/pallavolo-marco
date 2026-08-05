import { inject, Injectable } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ChatMessage, ChatReaction, ChatResource, MentionableUser } from '../models/chat.model';

/**
 * Timeline e mutazioni passano da RPC security definer: il mapper server-side risolve in
 * batch i nominativi (autore, citato, reagenti, menzionati, autore dell'eliminazione).
 * Ogni mutazione ritorna la timeline completa aggiornata: il client sostituisce l'intera
 * lista, senza merge incrementale.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly supabase = inject(SupabaseService);

  async getTimeline(type: ChatResource, resourceId: string): Promise<ChatMessage[]> {
    const { data, error } = await this.supabase.client.rpc('get_chat_timeline', { p_type: type, p_id: resourceId });
    if (error) throw error;
    return (data ?? []) as ChatMessage[];
  }

  async getMentionable(type: ChatResource, resourceId: string): Promise<MentionableUser[]> {
    const { data, error } = await this.supabase.client.rpc('get_chat_mentionable', { p_type: type, p_id: resourceId });
    if (error) throw error;
    return (data ?? []) as MentionableUser[];
  }

  async post(
    type: ChatResource,
    resourceId: string,
    body: string,
    replyTo: number | null,
    mentions: readonly string[],
  ): Promise<ChatMessage[]> {
    const { data, error } = await this.supabase.client.rpc('post_chat_message', {
      p_type: type,
      p_id: resourceId,
      p_body: body,
      p_reply_to: replyTo,
      p_mentions: mentions,
    });
    if (error) throw error;
    return (data ?? []) as ChatMessage[];
  }

  async edit(id: number, body: string, mentions: readonly string[]): Promise<ChatMessage[]> {
    const { data, error } = await this.supabase.client.rpc('edit_chat_message', {
      p_id: id,
      p_body: body,
      p_mentions: mentions,
    });
    if (error) throw error;
    return (data ?? []) as ChatMessage[];
  }

  async remove(id: number): Promise<ChatMessage[]> {
    const { data, error } = await this.supabase.client.rpc('delete_chat_message', { p_id: id });
    if (error) throw error;
    return (data ?? []) as ChatMessage[];
  }

  async react(id: number, type: ChatReaction): Promise<ChatMessage[]> {
    const { data, error } = await this.supabase.client.rpc('set_chat_reaction', { p_id: id, p_type: type });
    if (error) throw error;
    return (data ?? []) as ChatMessage[];
  }

  /** Il push realtime è un mero segnale di refresh: il contenuto resta gated dalla RPC. */
  subscribe(resourceId: string, onChange: () => void): RealtimeChannel {
    return this.supabase.client
      .channel(`chat-${resourceId}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `resource_id=eq.${resourceId}` },
        onChange,
      )
      .subscribe();
  }

  removeChannel(channel: RealtimeChannel): void {
    void this.supabase.client.removeChannel(channel);
  }
}
