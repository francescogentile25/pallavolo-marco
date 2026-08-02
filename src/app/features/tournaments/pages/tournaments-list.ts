import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { PageActionsService } from '../../../core/services/page-actions.service';
import { AuthStore } from '../../auth/store/auth.store';
import { TournamentCard } from '../components/tournament-card';
import { TournamentFormat } from '../models/tournament.model';
import { TournamentsService } from '../services/tournaments.service';
import { TournamentsStore } from '../store/tournaments.store';

@Component({
  selector: 'app-tournaments-list',
  imports: [Button, FormsModule, InputText, RouterLink, Select, TournamentCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <header><div><p class="eyebrow">La stagione è aperta</p><h1>Tornei</h1></div><p>Trova la formula giusta, entra con la tua coppia oppure iscriviti come giocatore libero.</p>@if (auth.canOrganizeTournaments()) { <a pButton routerLink="/tornei/organizza"><i class="pi pi-plus" pButtonIcon></i><span pButtonLabel>Organizza</span></a> }</header>
      <section class="filters" aria-label="Filtri tornei"><div class="search"><i class="pi pi-search" aria-hidden="true"></i><label class="sr-only" for="tournament-search">Cerca torneo o città</label><input id="tournament-search" pInputText type="search" placeholder="Nome, struttura o città" [ngModel]="query()" (ngModelChange)="query.set($event)" /></div><p-select [ngModel]="format()" (ngModelChange)="format.set($event)" [options]="formats" optionLabel="label" optionValue="value" ariaLabel="Formula torneo" fluid /></section>
      <section aria-live="polite"><div class="heading"><h2>Prossimi appuntamenti</h2><span>{{ filtered().length }} tornei</span></div>
        @if (store.loading() && !store.tournaments().length) { <div class="state" role="status"><span class="spinner"></span> Carico i tornei…</div> }
        @else if (store.error() && !store.tournaments().length) { <div class="state" role="alert"><i class="pi pi-exclamation-circle"></i><p>{{ store.error() }}</p><p-button label="Riprova" icon="pi pi-refresh" (onClick)="store.loadList()"/></div> }
        @else { <div class="grid">@for (tournament of filtered(); track tournament.id) { <app-tournament-card [tournament]="tournament"/> } @empty { <div class="state empty"><i class="pi pi-trophy"></i><h2>Nessun torneo trovato</h2><p>Modifica i filtri o torna presto.</p></div> }</div> }
      </section>
    </main>
  `,
  styles: `
    :host{display:block}main{width:min(100%,1120px);padding:18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 48px);margin:auto}header{position:relative;display:grid;gap:14px;overflow:hidden;padding:26px 22px;color:white;border-radius:26px;background:linear-gradient(135deg,var(--color-ocean),#263f39)}header::after{position:absolute;right:-30px;bottom:-70px;width:180px;height:180px;border:20px solid rgb(255 255 255/.06);border-radius:50%;content:''}.eyebrow{margin:0 0 5px;color:#f2b08e;font-size:.68rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}h1{margin:0;font:900 clamp(2.4rem,12vw,4.8rem)/.9 var(--display-font);letter-spacing:-.06em}header>p{max-width:32rem;margin:0;color:rgb(255 255 255/.72);font-size:.82rem;line-height:1.5}header a{z-index:1;width:max-content;text-decoration:none}.filters{display:grid;gap:10px;padding:14px;margin:16px 0 26px;border:1px solid var(--color-border);border-radius:20px;background:white}.search{position:relative}.search i{position:absolute;top:50%;left:14px;transform:translateY(-50%);color:var(--color-ink-muted)}.search input{width:100%;min-height:46px;padding-left:42px}.heading{display:flex;align-items:end;justify-content:space-between;margin-bottom:12px}.heading h2{margin:0;font:900 1.45rem/1 var(--display-font)}.heading span{color:var(--color-ink-muted);font-size:.72rem}.grid{display:grid;gap:13px}.state{display:grid;min-height:260px;place-content:center;justify-items:center;gap:10px;padding:24px;color:var(--color-ink-muted);text-align:center;border:1px dashed var(--color-border);border-radius:22px}.state h2,.state p{margin:0}.state>i{color:var(--color-brand);font-size:1.8rem}.spinner{width:22px;height:22px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .7s linear infinite}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@keyframes spin{to{transform:rotate(360deg)}}
    @media(min-width:700px){main{padding:34px 28px 120px}header{grid-template-columns:1fr 1fr auto;align-items:end;padding:38px}.filters{grid-template-columns:1fr 240px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(min-width:1050px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
  `,
})
export class TournamentsList implements OnInit, OnDestroy {
  protected readonly store = inject(TournamentsStore); protected readonly auth = inject(AuthStore); private readonly actions = inject(PageActionsService); private readonly service = inject(TournamentsService);
  protected readonly query = signal(''); protected readonly format = signal<TournamentFormat | 'all'>('all');
  protected readonly formats = [{ label: 'Tutte le formule', value: 'all' }, { label: 'Gironi', value: 'groups' }, { label: 'Eliminazione', value: 'knockout' }, { label: 'Formula mista', value: 'mixed' }];
  protected readonly filtered = computed(() => { const query = this.query().trim().toLocaleLowerCase('it'); return this.store.tournaments().filter(item => (this.format() === 'all' || item.format === this.format()) && (!query || `${item.title} ${item.venue.name} ${item.venue.city}`.toLocaleLowerCase('it').includes(query))); });
  private channel?: RealtimeChannel; private timer?: ReturnType<typeof setTimeout>;
  ngOnInit(): void { this.actions.set([...(this.auth.canOrganizeTournaments() ? [{ id:'organize-tournament',label:'Organizza torneo',shortLabel:'Organizza',icon:'pi-plus',primary:true,routerLink:'/tornei/organizza' }] : [])]); void this.store.loadList(); this.channel = this.service.subscribe(null, () => { if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => void this.store.loadList(true), 200); }); }
  ngOnDestroy(): void { this.actions.clear(); if (this.channel) this.service.removeChannel(this.channel); if (this.timer) clearTimeout(this.timer); }
}
