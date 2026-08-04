import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { FriendProfileDetails } from '../models/friend.model';

@Component({
  selector: 'app-player-achievement-chart',
  imports: [ChartModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="chart-card" aria-labelledby="achievement-chart-title">
      <div class="chart-heading">
        <div><p>Rendimento</p><h2 id="achievement-chart-title">Bacheca stagionale</h2></div>
        <i class="pi pi-chart-bar" aria-hidden="true"></i>
      </div>
      <div class="chart-wrap"><p-chart type="bar" [data]="data()" [options]="options" height="230px" /></div>
      <p class="chart-note">Numeri aggiornati dalle partite e dai tornei conclusi.</p>
      <p class="sr-only">{{ accessibleSummary() }}</p>
    </section>
  `,
  styles: `
    :host { display: block; }
    .chart-card { padding: 20px; border: 1px solid var(--color-border); border-radius: 22px; background: linear-gradient(155deg, var(--color-surface), var(--color-brand-soft)); box-shadow: 0 12px 30px rgb(7 29 38 / .06); }
    .chart-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .chart-heading p { margin: 0 0 4px; color: var(--color-brand-strong); font-size: .66rem; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
    h2 { margin: 0; font: 900 1.22rem/1 var(--display-font); }
    .chart-heading > i { display: grid; width: 42px; height: 42px; place-items: center; color: white; border-radius: 14px; background: var(--color-brand-strong); }
    .chart-wrap { position: relative; min-height: 230px; margin-top: 12px; }
    .chart-note { margin: 8px 0 0; color: var(--color-ink-muted); font-size: .68rem; line-height: 1.45; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
  `,
})
export class PlayerAchievementChart {
  readonly profile = input.required<FriendProfileDetails>();
  protected readonly data = computed(() => {
    const player = this.profile();
    return {
      labels: ['Partite', 'Tornei', 'Titoli', 'Incontri vinti'],
      datasets: [{
        label: 'Risultati',
        data: [player.matches_played, player.tournaments_played, player.tournaments_won, player.tournament_games_won],
        backgroundColor: ['#159e91', '#f28a52', '#123945', '#46b86c'],
        borderRadius: 7,
        maxBarThickness: 34,
      }],
    };
  });
  protected readonly options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(18, 57, 69, .08)' } },
      x: { grid: { display: false } },
    },
  };
  protected readonly accessibleSummary = computed(() => {
    const player = this.profile();
    return `${player.matches_played} partite, ${player.tournaments_played} tornei, ${player.tournaments_won} titoli e ${player.tournament_games_won} incontri di torneo vinti`;
  });
}
