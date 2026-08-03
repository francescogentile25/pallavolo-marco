export type ChatResource = 'match' | 'tournament';
export type ChatReaction = 'heart' | 'thumbs_up' | 'thumbs_down' | 'laugh' | 'emphasis' | 'question';

export interface ChatAuthor {
  id: string;
  nome: string;
  cognome: string;
}

export interface ChatReactionEntry {
  type: ChatReaction;
  user_id: string;
}

export interface ChatReplyRef {
  id: number;
  body: string;
  deleted: boolean;
  author: ChatAuthor | null;
}

export interface ChatMessage {
  id: number;
  resource_type: ChatResource;
  resource_id: string;
  author_id: string;
  body: string;
  reply_to_id: number | null;
  reactions: ChatReactionEntry[];
  text_edited_at: string | null;
  deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  author: ChatAuthor | null;
  reply_to: ChatReplyRef | null;
}

export interface AggregatedReaction {
  type: ChatReaction;
  emoji: string;
  count: number;
  mine: boolean;
}

export const REACTION_EMOJI: Record<ChatReaction, string> = {
  heart: '❤️',
  thumbs_up: '👍',
  thumbs_down: '👎',
  laugh: '😂',
  emphasis: '‼️',
  question: '❓',
};

export const REACTION_ORDER: ChatReaction[] = [
  'heart',
  'thumbs_up',
  'thumbs_down',
  'laugh',
  'emphasis',
  'question',
];
