import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { PageActionsService } from '../../../core/services/page-actions.service';
import { AuthStore } from '../../auth/store/auth.store';
import { MatchActionSheet } from '../components/match-action-sheet';
import { MatchCard } from '../components/match-card';
import { BeachMatch, MatchFilters, MatchGender } from '../models/match.model';
import { filterMatches } from '../matches.utils';
import { MatchesService } from '../services/matches.service';
import { MatchesStore } from '../store/matches.store';

@Component({
  selector: 'app-matches-list',
  imports: [FormsModule, Button, Checkbox, InputText, Select, MatchCard, MatchActionSheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="matches-page">
      <header class="page-hero">
        <div><p class="eyebrow">Scendi in campo</p><h1>Trova una partita</h1></div>
        <p>Filtra per luogo, livello e disponibilità. I posti si aggiornano in tempo reale.</p>
      </header>

      <section class="filters" aria-label="Filtri partite">
        <div class="search-field">
          <i class="pi pi-search" aria-hidden="true"></i>
          <label class="sr-only" for="match-search">Cerca luogo o città</label>
          <input id="match-search" pInputText type="search" placeholder="Luogo, campo o città" [ngModel]="query()" (ngModelChange)="query.set($event)" />
        </div>
        <div class="filter-row">
          <div class="filter-field">
            <label for="match-gender">Genere</label>
            <p-select inputId="match-gender" [ngModel]="gender()" (ngModelChange)="gender.set($event)" [options]="genderOptions" optionLabel="label" optionValue="value" fluid />
          </div>
          <div class="filter-field">
            <label for="match-level">Livello</label>
            <p-select inputId="match-level" [ngModel]="level()" (ngModelChange)="level.set($event)" [options]="levelOptions" optionLabel="label" optionValue="value" fluid />
          </div>
          <div class="filter-field">
            <label for="match-date">Quando</label>
            <p-select inputId="match-date" [ngModel]="dateFilter()" (ngModelChange)="dateFilter.set($event)" [options]="dateOptions" optionLabel="label" optionValue="value" fluid />
          </div>
        </div>
        <div class="availability-toggle">
          <p-checkbox inputId="only-available" [ngModel]="onlyAvailable()" (ngModelChange)="onlyAvailable.set($event)" [binary]="true" />
          <label for="only-available">Solo con posti liberi</label>
        </div>
      </section>

      <section aria-live="polite">
        <div class="results-heading"><h2>Partite disponibili</h2><span>{{ filteredMatches().length }} risultati</span></div>
        @if (store.loading() && !store.matches().length) {
          <div class="state" role="status"><span class="spinner"></span> Cerco le prossime partite…</div>
        } @else if (store.error() && !store.matches().length) {
          <div class="state error" role="alert"><i class="pi pi-exclamation-circle"></i><strong>Partite non disponibili</strong><p-button label="Riprova" icon="pi pi-refresh" (onClick)="store.loadMatches()" /></div>
        } @else {
          <div class="match-grid">
            @for (match of filteredMatches(); track match.id) {
              <app-match-card [match]="match" (actions)="openActions($event)" />
            } @empty {
              <div class="empty"><i class="pi pi-filter-slash" aria-hidden="true"></i><h2>Nessuna partita trovata</h2><p>Modifica i filtri oppure crea tu la prossima.</p><p-button label="Azzera filtri" icon="pi pi-filter-slash" severity="secondary" [outlined]="true" (onClick)="resetFilters()" /></div>
            }
          </div>
        }
      </section>
    </main>

    <app-match-action-sheet [visible]="sheetOpen()" (visibleChange)="sheetOpen.set($event)" [match]="selectedMatch()" [userId]="authStore.authUser()?.id ?? null" [busy]="store.actionMatchId() !== null" (join)="join($event)" (withdraw)="withdraw($event)" (cancel)="cancel($event)" />
  `,
  styles: `
    :host { display: block; }
    .matches-page { width: min(100%, 1120px); padding: 18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 48px); margin: 0 auto; }
    .page-hero { display: grid; gap: 12px; padding: 24px 20px; color: white; border-radius: 27px; background: radial-gradient(circle at 90% 0, rgb(25 199 181 / .55), transparent 42%), linear-gradient(145deg, #071d26, #123945); }
    .eyebrow { margin: 0 0 5px; color: #84efe3; font-size: .68rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    h1 { margin: 0; font: 900 clamp(2rem, 10vw, 4rem)/.95 var(--display-font); letter-spacing: -.05em; }
    .page-hero > p { max-width: 34rem; margin: 0; color: rgb(255 255 255 / .72); font-size: .82rem; line-height: 1.5; }
    .filters { display: grid; gap: 12px; padding: 16px; margin: 14px 0 24px; border: 1px solid var(--color-border); border-radius: 22px; background: var(--color-surface); }
    .search-field { position: relative; }
    .search-field i { position: absolute; top: 50%; left: 14px; color: var(--color-ink-muted); transform: translateY(-50%); }
    .search-field input { width: 100%; min-height: 48px; padding-left: 42px; }
    .filter-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .filter-field { display: grid; gap: 5px; min-width: 0; }
    .filter-field label { color: var(--color-ink-muted); font-size: .65rem; font-weight: 800; }
    .availability-toggle { display: flex; min-height: 44px; align-items: center; gap: 10px; font-size: .76rem; font-weight: 800; }
    .availability-toggle label { cursor: pointer; }
    .results-heading { display: flex; align-items: end; justify-content: space-between; margin-bottom: 12px; }
    .results-heading h2 { margin: 0; font: 900 1.45rem/1 var(--display-font); }
    .results-heading span { color: var(--color-ink-muted); font-size: .72rem; }
    .match-grid { display: grid; gap: 12px; }
    .state, .empty { display: grid; min-height: 280px; place-content: center; justify-items: center; gap: 10px; padding: 30px; color: var(--color-ink-muted); text-align: center; border: 1px dashed var(--color-border); border-radius: 24px; }
    .empty i { color: var(--color-brand); font-size: 2rem; }.empty h2, .empty p { margin: 0; }
    .spinner { width: 20px; height: 20px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
    input:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 2px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (min-width: 700px) { .matches-page { padding: 34px 28px 120px; }.page-hero { grid-template-columns: 1fr 1fr; align-items: end; padding: 34px; }.filters { grid-template-columns: minmax(260px, 1.4fr) 2fr auto; align-items: end; }.match-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (min-width: 1040px) { .match-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  `,
})
export class MatchesList implements OnInit, OnDestroy {
  protected readonly store = inject(MatchesStore);
  protected readonly authStore = inject(AuthStore);
  private readonly actions = inject(PageActionsService);
  private readonly service = inject(MatchesService);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  protected readonly query = signal('');
  protected readonly gender = signal<MatchGender | 'all'>('all');
  protected readonly level = signal<number | null>(null);
  protected readonly onlyAvailable = signal(true);
  protected readonly dateFilter = signal<MatchFilters['date']>('all');
  protected readonly levels = [1, 2, 3, 4, 5, 6, 7];
  protected readonly genderOptions: { label: string; value: MatchGender | 'all' }[] = [
    { label: 'Tutti', value: 'all' },
    { label: 'Misto', value: 'mixed' },
    { label: 'Maschile', value: 'male' },
    { label: 'Femminile', value: 'female' },
  ];
  protected readonly levelOptions: { label: string; value: number | null }[] = [
    { label: 'Tutti', value: null },
    ...this.levels.map((value) => ({ label: String(value), value })),
  ];
  protected readonly dateOptions: { label: string; value: MatchFilters['date'] }[] = [
    { label: 'Prossime', value: 'all' },
    { label: 'Oggi', value: 'today' },
    { label: 'Entro domenica', value: 'weekend' },
  ];
  protected readonly selectedMatch = signal<BeachMatch | null>(null);
  protected readonly sheetOpen = signal(false);
  protected readonly filteredMatches = computed(() => filterMatches(this.store.matches(), {
    query: this.query(), gender: this.gender(), level: this.level(), onlyAvailable: this.onlyAvailable(), date: this.dateFilter(),
  }));
  private channel?: RealtimeChannel;
  private refreshTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.actions.set([
      { id: 'my-matches', label: 'Le mie partite', shortLabel: 'Le mie', icon: 'pi-calendar', routerLink: '/partite/mie' },
      { id: 'create-match', label: 'Crea partita', shortLabel: 'Crea', icon: 'pi-plus', primary: true, routerLink: '/partite/nuova' },
    ]);
    void this.store.loadMatches();
    this.channel = this.service.subscribeToMatchChanges(() => this.scheduleRefresh());
  }
  ngOnDestroy(): void { this.actions.clear(); if (this.channel) this.service.removeChannel(this.channel); if (this.refreshTimer) clearTimeout(this.refreshTimer); }
  protected openActions(match: BeachMatch): void { this.selectedMatch.set(match); this.sheetOpen.set(true); }
  protected resetFilters(): void { this.query.set(''); this.gender.set('all'); this.level.set(null); this.onlyAvailable.set(false); this.dateFilter.set('all'); }
  protected async join(id: string): Promise<void> { if (await this.store.join(id)) { this.sheetOpen.set(false); await this.store.loadMatches(true); } }
  protected async withdraw(id: string): Promise<void> { if (await this.store.withdraw(id)) { this.sheetOpen.set(false); await this.store.loadMatches(true); } }
  protected cancel(id: string): void { this.confirmationService.confirm({ header: 'Annulla partita?', message: 'La partita verrà annullata per tutti i partecipanti. Questa azione non può essere annullata.', icon: 'pi pi-exclamation-triangle', acceptLabel: 'Annulla partita', rejectLabel: 'Mantieni partita', acceptButtonProps: { severity: 'danger' }, rejectButtonProps: { severity: 'secondary', variant: 'text' }, accept: () => void this.cancelConfirmed(id) }); }
  private async cancelConfirmed(id: string): Promise<void> { if (await this.store.cancel(id)) { this.sheetOpen.set(false); await this.store.loadMatches(true); } }
  private scheduleRefresh(): void { if (this.refreshTimer) clearTimeout(this.refreshTimer); this.refreshTimer = setTimeout(() => void this.store.loadMatches(true), 250); }
}
