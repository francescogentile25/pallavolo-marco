import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { AddableUser } from '../models/friend.model';
import { FriendsService } from '../services/friends.service';

@Component({
  selector: 'app-friends-page',
  imports: [FormsModule, RouterLink, Button, InputText, Paginator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="friends-page">
      <header class="friends-hero">
        <p class="eyebrow">La tua rete</p>
        <h1>Amici</h1>
        <p>Aggiungi giocatori, accetta le richieste e ritrovali velocemente quando crei una partita.</p>
      </header>

      @if (service.requests().length) {
        <section class="block" aria-label="Richieste ricevute">
          <h2>Richieste ({{ service.requests().length }})</h2>
          @for (r of service.requests(); track r.request_id) {
            <article class="row">
              <span class="avatar">{{ initials(r.nome, r.cognome) }}</span>
              <div class="row-body"><strong>{{ r.nome }} {{ r.cognome }}</strong><small>Livello {{ r.livello }}</small></div>
              <div class="row-actions">
                <p-button size="small" label="Accetta" icon="pi pi-check" [loading]="busy() === r.id" (onClick)="respond(r.request_id, r.id, true)" />
                <p-button size="small" severity="secondary" [outlined]="true" label="Rifiuta" [loading]="busy() === r.id" (onClick)="respond(r.request_id, r.id, false)" />
              </div>
            </article>
          }
        </section>
      }

      <section class="block" aria-label="I tuoi amici">
        <h2>I tuoi amici ({{ service.friends().length }})</h2>
        @for (f of service.friends(); track f.id) {
          <article class="row">
            <a class="row-body link" [routerLink]="['/giocatori', f.id]">
              <span class="avatar">{{ initials(f.nome, f.cognome) }}</span>
              <span class="row-text"><strong>{{ f.nome }} {{ f.cognome }}</strong><small>Livello {{ f.livello }}</small></span>
            </a>
            <div class="row-actions">
              <p-button size="small" severity="secondary" [text]="true" label="Rimuovi" icon="pi pi-user-minus" [loading]="busy() === f.id" (onClick)="remove(f.id)" />
            </div>
          </article>
        } @empty {
          <p class="empty">Ancora nessun amico. Aggiungine qualcuno qui sotto.</p>
        }
      </section>

      <section class="block" aria-label="Aggiungi amici">
        <h2>Aggiungi amici</h2>
        <span class="search">
          <i class="pi pi-search" aria-hidden="true"></i>
          <input pInputText type="search" placeholder="Cerca un giocatore" [ngModel]="search()" (ngModelChange)="onSearch($event)" />
        </span>
        @for (u of pagedAddable(); track u.id) {
          <article class="row">
            <span class="avatar">{{ initials(u.nome, u.cognome) }}</span>
            <div class="row-body"><strong>{{ u.nome }} {{ u.cognome }}</strong><small>Livello {{ u.livello }}</small></div>
            <div class="row-actions">
              @switch (u.relation) {
                @case ('friend') { <span class="badge ok"><i class="pi pi-check"></i> Amico</span> }
                @case ('outgoing') { <span class="badge">In attesa</span> }
                @case ('incoming') { <p-button size="small" label="Accetta" icon="pi pi-check" [loading]="busy() === u.id" (onClick)="send(u.id)" /> }
                @default { <p-button size="small" severity="secondary" [outlined]="true" label="Aggiungi" icon="pi pi-user-plus" [loading]="busy() === u.id" (onClick)="send(u.id)" /> }
              }
            </div>
          </article>
        } @empty {
          <p class="empty">Nessun giocatore trovato.</p>
        }
        @if (filteredAddable().length > rows()) {
          <p-paginator [first]="first()" [rows]="rows()" [totalRecords]="filteredAddable().length" (onPageChange)="onPage($event)" />
        }
      </section>
    </main>
  `,
  styles: `
    :host { display: block; }
    .friends-page { width: min(100%, 760px); padding: 18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 48px); margin: 0 auto; }
    .friends-hero { padding: 22px 4px 14px; }
    .eyebrow { margin: 0 0 8px; color: var(--color-brand-strong); font-size: .72rem; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
    h1 { margin: 0 0 8px; font: 900 clamp(2rem, 9vw, 3.4rem)/.95 var(--display-font); letter-spacing: -.045em; }
    .friends-hero p:last-of-type { max-width: 44rem; margin: 0; color: var(--color-ink-muted); line-height: 1.5; }
    .block { margin-top: 18px; }
    .block h2 { margin: 0 0 10px; font: 900 1.2rem/1 var(--display-font); }
    .row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 10px 12px; margin-bottom: 8px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); }
    .avatar { display: grid; width: 40px; height: 40px; place-items: center; color: white; border-radius: 12px; background: var(--color-brand-strong); font-size: .72rem; font-weight: 850; }
    .row-body { display: grid; gap: 2px; min-width: 0; }
    .row-body strong { font-size: .84rem; }
    .row-body small { color: var(--color-ink-muted); font-size: .7rem; }
    a.row-body.link { grid-column: 1 / 3; display: flex; align-items: center; gap: 12px; text-decoration: none; color: inherit; }
    a.row-body.link:hover strong { color: var(--color-brand-strong); }
    .row-text { display: grid; gap: 2px; min-width: 0; }
    .row-text strong { font-size: .84rem; }
    .row-text small { color: var(--color-ink-muted); font-size: .7rem; }
    :host ::ng-deep .p-paginator { justify-content: center; flex-wrap: wrap; margin-top: 6px; background: transparent; border: 0; }
    .row-actions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
    .badge { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 99px; background: var(--color-surface-muted); color: var(--color-ink-muted); font-size: .68rem; font-weight: 750; }
    .badge.ok { color: var(--color-success); background: var(--color-success-soft); }
    .search { position: relative; display: block; margin-bottom: 10px; }
    .search i { position: absolute; top: 50%; left: 14px; color: var(--color-ink-muted); transform: translateY(-50%); }
    .search input { width: 100%; min-height: 46px; padding-left: 40px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); }
    .empty { padding: 14px; color: var(--color-ink-muted); font-size: .8rem; }
  `,
})
export class FriendsPage implements OnInit {
  protected readonly service = inject(FriendsService);
  private readonly messages = inject(MessageService);

  protected readonly addable = signal<AddableUser[]>([]);
  protected readonly search = signal('');
  protected readonly busy = signal<string | null>(null);
  protected readonly first = signal(0);
  protected readonly rows = signal(10);
  protected readonly filteredAddable = computed(() => {
    const q = this.search().trim().toLocaleLowerCase('it');
    const list = this.addable();
    return q ? list.filter((u) => `${u.nome} ${u.cognome}`.toLocaleLowerCase('it').includes(q)) : list;
  });
  protected readonly pagedAddable = computed(() => {
    const list = this.filteredAddable();
    const start = this.first() < list.length ? this.first() : 0;
    return list.slice(start, start + this.rows());
  });
  protected onSearch(value: string): void { this.search.set(value); this.first.set(0); }
  protected onPage(event: PaginatorState): void { this.first.set(event.first ?? 0); this.rows.set(event.rows ?? 10); }

  ngOnInit(): void {
    void this.reload();
  }

  private async reload(): Promise<void> {
    try {
      await this.service.loadAll();
      this.addable.set(await this.service.listAddable());
    } catch { this.messages.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare gli amici.' }); }
  }

  protected initials(a: string, b: string): string { return `${a?.[0] ?? ''}${b?.[0] ?? ''}`.toUpperCase(); }

  protected async send(id: string): Promise<void> {
    this.busy.set(id);
    try { await this.service.send(id); await this.reload(); this.messages.add({ severity: 'success', summary: 'Fatto', detail: 'Richiesta aggiornata.' }); }
    catch (e) { this.messages.add({ severity: 'error', summary: 'Errore', detail: e instanceof Error ? e.message : 'Operazione non riuscita.' }); }
    this.busy.set(null);
  }

  protected async respond(requestId: number, userId: string, accept: boolean): Promise<void> {
    this.busy.set(userId);
    try { await this.service.respond(requestId, accept); await this.reload(); }
    catch { this.messages.add({ severity: 'error', summary: 'Errore', detail: 'Operazione non riuscita.' }); }
    this.busy.set(null);
  }

  protected async remove(id: string): Promise<void> {
    this.busy.set(id);
    try { await this.service.remove(id); await this.reload(); }
    catch { this.messages.add({ severity: 'error', summary: 'Errore', detail: 'Operazione non riuscita.' }); }
    this.busy.set(null);
  }
}
