export type ChatResource = 'match' | 'tournament';
export type ChatReaction = 'heart' | 'thumbs_up' | 'thumbs_down' | 'laugh' | 'emphasis' | 'question';

/** Reazione già risolta dal mapper server-side: porta nome del reagente e flag "è mia". */
export interface ChatReactionEntry {
  type: ChatReaction;
  user_id: string;
  author_name: string;
  mine: boolean;
}

/** Menzione: id stabile del profilo + nominativo visualizzato. */
export interface ChatMention {
  user_id: string;
  user_name: string;
}

export interface ChatReplyRef {
  id: number;
  deleted: boolean;
  author_name: string;
  /** Snippet di 80 caratteri; null se il messaggio citato è stato eliminato. */
  body: string | null;
}

export interface ChatMessage {
  id: number;
  resource_type: ChatResource;
  resource_id: string;
  author_id: string;
  author_name: string;
  mine: boolean;
  /** Stringa vuota sui tombstone: il testo non transita mai sul wire. */
  body: string;
  created_at: string;
  text_edited_at: string | null;
  deleted: boolean;
  deleted_at: string | null;
  deleted_by_name: string | null;
  reply_to_id: number | null;
  reply_to: ChatReplyRef | null;
  reactions: ChatReactionEntry[];
  mentions: ChatMention[];
}

/** Menzionabile = ha già scritto almeno un messaggio in quella chat. */
export interface MentionableUser {
  user_id: string;
  name: string;
}

export interface AggregatedReaction {
  type: ChatReaction;
  emoji: string;
  count: number;
  mine: boolean;
  /** Nominativi dei reagenti, per il tooltip della pill. */
  authors: string;
}

/** Frammento di testo della bolla: chip menzione oppure testo semplice. */
export interface TextSegment {
  mention: boolean;
  text: string;
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
