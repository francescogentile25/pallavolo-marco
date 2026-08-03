import { inject, Injectable } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ChatMessage, ChatReaction, ChatResource } from '../models/chat.model';

const CHAT_SELECT = `
  id, resource_type, resource_id, author_id, body, reply_to_id, reactions,
  text_edited_at, deleted, deleted_at, deleted_by, created_at,
  author:profiles!chat_messages_author_id_fkey(id, nome, cognome),
  reply_to:chat_messages!chat_messages_reply_to_id_fkey(
    id, body, deleted, author:profiles!chat_messages_author_id_fkey(id, nome, cognome)
  )
`;

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly supabase = inject(SupabaseService);

  async getTimeline(type: ChatResource, resourceId: string): Promise<ChatMessage[]> {
    const { data, error } = await this.supabase.client
      .from('chat_messages')
      .select(CHAT_SELECT)
      .eq('resource_type', type)
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as ChatMessage[];
  }

  async post(type: ChatResource, resourceId: string, body: string, replyTo: number | null): Promise<void> {
    const { error } = await this.supabase.client.rpc('post_chat_message', {
      p_type: type,
      p_id: resourceId,
      p_body: body,
      p_reply_to: replyTo,
    });
    if (error) throw error;
  }

  async edit(id: number, body: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('edit_chat_message', { p_id: id, p_body: body });
    if (error) throw error;
  }

  async remove(id: number): Promise<void> {
    const { error } = await this.supabase.client.rpc('delete_chat_message', { p_id: id });
    if (error) throw error;
  }

  async react(id: number, type: ChatReaction): Promise<void> {
    const { error } = await this.supabase.client.rpc('set_chat_reaction', { p_id: id, p_type: type });
    if (error) throw error;
  }

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
