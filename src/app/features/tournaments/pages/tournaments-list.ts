import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { Checkbox } from 'primeng/checkbox';
import { Select } from 'primeng/select';
import { PageActionsService } from '../../../core/services/page-actions.service';
import { NearbyPlaces } from '../../../shared/places/nearby.service';
import { tournamentPoint } from '../../../shared/places/place-points';
import { AuthStore } from '../../auth/store/auth.store';
import { TournamentCard } from '../components/tournament-card';
import { TournamentFormat } from '../models/tournament.model';
import { TournamentsService } from '../services/tournaments.service';
import { TournamentsStore } from '../store/tournaments.store';

@Component({
  selector: 'app-tournaments-list',
  imports: [Button, Checkbox, FormsModule, InputText, Paginator, RouterLink, Select, TournamentCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main data-tour-page="tournaments">
      <header><div><p class="eyebrow">La stagione è aperta</p><h1>Tornei</h1></div><p>Trova la formula giusta, entra con la tua coppia oppure iscriviti senza compagno.</p></header>
      <section class="filters" aria-label="Filtri tornei"><div class="search"><i class="pi pi-search" aria-hidden="true"></i><label class="sr-only" for="tournament-search">Cerca torneo o città</label><input id="tournament-search" pInputText type="search" placeholder="Cerca per nome, struttura o città" [ngModel]="query()" (ngModelChange)="query.set($event)" /></div><p-select [ngModel]="format()" (ngModelChange)="format.set($event)" [options]="formats" optionLabel="label" optionValue="value" ariaLabel="Formula torneo" /><p-select [ngModel]="visibility()" (ngModelChange)="visibility.set($event)" [options]="visibilityOptions" optionLabel="label" optionValue="value" ariaLabel="Visibilità torneo" />@if (query() || format() !== 'all' || visibility() !== 'all' || onlyNearby()) { <button type="button" class="reset" (click)="resetFilters()"><i class="pi pi-filter-slash" aria-hidden="true"></i> Azzera</button> }<div class="nearby"><p-checkbox inputId="only-nearby" [ngModel]="onlyNearby()" (ngModelChange)="onlyNearby.set($event)" [binary]="true" [disabled]="!nearby.hasHome()" /><label for="only-nearby">@if (nearby.hasHome()) { Entro {{ nearby.radiusKm }} km da {{ nearby.cityName() }} } @else { <a routerLink="/profilo">Scegli il tuo comune</a> per filtrare i tornei vicini }</label></div></section>
      <section aria-live="polite"><div class="heading"><h2>Prossimi appuntamenti</h2><span>{{ filtered().length }} {{ filtered().length === 1 ? 'torneo' : 'tornei' }}</span></div>
        @if (store.loading() && !store.tournaments().length) { <div class="state" role="status"><span class="spinner"></span> Carico i tornei…</div> }
        @else if (store.error() && !store.tournaments().length) { <div class="state" role="alert"><i class="pi pi-exclamation-circle"></i><p>{{ store.error() }}</p><p-button label="Riprova" icon="pi pi-refresh" (onClick)="store.loadList()"/></div> }
        @else { <div class="grid">@for (tournament of paged(); track tournament.id) { <app-tournament-card [tournament]="tournament"/> } @empty { <div class="state empty"><i class="pi pi-trophy" aria-hidden="true"></i><h2>Nessun torneo trovato</h2><p>Prova ad allargare i filtri: potresti trovarne altri.</p><p-button label="Azzera filtri" icon="pi pi-filter-slash" severity="secondary" [outlined]="true" (onClick)="resetFilters()"/></div> }</div>@if (filtered().length > pageSize()) { <p-paginator styleClass="list-pager" [first]="first()" [rows]="pageSize()" [totalRecords]="filtered().length" (onPageChange)="onPage($event)" /> } }
      </section>
    </main>
  `,
  styles: `
    :host{display:block}main{width:min(100%,1120px);padding:18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 56px);margin:auto}header{position:relative;display:grid;gap:14px;overflow:hidden;padding:26px 22px;color:white;border-radius:8px;background:linear-gradient(135deg,var(--color-ocean),#263f39)}header::after{position:absolute;right:-30px;bottom:-70px;width:180px;height:180px;border:20px solid rgb(255 255 255/.06);border-radius:50%;content:''}.eyebrow{margin:0 0 5px;color:#ffc72c;font-size:.68rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}/* Con la crenatura stretta del titolo la r finiva addosso alla n: qui resta
   compatto ma le due lettere si distinguono. */h1{margin:0;font:900 clamp(2.4rem,12vw,4.8rem)/.9 var(--display-font);letter-spacing:-.032em}header>p{max-width:32rem;margin:0;color:rgb(255 255 255/.72);font-size:.82rem;line-height:1.5}.filters{display:grid;gap:8px;margin:16px 0 20px}.nearby{display:flex;align-items:center;gap:9px;color:var(--color-ink-muted);font-size:.74rem}.nearby label{font-weight:750}.nearby a{color:var(--color-brand-strong);font-weight:800}.filters .reset{display:inline-flex;min-height:44px;align-items:center;justify-content:center;gap:7px;padding:0 14px;color:var(--color-brand-strong);border:1px solid var(--color-border);border-radius:var(--radius-pill);background:white;font:inherit;font-size:.76rem;font-weight:800;cursor:pointer}.search{position:relative}.search i{position:absolute;top:50%;left:14px;transform:translateY(-50%);color:var(--color-ink-muted)}.search input{width:100%;min-height:46px;padding-left:42px}.heading{display:flex;align-items:end;justify-content:space-between;margin-bottom:12px}.heading h2{margin:0;font:900 1.45rem/1 var(--display-font)}.heading span{color:var(--color-ink-muted);font-size:.72rem}.grid{display:grid;gap:13px}.state{display:grid;min-height:260px;place-content:center;justify-items:center;gap:10px;padding:24px;color:var(--color-ink-muted);text-align:center;border:1px dashed var(--color-border);border-radius:var(--radius-lg)}.grid .state{grid-column:1/-1}.list-pager{display:block;margin-top:18px;background:transparent}.state h2,.state p{margin:0}.state>i{color:var(--color-brand);font-size:1.8rem}.spinner{width:22px;height:22px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .7s linear infinite}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@keyframes spin{to{transform:rotate(360deg)}}
    @media(min-width:700px){main{padding:34px 28px 120px}header{grid-template-columns:1fr 1fr;align-items:end;padding:38px}.filters{grid-template-columns:minmax(0,1fr) 190px 160px auto;align-items:center}.nearby{grid-column:1/-1}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(min-width:1050px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
  `,
})
export class TournamentsList implements OnInit, OnDestroy {
  protected readonly store = inject(TournamentsStore); protected readonly auth = inject(AuthStore); private readonly actions = inject(PageActionsService); private readonly service = inject(TournamentsService);
  protected readonly query = signal(''); protected readonly format = signal<TournamentFormat | 'all'>('all');
  protected readonly visibility = signal<'all' | 'public' | 'private'>('all');
  protected readonly nearby = inject(NearbyPlaces);
  protected readonly onlyNearby = signal(false);
  protected readonly visibilityOptions = [{ label: 'Tutti', value: 'all' }, { label: 'Pubblici', value: 'public' }, { label: 'Privati', value: 'private' }];
  protected readonly formats = [{ label: 'Tutte le formule', value: 'all' }, { label: 'Gironi', value: 'groups' }, { label: 'Eliminazione', value: 'knockout' }, { label: 'Formula mista', value: 'mixed' }];
  protected readonly filtered = computed(() => { const query = this.query().trim().toLocaleLowerCase('it'); return this.store.tournaments().filter(item => (this.format() === 'all' || item.format === this.format()) && (this.visibility() === 'all' || item.visibility === this.visibility()) && (!this.onlyNearby() || this.nearby.isNearby(tournamentPoint(item))) && (!query || `${item.title} ${item.venue.name} ${item.venue.city}`.toLocaleLowerCase('it').includes(query))); });
  protected readonly pageSize = signal(9);
  protected readonly first = signal(0);
  /** La pagina mostrata; cambiando filtri si torna alla prima. */
  protected readonly paged = computed(() => this.filtered().slice(this.first(), this.first() + this.pageSize()));
  protected onPage(event: PaginatorState): void { this.first.set(event.first ?? 0); }
  protected resetFilters(): void { this.query.set(''); this.format.set('all'); this.visibility.set('all'); this.onlyNearby.set(false); }
  private channel?: RealtimeChannel; private timer?: ReturnType<typeof setTimeout>;
  constructor() {
    effect(() => { this.query(); this.format(); this.visibility(); this.onlyNearby(); this.first.set(0); });
    // I tornei senza coordinate hanno solo il nome del comune: va risolto per il raggio.
    effect(() => {
      const points = this.store.tournaments().map(tournamentPoint);
      untracked(() => this.nearby.resolveMissing(points));
    });
  }

  ngOnInit(): void { this.actions.set([...(this.auth.canOrganizeTournaments() ? [{ id:'organize-tournament',label:'Organizza torneo',shortLabel:'Organizza',icon:'pi-plus',primary:true,routerLink:'/tornei/organizza' }] : [])]); void this.store.loadList(); this.channel = this.service.subscribe(null, () => { if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => void this.store.loadList(true), 200); }); }
  ngOnDestroy(): void { this.actions.clear(); if (this.channel) this.service.removeChannel(this.channel); if (this.timer) clearTimeout(this.timer); }
}
