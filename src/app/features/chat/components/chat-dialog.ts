import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ConfirmationService } from 'primeng/api';
import {
  AggregatedReaction,
  ChatMessage,
  ChatReaction,
  ChatResource,
  MentionableUser,
  REACTION_EMOJI,
  REACTION_ORDER,
  TextSegment,
} from '../models/chat.model';
import { ChatService } from '../services/chat.service';

/** Token menzione: fino a 30 caratteri dopo la chiocciola, fino al caret. */
const MENTION_TOKEN = /@([^@\n]{0,30})$/;
const MAX_MENTION_MATCHES = 6;

@Component({
  selector: 'app-chat-dialog',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="chat-panel" role="dialog" [attr.aria-label]="title()">
        <header class="chat-head">
          <span class="chat-head-title"><i class="pi pi-comments" aria-hidden="true"></i> {{ title() }}</span>
          <button type="button" class="chat-close" (click)="open.set(false)" aria-label="Chiudi chat"><i class="pi pi-times" aria-hidden="true"></i></button>
        </header>

        <div class="chat-body" #bodyEl>
          @if (loading()) {
            <p class="chat-state">Caricamento messaggi…</p>
          } @else if (error()) {
            <p class="chat-state chat-error">{{ error() }}</p>
          } @else if (!messages().length) {
            <p class="chat-state">Ancora nessun messaggio. Scrivi il primo!</p>
          } @else {
            <ol class="chat-list">
              @for (m of messages(); track m.id; let i = $index) {
                <li
                  class="chat-msg"
                  [class.is-mine]="m.mine"
                  [class.is-grouped]="groupedWithPrevious(i)"
                  [class.is-grouped-next]="groupedWithNext(i)"
                  [class.chat-reacted]="aggregated(m).length > 0"
                >
                  @if (m.deleted) {
                    <span class="chat-tomb"><i class="pi pi-ban" aria-hidden="true"></i> Messaggio eliminato da {{ m.deleted_by_name ?? '—' }}</span>
                  } @else {
                    <div class="chat-row">
                      @if (!m.mine && !groupedWithPrevious(i)) { <span class="chat-author">{{ m.author_name }}</span> }
                      <div class="chat-bubble">
                        @if (m.reply_to; as quote) {
                          <div class="chat-quote">
                            <strong>{{ quote.author_name }}</strong>
                            <span>{{ quote.deleted ? 'Messaggio eliminato' : quote.body }}</span>
                          </div>
                        }
                        <p class="chat-text">@for (segment of textSegments(m); track $index) {@if (segment.mention) {<span class="chat-mention">{{ segment.text }}</span>} @else {<span>{{ segment.text }}</span>}}</p>
                        <span class="chat-meta">
                          {{ m.created_at | date: 'HH:mm' }}@if (m.text_edited_at) { <em> · modificato</em> }
                        </span>
                        @if (aggregated(m); as reactions) {
                          @if (reactions.length) {
                            <div class="chat-reactions">
                              @for (r of reactions; track r.type) {
                                <button type="button" class="chat-react-pill" [class.is-mine]="r.mine" [title]="r.authors" (click)="react(m, r.type)">
                                  {{ r.emoji }}@if (r.count > 1) { <span>{{ r.count }}</span> }
                                </button>
                              }
                            </div>
                          }
                        }
                      </div>
                      <div class="chat-actions">
                        <button type="button" class="chat-act" aria-label="Reagisci" (click)="togglePicker(m.id)"><i class="pi pi-heart"></i></button>
                        <button type="button" class="chat-act" aria-label="Rispondi" (click)="startReply(m)"><i class="pi pi-reply"></i></button>
                        @if (m.mine) {
                          <button type="button" class="chat-act" aria-label="Modifica" (click)="startEdit(m)"><i class="pi pi-pencil"></i></button>
                          <button type="button" class="chat-act chat-danger" aria-label="Elimina" (click)="askDelete(m)"><i class="pi pi-trash"></i></button>
                        }
                        @if (pickerId() === m.id) {
                          <div class="chat-picker">
                            @for (t of order; track t) {
                              <button type="button" [attr.aria-label]="t" (click)="react(m, t)">{{ emoji(t) }}</button>
                            }
                          </div>
                        }
                      </div>
                    </div>
                  }
                </li>
              }
            </ol>
          }
        </div>

        <div class="chat-composer">
          @if (replyTo(); as r) {
            <div class="chat-banner">
              <span>Rispondi a <strong>{{ r.author_name }}</strong></span>
              <button type="button" (click)="cancelReply()" aria-label="Annulla"><i class="pi pi-times"></i></button>
            </div>
          }
          @if (editing()) {
            <div class="chat-banner chat-banner-edit">
              <span>Modifica messaggio</span>
              <button type="button" (click)="cancelEdit()" aria-label="Annulla"><i class="pi pi-times"></i></button>
            </div>
          }
          <div class="chat-compose-row">
            <div class="chat-compose-field">
              <textarea
                #composerEl
                class="chat-textarea"
                rows="1"
                maxlength="4000"
                placeholder="Scrivi un messaggio, usa &#64; per menzionare…"
                autocomplete="off"
                [value]="draft()"
                (input)="onComposeInput($event)"
                (keydown)="onKey($event)"
              ></textarea>
              @if (mentionMatches().length) {
                <div class="chat-mention-pop" role="listbox" aria-label="Utenti menzionabili">
                  @for (user of mentionMatches(); track user.user_id) {
                    <button type="button" role="option" [attr.aria-selected]="false" (click)="pickMention(user)">
                      <strong>{{ user.name }}</strong>
                    </button>
                  }
                </div>
              }
            </div>
            <button type="button" class="chat-send" [disabled]="sending() || !draft().trim()" (click)="send()" aria-label="Invia">
              <i class="pi" [class.pi-send]="!sending()" [class.pi-spinner]="sending()" [class.pi-spin]="sending()"></i>
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }
    .chat-panel {
      position: fixed; z-index: var(--z-modal, 1000); display: flex; flex-direction: column;
      border: 1px solid var(--color-border); background: var(--color-surface);
      box-shadow: 0 20px 50px rgb(20 24 26 / .22);
      /* mobile: bottom sheet */
      left: 0; right: 0; bottom: 0; height: 86dvh; border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      animation: chat-slide .2s ease-out;
    }
    @media (min-width: 768px) {
      .chat-panel { left: auto; right: 24px; bottom: 96px; width: 372px; height: min(560px, 72dvh); border-radius: var(--radius-lg); }
    }
    @keyframes chat-slide { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes chat-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes chat-pop { from { opacity: 0; transform: translateY(4px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }

    .chat-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; color: white; border-radius: var(--radius-lg) var(--radius-lg) 0 0; background: linear-gradient(135deg, #0f1b23, #1d2b33); }
    @media (min-width: 768px) { .chat-head { border-radius: var(--radius-lg) var(--radius-lg) 0 0; } }
    .chat-head-title { display: inline-flex; align-items: center; gap: 8px; font-size: .86rem; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chat-close { display: grid; width: 32px; height: 32px; flex: 0 0 32px; place-items: center; color: white; border: 0; border-radius: var(--radius); background: rgb(255 255 255 / .14); cursor: pointer; }
    .chat-close:hover { background: rgb(255 255 255 / .26); }

    .chat-body { flex: 1; display: flex; flex-direction: column; overflow-y: auto; padding: 10px 12px; scroll-behavior: smooth; }
    .chat-state { margin: auto; color: var(--color-ink-muted); font-size: .82rem; text-align: center; }
    .chat-error { color: var(--color-danger); }
    .chat-list { display: flex; flex-direction: column; margin: auto 0 0; padding: 0; list-style: none; }
    .chat-msg { margin-top: 14px; animation: chat-in .18s ease-out; }
    .chat-msg.is-grouped { margin-top: 3px; }
    .chat-msg.chat-reacted { margin-bottom: 20px; }
    .chat-msg.is-mine { align-items: flex-end; display: flex; flex-direction: column; }
    .chat-tomb { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; color: var(--color-ink-muted); border-radius: var(--radius); background: color-mix(in srgb, var(--color-ink) 5%, transparent); font-size: .74rem; font-style: italic; }
    .chat-row { position: relative; display: flex; flex-direction: column; max-width: 82%; }
    .chat-msg.is-mine .chat-row { align-items: flex-end; }
    .chat-author { margin: 0 0 3px 10px; color: var(--color-ink-muted); font-size: .68rem; font-weight: 700; }
    .chat-bubble { position: relative; padding: 8px 13px; border-radius: var(--radius-lg); background: var(--color-surface-muted); }
    .chat-msg.is-mine .chat-bubble { color: white; background: var(--color-brand); }
    /* morphing angoli sui messaggi consecutivi dello stesso autore */
    .chat-msg.is-mine.is-grouped .chat-bubble { border-top-right-radius: 7px; }
    .chat-msg.is-mine.is-grouped-next .chat-bubble { border-bottom-right-radius: 7px; }
    .chat-msg:not(.is-mine).is-grouped .chat-bubble { border-top-left-radius: 7px; }
    .chat-msg:not(.is-mine).is-grouped-next .chat-bubble { border-bottom-left-radius: 7px; }
    .chat-quote { display: grid; gap: 1px; margin-bottom: 5px; padding: 4px 8px; border-left: 3px solid color-mix(in srgb, var(--color-brand) 55%, transparent); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--color-ink) 6%, transparent); font-size: .72rem; }
    .chat-msg.is-mine .chat-quote { border-left-color: rgb(255 255 255 / .6); background: rgb(255 255 255 / .16); }
    .chat-quote strong { font-size: .68rem; }
    .chat-quote span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .85; }
    .chat-text { margin: 0; font-size: .86rem; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
    .chat-mention { padding: 0 3px; color: var(--color-brand-strong); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--color-brand) 14%, transparent); font-weight: 700; }
    .chat-msg.is-mine .chat-mention { color: white; background: rgb(255 255 255 / .24); }
    .chat-meta { display: block; margin-top: 3px; color: var(--color-ink-muted); font-size: .62rem; }
    .chat-msg.is-mine .chat-meta { color: rgb(255 255 255 / .8); }
    .chat-meta em { font-style: italic; }
    .chat-reactions { position: absolute; top: calc(100% + 4px); right: 8px; display: flex; flex-wrap: wrap; gap: 4px; }
    .chat-msg.is-mine .chat-reactions { right: auto; left: 8px; }
    .chat-react-pill { display: inline-flex; align-items: center; gap: 3px; height: 22px; padding: 1px 6px; border: 1px solid var(--color-border); border-radius: 99px; background: var(--color-surface); box-shadow: 0 2px 6px rgb(20 24 26 / .1); font-size: .78rem; cursor: pointer; transition: transform .12s ease; }
    .chat-react-pill:hover { transform: scale(1.07); }
    .chat-react-pill.is-mine { border-color: var(--color-brand); background: color-mix(in srgb, var(--color-brand) 14%, var(--color-surface)); }
    .chat-react-pill span { font-size: .64rem; font-weight: 800; }
    .chat-actions { position: relative; display: flex; gap: 2px; margin-top: 3px; }
    .chat-act { display: grid; width: 28px; height: 28px; place-items: center; color: var(--color-ink-muted); border: 0; border-radius: var(--radius-sm); background: none; font-size: .72rem; cursor: pointer; }
    .chat-act:hover { background: var(--color-surface-muted); }
    .chat-act.chat-danger:hover { color: var(--color-danger); }
    .chat-picker { position: absolute; bottom: calc(100% + 4px); left: 0; z-index: 5; display: flex; gap: 2px; padding: 4px; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); box-shadow: 0 10px 24px rgb(20 24 26 / .16); animation: chat-pop .16s ease-out; }
    .chat-picker button { padding: 3px; border: 0; border-radius: var(--radius-sm); background: none; font-size: 1rem; cursor: pointer; transition: transform .12s ease; }
    .chat-picker button:hover { background: var(--color-surface-muted); transform: scale(1.18); }
    .chat-composer { display: grid; gap: 6px; padding: 10px 12px; border-top: 1px solid var(--color-border); background: var(--color-surface); border-radius: 0 0 20px 20px; }
    @media (min-width: 768px) { .chat-composer { border-radius: 0 0 18px 18px; } }
    .chat-banner { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 10px; border-radius: var(--radius); background: color-mix(in srgb, var(--color-brand) 10%, transparent); font-size: .74rem; animation: chat-pop .16s ease-out; }
    .chat-banner-edit { background: color-mix(in srgb, var(--color-tournament, #e8a838) 16%, transparent); }
    .chat-banner button { display: grid; place-items: center; color: inherit; border: 0; background: none; cursor: pointer; }
    .chat-compose-row { display: flex; align-items: end; gap: 8px; }
    .chat-compose-field { position: relative; flex: 1; display: flex; }
    .chat-textarea { flex: 1; min-height: 42px; max-height: 120px; overflow-y: hidden; padding: 10px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); font: inherit; font-size: .86rem; resize: none; }
    .chat-textarea:focus-visible { outline: 0; border-color: var(--color-brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-brand) 15%, transparent); }
    .chat-mention-pop { position: absolute; bottom: calc(100% + 6px); left: 0; right: 0; z-index: 6; max-height: 220px; overflow-y: auto; padding: 4px; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); box-shadow: 0 12px 28px rgb(20 24 26 / .18); animation: chat-pop .16s ease-out; }
    .chat-mention-pop button { display: flex; width: 100%; min-height: 44px; align-items: center; padding: 8px 10px; border: 0; border-radius: var(--radius); background: none; font: inherit; font-size: .8rem; text-align: left; cursor: pointer; }
    .chat-mention-pop button:hover { background: var(--color-surface-muted); }
    .chat-send { display: grid; width: 42px; height: 42px; flex: 0 0 42px; place-items: center; color: white; border: 0; border-radius: 50%; background: var(--color-brand); cursor: pointer; }
    .chat-send:disabled { background: var(--color-surface-muted); color: var(--color-ink-muted); cursor: not-allowed; }
    .chat-act:focus-visible, .chat-send:focus-visible, .chat-react-pill:focus-visible, .chat-banner button:focus-visible, .chat-close:focus-visible, .chat-mention-pop button:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    @media (max-width: 640px) { .chat-body { padding: 8px 10px; } .chat-row { max-width: 86%; } }
    @media (prefers-reduced-motion: reduce) {
      .chat-panel, .chat-msg, .chat-picker, .chat-banner, .chat-mention-pop { animation: none; }
      .chat-body { scroll-behavior: auto; }
      .chat-react-pill:hover, .chat-picker button:hover { transform: none; }
    }
  `,
})
export class ChatDialog {
  readonly open = model<boolean>(false);
  readonly resourceType = input.required<ChatResource>();
  readonly resourceId = input.required<string | null>();
  readonly title = input<string>('Chat');

  private readonly service = inject(ChatService);
  private readonly confirm = inject(ConfirmationService);
  private readonly bodyEl = viewChild<ElementRef<HTMLElement>>('bodyEl');
  private readonly composerEl = viewChild<ElementRef<HTMLTextAreaElement>>('composerEl');

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sending = signal(false);
  protected readonly draft = signal('');
  protected readonly replyTo = signal<ChatMessage | null>(null);
  protected readonly editing = signal<ChatMessage | null>(null);
  protected readonly pickerId = signal<number | null>(null);
  protected readonly order = REACTION_ORDER;

  private readonly mentionable = signal<MentionableUser[]>([]);
  private readonly draftMentions = signal<MentionableUser[]>([]);
  private readonly mentionQuery = signal<string | null>(null);

  protected readonly mentionMatches = computed<MentionableUser[]>(() => {
    const query = this.mentionQuery();
    if (query == null) return [];
    return this.mentionable()
      .filter((user) => user.name.toLocaleLowerCase('it').includes(query))
      .slice(0, MAX_MENTION_MATCHES);
  });

  private channel: RealtimeChannel | null = null;

  constructor() {
    // Apertura/chiusura: join realtime + load; alla chiusura leave + reset.
    effect(() => {
      const isOpen = this.open();
      const id = this.resourceId();
      untracked(() => {
        if (isOpen && id) this.enter(id);
        else this.leave();
      });
    });
    // Auto-scroll in fondo a ogni variazione della lista.
    effect(() => {
      this.messages();
      untracked(() => setTimeout(() => {
        const el = this.bodyEl()?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      }, 0));
    });
  }

  private enter(id: string): void {
    this.resetCompose();
    void this.load(id);
    if (!this.channel) {
      this.channel = this.service.subscribe(id, () => void this.reloadSilent());
    }
  }

  private leave(): void {
    if (this.channel) { this.service.removeChannel(this.channel); this.channel = null; }
    this.messages.set([]);
    this.mentionable.set([]);
    this.resetCompose();
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [timeline, mentionable] = await Promise.all([
        this.service.getTimeline(this.resourceType(), id),
        this.service.getMentionable(this.resourceType(), id),
      ]);
      this.messages.set(timeline);
      this.mentionable.set(mentionable);
    } catch {
      this.error.set('Chat non disponibile.');
    }
    this.loading.set(false);
  }

  /** Reload silenzioso su push realtime: non tocca loading/error/bozza. */
  private async reloadSilent(): Promise<void> {
    const id = this.resourceId();
    if (!id) return;
    try {
      const [timeline, mentionable] = await Promise.all([
        this.service.getTimeline(this.resourceType(), id),
        this.service.getMentionable(this.resourceType(), id),
      ]);
      this.messages.set(timeline);
      this.mentionable.set(mentionable);
    } catch { /* ignore */ }
  }

  protected emoji(t: ChatReaction): string { return REACTION_EMOJI[t]; }

  protected groupedWithPrevious(index: number): boolean {
    const list = this.messages();
    return this.sameAuthor(list[index - 1], list[index]);
  }

  protected groupedWithNext(index: number): boolean {
    const list = this.messages();
    return this.sameAuthor(list[index], list[index + 1]);
  }

  private sameAuthor(first?: ChatMessage, second?: ChatMessage): boolean {
    return !!first && !!second && !first.deleted && !second.deleted && first.author_id === second.author_id;
  }

  /** Aggrega per tipo nell'ordine fisso; esclude i tipi a contatore zero. */
  protected aggregated(m: ChatMessage): AggregatedReaction[] {
    return REACTION_ORDER.map((type) => {
      const list = m.reactions.filter((r) => r.type === type);
      return {
        type,
        emoji: REACTION_EMOJI[type],
        count: list.length,
        mine: list.some((r) => r.mine),
        authors: list.map((r) => r.author_name).join(', '),
      };
    }).filter((r) => r.count > 0);
  }

  /** Split del testo in chip menzione: nomi dedup e ordinati per lunghezza discendente. */
  protected textSegments(m: ChatMessage): TextSegment[] {
    const names = [...new Set(m.mentions.map((mention) => mention.user_name))].sort((a, b) => b.length - a.length);
    if (!names.length) return [{ mention: false, text: m.body }];
    const pattern = new RegExp(`(@(?:${names.map((name) => this.escapeRegExp(name)).join('|')}))`, 'g');
    return m.body
      .split(pattern)
      .filter((part) => part.length > 0)
      .map((part) => ({ mention: names.some((name) => part === `@${name}`), text: part }));
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  protected onComposeInput(event: Event): void {
    const area = event.target as HTMLTextAreaElement;
    this.draft.set(area.value);
    this.autoGrow(area);
    const uptoCaret = area.value.slice(0, area.selectionStart ?? area.value.length);
    const match = MENTION_TOKEN.exec(uptoCaret);
    this.mentionQuery.set(match ? match[1].toLocaleLowerCase('it') : null);
  }

  protected pickMention(user: MentionableUser): void {
    const area = this.composerEl()?.nativeElement;
    const text = this.draft();
    const caret = area?.selectionStart ?? text.length;
    const at = text.slice(0, caret).lastIndexOf('@');
    if (at < 0) return;
    this.draft.set(`${text.slice(0, at)}@${user.name} ${text.slice(caret)}`);
    if (!this.draftMentions().some((item) => item.user_id === user.user_id)) {
      this.draftMentions.update((list) => [...list, user]);
    }
    this.mentionQuery.set(null);
    queueMicrotask(() => {
      const position = at + user.name.length + 2;
      area?.setSelectionRange(position, position);
      area?.focus();
    });
  }

  /** Al send tiene solo le menzioni il cui "@nome" è ancora presente nel testo. */
  private activeMentions(): string[] {
    return this.draftMentions()
      .filter((mention) => this.draft().includes(`@${mention.name}`))
      .map((mention) => mention.user_id);
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.mentionMatches().length) {
      event.preventDefault();
      this.mentionQuery.set(null);
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    const matches = this.mentionMatches();
    if (matches.length) this.pickMention(matches[0]);
    else void this.send();
  }

  protected async send(): Promise<void> {
    const text = this.draft().trim();
    const id = this.resourceId();
    if (!text || !id || this.sending()) return;
    this.sending.set(true);
    try {
      const mentions = this.activeMentions();
      const editing = this.editing();
      const timeline = editing
        ? await this.service.edit(editing.id, text, mentions)
        : await this.service.post(this.resourceType(), id, text, this.replyTo()?.id ?? null, mentions);
      this.messages.set(timeline);
      this.resetCompose();
      void this.refreshMentionable(id);
    } catch {
      this.error.set('Invio non riuscito. Riprova.');
    }
    this.sending.set(false);
  }

  private async refreshMentionable(id: string): Promise<void> {
    try { this.mentionable.set(await this.service.getMentionable(this.resourceType(), id)); } catch { /* ignore */ }
  }

  /**
   * La casella si adatta al testo invece di mostrare una barra: cresce fino al
   * massimo previsto, e solo oltre quello lascia scorrere.
   */
  private autoGrow(area: HTMLTextAreaElement | undefined): void {
    if (!area) return;
    area.style.height = 'auto';
    const max = parseFloat(getComputedStyle(area).maxHeight) || 120;
    area.style.height = `${Math.min(area.scrollHeight, max)}px`;
    area.style.overflowY = area.scrollHeight > max ? 'auto' : 'hidden';
  }

  protected startReply(m: ChatMessage): void { this.editing.set(null); this.replyTo.set(m); this.pickerId.set(null); }
  protected cancelReply(): void { this.replyTo.set(null); }

  protected startEdit(m: ChatMessage): void {
    this.replyTo.set(null);
    this.editing.set(m);
    this.draft.set(m.body);
    this.draftMentions.set(m.mentions.map((mention) => ({ user_id: mention.user_id, name: mention.user_name })));
    queueMicrotask(() => this.autoGrow(this.composerEl()?.nativeElement));
    this.pickerId.set(null);
  }

  protected cancelEdit(): void { this.editing.set(null); this.draft.set(''); this.draftMentions.set([]); }
  protected togglePicker(id: number): void { this.pickerId.update((value) => (value === id ? null : id)); }

  protected async react(m: ChatMessage, type: ChatReaction): Promise<void> {
    this.pickerId.set(null);
    try { this.messages.set(await this.service.react(m.id, type)); } catch { /* ignore */ }
  }

  protected askDelete(m: ChatMessage): void {
    this.confirm.confirm({
      header: 'Elimina messaggio',
      message: 'Vuoi eliminare questo messaggio? Resterà "Messaggio eliminato".',
      icon: 'pi pi-trash',
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', variant: 'text' },
      accept: async () => {
        try { this.messages.set(await this.service.remove(m.id)); } catch { /* ignore */ }
      },
    });
  }

  private resetCompose(): void {
    this.draft.set('');
    queueMicrotask(() => this.autoGrow(this.composerEl()?.nativeElement));
    this.replyTo.set(null);
    this.editing.set(null);
    this.pickerId.set(null);
    this.draftMentions.set([]);
    this.mentionQuery.set(null);
  }
}
