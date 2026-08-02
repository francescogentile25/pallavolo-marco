import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Tournament } from '../models/tournament.model';
import { FORMAT_LABELS, REGISTRATION_MODE_LABELS, TOURNAMENT_STATUS_LABELS } from '../tournaments.utils';

@Component({
  selector: 'app-tournament-card',
  imports: [ButtonModule, DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article>
      <div class="topline"><span>{{ statusLabel() }}</span><i class="pi pi-trophy" aria-hidden="true"></i></div>
      <div><p class="date"><i class="pi pi-calendar" aria-hidden="true"></i> {{ tournament().starts_at | date:'EEE d MMM, HH:mm':'':'it' }}</p><h2>{{ tournament().title }}</h2><p class="place">{{ tournament().venue.name }} · {{ tournament().venue.city }}</p></div>
      <div class="chips"><span>{{ formatLabel() }}</span><span>{{ registrationLabel() }}</span><span>Livello {{ tournament().min_level }}–{{ tournament().max_level }}</span></div>
      <footer><div><strong>{{ confirmedTeams() }}/{{ tournament().max_teams }}</strong><small> coppie confermate</small></div><a pButton [routerLink]="['/tornei', tournament().id]" severity="secondary" [outlined]="true" aria-label="Apri il torneo"><i class="pi pi-arrow-right" pButtonIcon></i></a></footer>
    </article>
  `,
  styles: `
    :host { display:block; } article { display:grid; min-height:270px; gap:18px; padding:20px; border:1px solid var(--color-border); border-radius:22px; background:white; box-shadow:0 10px 28px rgb(20 24 26 / .05); }
    .topline, footer { display:flex; align-items:center; justify-content:space-between; }.topline span { padding:6px 9px; color:var(--color-brand-strong); border-radius:10px; background:var(--color-brand-soft); font-size:.65rem; font-weight:900; text-transform:uppercase; }.topline i { color:var(--color-brand); font-size:1.2rem; }
    h2 { margin:5px 0 6px; font:900 1.5rem/1 var(--display-font); letter-spacing:-.04em; }.date,.place { margin:0; color:var(--color-ink-muted); font-size:.75rem; }.date { color:var(--color-brand-strong); font-weight:800; }.date i { margin-right:5px; }
    .chips { display:flex; flex-wrap:wrap; gap:6px; }.chips span { padding:6px 8px; border-radius:9px; background:var(--color-surface-muted); font-size:.65rem; font-weight:750; }
    footer { padding-top:14px; border-top:1px solid var(--color-border); }footer strong { font-size:1.1rem; }footer small { color:var(--color-ink-muted); }a { text-decoration:none; }
  `,
})
export class TournamentCard {
  tournament = input.required<Tournament>();
  protected readonly statusLabel = computed(() => TOURNAMENT_STATUS_LABELS[this.tournament().status]);
  protected readonly formatLabel = computed(() => FORMAT_LABELS[this.tournament().format]);
  protected readonly registrationLabel = computed(() => REGISTRATION_MODE_LABELS[this.tournament().registration_mode]);
  protected readonly confirmedTeams = computed(() => this.tournament().teams.filter(team => team.status === 'confirmed').length);
}
