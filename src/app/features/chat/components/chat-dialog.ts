import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
  ElementRef,
  computed,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ConfirmationService } from 'primeng/api';
import { AuthStore } from '../../auth/store/auth.store';
import {
  AggregatedReaction,
  ChatAuthor,
  ChatMessage,
  ChatReaction,
  ChatResource,
  REACTION_EMOJI,
  REACTION_ORDER,
} from '../models/chat.model';
import { ChatService } from '../services/chat.service';

@Component({
  selector: 'app-chat-dialog',
  imports: [DatePipe, FormsModule],
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
                <li class="chat-msg" [class.is-mine]="mine(m)" [class.is-grouped]="grouped(i)">
                  @if (m.deleted) {
                    <span class="chat-tomb"><i class="pi pi-ban" aria-hidden="true"></i> Messaggio eliminato</span>
                  } @else {
                    <div class="chat-row">
                      @if (!mine(m) && !grouped(i)) { <span class="chat-author">{{ name(m.author) }}</span> }
                      <div class="chat-bubble">
                        @if (m.reply_to) {
                          <div class="chat-quote">
                            <strong>{{ name(m.reply_to.author) }}</strong>
                            <span>{{ m.reply_to.deleted ? 'Messaggio eliminato' : snippet(m.reply_to.body) }}</span>
                          </div>
                        }
                        <p class="chat-text">{{ m.body }}</p>
                        <span class="chat-meta">
                          {{ m.created_at | date: 'HH:mm' }}@if (m.text_edited_at) { <em> · modificato</em> }
                        </span>
                        @if (aggregated(m).length) {
                          <div class="chat-reactions">
                            @for (r of aggregated(m); track r.type) {
                              <button type="button" class="chat-react-pill" [class.is-mine]="r.mine" (click)="react(m, r.type)">
                                {{ r.emoji }}@if (r.count > 1) { <span>{{ r.count }}</span> }
                              </button>
                            }
                          </div>
                        }
                      </div>
                      <div class="chat-actions">
                        <button type="button" class="chat-act" aria-label="Reagisci" (click)="togglePicker(m.id)"><i class="pi pi-heart"></i></button>
                        <button type="button" class="chat-act" aria-label="Rispondi" (click)="startReply(m)"><i class="pi pi-reply"></i></button>
                        @if (mine(m)) {
                          <button type="button" class="chat-act" aria-label="Modifica" (click)="startEdit(m)"><i class="pi pi-pencil"></i></button>
                          <button type="button" class="chat-act chat-danger" aria-label="Elimina" (click)="askDelete(m)"><i class="pi pi-trash"></i></button>
                        }
                        @if (pickerId() === m.id) {
                          <div class="chat-picker">
                            @for (t of order; track t) {
                              <button type="button" (click)="react(m, t)">{{ emoji(t) }}</button>
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
              <span>Rispondi a <strong>{{ name(r.author) }}</strong></span>
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
            <textarea
              class="chat-textarea"
              rows="1"
              maxlength="4000"
              placeholder="Scrivi un messaggio…"
              autocomplete="off"
              [ngModel]="draft()"
              (ngModelChange)="draft.set($event)"
              (keydown)="onKey($event)"
            ></textarea>
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
      left: 0; right: 0; bottom: 0; height: 86dvh; border-radius: 20px 20px 0 0;
      animation: chat-slide .2s ease-out;
    }
    @media (min-width: 768px) {
      .chat-panel { left: auto; right: 24px; bottom: 96px; width: 372px; height: min(560px, 72dvh); border-radius: 18px; }
    }
    @keyframes chat-slide { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-reduced-motion: reduce) { .chat-panel { animation: none; } }

    .chat-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; color: white; border-radius: 20px 20px 0 0; background: linear-gradient(135deg, #071d26, #123945); }
    @media (min-width: 768px) { .chat-head { border-radius: 18px 18px 0 0; } }
    .chat-head-title { display: inline-flex; align-items: center; gap: 8px; font-size: .86rem; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chat-close { display: grid; width: 32px; height: 32px; flex: 0 0 32px; place-items: center; color: white; border: 0; border-radius: 9px; background: rgb(255 255 255 / .14); cursor: pointer; }
    .chat-close:hover { background: rgb(255 255 255 / .26); }

    .chat-body { flex: 1; display: flex; flex-direction: column; overflow-y: auto; padding: 10px 12px; }
    .chat-state { margin: auto; color: var(--color-ink-muted); font-size: .82rem; text-align: center; }
    .chat-error { color: var(--color-danger); }
    .chat-list { display: flex; flex-direction: column; margin: auto 0 0; padding: 0; list-style: none; }
    .chat-msg { margin-top: 14px; }
    .chat-msg.is-grouped { margin-top: 3px; }
    .chat-msg.is-mine { align-items: flex-end; display: flex; flex-direction: column; }
    .chat-tomb { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; color: var(--color-ink-muted); border-radius: 14px; background: color-mix(in srgb, var(--color-ink) 5%, transparent); font-size: .74rem; font-style: italic; }
    .chat-row { position: relative; display: flex; flex-direction: column; max-width: 82%; }
    .chat-msg.is-mine .chat-row { align-items: flex-end; }
    .chat-author { margin: 0 0 3px 10px; color: var(--color-ink-muted); font-size: .68rem; font-weight: 700; }
    .chat-bubble { position: relative; padding: 8px 13px; border-radius: 18px; background: var(--color-surface-muted); }
    .chat-msg.is-mine .chat-bubble { color: white; background: var(--color-brand); }
    .chat-quote { display: grid; gap: 1px; margin-bottom: 5px; padding: 4px 8px; border-left: 3px solid color-mix(in srgb, var(--color-brand) 55%, transparent); border-radius: 7px; background: color-mix(in srgb, var(--color-ink) 6%, transparent); font-size: .72rem; }
    .chat-msg.is-mine .chat-quote { border-left-color: rgb(255 255 255 / .6); background: rgb(255 255 255 / .16); }
    .chat-quote strong { font-size: .68rem; }
    .chat-quote span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .85; }
    .chat-text { margin: 0; font-size: .86rem; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
    .chat-meta { display: block; margin-top: 3px; color: var(--color-ink-muted); font-size: .62rem; }
    .chat-msg.is-mine .chat-meta { color: rgb(255 255 255 / .8); }
    .chat-meta em { font-style: italic; }
    .chat-reactions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
    .chat-react-pill { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border: 1px solid var(--color-border); border-radius: 99px; background: var(--color-surface); font-size: .78rem; cursor: pointer; }
    .chat-react-pill.is-mine { border-color: var(--color-brand); background: color-mix(in srgb, var(--color-brand) 14%, var(--color-surface)); }
    .chat-react-pill span { font-size: .64rem; font-weight: 800; }
    .chat-actions { position: relative; display: flex; gap: 2px; margin-top: 3px; }
    .chat-act { display: grid; width: 28px; height: 28px; place-items: center; color: var(--color-ink-muted); border: 0; border-radius: 8px; background: none; font-size: .72rem; cursor: pointer; }
    .chat-act:hover { background: var(--color-surface-muted); }
    .chat-act.chat-danger:hover { color: var(--color-danger); }
    .chat-picker { position: absolute; bottom: calc(100% + 4px); left: 0; z-index: 5; display: flex; gap: 2px; padding: 4px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); box-shadow: 0 10px 24px rgb(20 24 26 / .16); }
    .chat-picker button { padding: 3px; border: 0; border-radius: 8px; background: none; font-size: 1rem; cursor: pointer; }
    .chat-picker button:hover { background: var(--color-surface-muted); }
    .chat-composer { display: grid; gap: 6px; padding: 10px 12px; border-top: 1px solid var(--color-border); background: var(--color-surface); border-radius: 0 0 20px 20px; }
    @media (min-width: 768px) { .chat-composer { border-radius: 0 0 18px 18px; } }
    .chat-banner { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 10px; border-radius: 10px; background: color-mix(in srgb, var(--color-brand) 10%, transparent); font-size: .74rem; }
    .chat-banner-edit { background: color-mix(in srgb, var(--color-tournament, #e8a838) 16%, transparent); }
    .chat-banner button { display: grid; place-items: center; color: inherit; border: 0; background: none; cursor: pointer; }
    .chat-compose-row { display: flex; align-items: end; gap: 8px; }
    .chat-textarea { flex: 1; min-height: 42px; max-height: 120px; padding: 10px 14px; border: 1px solid var(--color-border); border-radius: 20px; background: var(--color-surface); font: inherit; font-size: .86rem; resize: none; }
    .chat-textarea:focus-visible { outline: 0; border-color: var(--color-brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-brand) 15%, transparent); }
    .chat-send { display: grid; width: 42px; height: 42px; flex: 0 0 42px; place-items: center; color: white; border: 0; border-radius: 50%; background: var(--color-brand); cursor: pointer; }
    .chat-send:disabled { background: var(--color-surface-muted); color: var(--color-ink-muted); cursor: not-allowed; }
    .chat-act:focus-visible, .chat-send:focus-visible, .chat-react-pill:focus-visible, .chat-banner button:focus-visible, .chat-close:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
  `,
})
export class ChatDialog {
  readonly open = model<boolean>(false);
  readonly resourceType = input.required<ChatResource>();
  readonly resourceId = input.required<string | null>();
  readonly title = input<string>('Chat');

  private readonly service = inject(ChatService);
  private readonly authStore = inject(AuthStore);
  private readonly confirm = inject(ConfirmationService);
  private readonly bodyEl = viewChild<ElementRef<HTMLElement>>('bodyEl');

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sending = signal(false);
  protected readonly draft = signal('');
  protected readonly replyTo = signal<ChatMessage | null>(null);
  protected readonly editing = signal<ChatMessage | null>(null);
  protected readonly pickerId = signal<number | null>(null);
  protected readonly order = REACTION_ORDER;

  private readonly userId = computed(() => this.authStore.authUser()?.id ?? null);
  private channel: RealtimeChannel | null = null;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const id = this.resourceId();
      untracked(() => {
        if (isOpen && id) this.enter(id);
        else this.leave();
      });
    });
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
    this.resetCompose();
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.messages.set(await this.service.getTimeline(this.resourceType(), id));
    } catch {
      this.error.set('Chat non disponibile.');
    }
    this.loading.set(false);
  }

  private async reloadSilent(): Promise<void> {
    const id = this.resourceId();
    if (!id) return;
    try { this.messages.set(await this.service.getTimeline(this.resourceType(), id)); } catch { /* ignore */ }
  }

  protected mine(m: ChatMessage): boolean { return m.author_id === this.userId(); }
  protected name(a: ChatAuthor | null): string { return a ? `${a.nome} ${a.cognome}` : '—'; }
  protected emoji(t: ChatReaction): string { return REACTION_EMOJI[t]; }
  protected snippet(text: string): string { return text.length <= 80 ? text : text.slice(0, 80) + '…'; }

  protected grouped(index: number): boolean {
    const list = this.messages();
    const current = list[index];
    const prev = list[index - 1];
    return !!prev && !prev.deleted && !current.deleted && prev.author_id === current.author_id;
  }

  protected aggregated(m: ChatMessage): AggregatedReaction[] {
    const uid = this.userId();
    return REACTION_ORDER.map((type) => {
      const list = m.reactions.filter((r) => r.type === type);
      return { type, emoji: REACTION_EMOJI[type], count: list.length, mine: list.some((r) => r.user_id === uid) };
    }).filter((r) => r.count > 0);
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected async send(): Promise<void> {
    const text = this.draft().trim();
    const id = this.resourceId();
    if (!text || !id || this.sending()) return;
    this.sending.set(true);
    try {
      const editing = this.editing();
      if (editing) await this.service.edit(editing.id, text);
      else await this.service.post(this.resourceType(), id, text, this.replyTo()?.id ?? null);
      this.resetCompose();
      await this.reloadSilent();
    } catch {
      this.error.set('Invio non riuscito. Riprova.');
    }
    this.sending.set(false);
  }

  protected startReply(m: ChatMessage): void { this.editing.set(null); this.replyTo.set(m); this.pickerId.set(null); }
  protected cancelReply(): void { this.replyTo.set(null); }
  protected startEdit(m: ChatMessage): void { this.replyTo.set(null); this.editing.set(m); this.draft.set(m.body); this.pickerId.set(null); }
  protected cancelEdit(): void { this.editing.set(null); this.draft.set(''); }
  protected togglePicker(id: number): void { this.pickerId.update((v) => (v === id ? null : id)); }

  protected async react(m: ChatMessage, type: ChatReaction): Promise<void> {
    this.pickerId.set(null);
    try { await this.service.react(m.id, type); await this.reloadSilent(); } catch { /* ignore */ }
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
        try { await this.service.remove(m.id); await this.reloadSilent(); } catch { /* ignore */ }
      },
    });
  }

  private resetCompose(): void {
    this.draft.set('');
    this.replyTo.set(null);
    this.editing.set(null);
    this.pickerId.set(null);
  }
}
