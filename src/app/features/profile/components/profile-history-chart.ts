import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ProfileMetricPoint } from '../models/profile.model';

@Component({
  selector: 'app-profile-history-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'profile-history-chart' },
  template: `
    <section class="chart-card" [attr.aria-labelledby]="chartTitleId()">
      <div class="chart-heading">
        <div><p>{{ eyebrow() }}</p><h2 [id]="chartTitleId()">{{ title() }}</h2></div>
        <strong>{{ latestValue() }}</strong>
      </div>
      @if (points().length > 1) {
        <svg viewBox="0 0 320 120" role="img" [attr.aria-label]="accessibleSummary()">
          <line x1="12" y1="16" x2="12" y2="104" />
          <line x1="12" y1="104" x2="308" y2="104" />
          <polyline [attr.points]="polylinePoints()" />
          @for (point of chartPoints(); track point.id) {
            <circle [attr.cx]="point.x" [attr.cy]="point.y" r="4">
              <title>{{ point.value }} · {{ formatDate(point.createdAt) }}</title>
            </circle>
          }
        </svg>
      } @else {
        <div class="empty-chart">
          <i class="pi pi-chart-line" aria-hidden="true"></i>
          <p>Lo storico crescerà con i prossimi aggiornamenti.</p>
        </div>
      }
      <p class="chart-range">Scala da 1 a 7 · ultimo aggiornamento {{ latestDate() }}</p>
    </section>
  `,
  styles: `
    :host { display: block; }
    .chart-card { height: 100%; padding: 20px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); box-shadow: 0 10px 28px rgb(7 29 38 / .06); }
    .chart-heading { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
    .chart-heading p { margin: 0 0 5px; color: var(--color-brand-strong); font-size: .68rem; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
    h2 { margin: 0; font: 850 1.12rem/1.2 var(--base-font-family); }
    strong { display: grid; width: 48px; height: 48px; place-items: center; color: white; border-radius: var(--radius-lg); background: var(--color-brand-strong); font-size: 1.2rem; }
    svg { width: 100%; height: 130px; margin-top: 14px; overflow: visible; }
    line { stroke: var(--color-border); stroke-width: 1; }
    polyline { fill: none; stroke: var(--color-tournament); stroke-linecap: round; stroke-linejoin: round; stroke-width: 4; }
    circle { fill: white; stroke: var(--color-tournament); stroke-width: 3; }
    .empty-chart { display: grid; min-height: 126px; place-content: center; justify-items: center; color: var(--color-ink-muted); text-align: center; }
    .empty-chart i { margin-bottom: 8px; color: var(--color-brand); font-size: 1.5rem; }
    .empty-chart p { max-width: 25ch; margin: 0; font-size: .82rem; }
    .chart-range { margin: 4px 0 0; color: var(--color-ink-muted); font-size: .72rem; }
  `,
})
export class ProfileHistoryChart {
  readonly title = input.required<string>();
  readonly eyebrow = input.required<string>();
  readonly points = input.required<readonly ProfileMetricPoint[]>();
  protected readonly chartTitleId = computed(() => `chart-${this.title().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
  protected readonly latestValue = computed(() => this.points().at(-1)?.value.toFixed(1) ?? '—');
  protected readonly latestDate = computed(() => {
    const date = this.points().at(-1)?.createdAt;
    return date ? this.formatDate(date) : 'non disponibile';
  });
  protected readonly chartPoints = computed(() => {
    const values = this.points();
    return values.map((point, index) => ({
      ...point,
      x: 12 + (values.length === 1 ? 0 : (index / (values.length - 1)) * 296),
      y: 104 - ((point.value - 1) / 6) * 88,
    }));
  });
  protected readonly polylinePoints = computed(() => this.chartPoints().map((point) => `${point.x},${point.y}`).join(' '));
  protected readonly accessibleSummary = computed(() => `${this.title()}: ${this.points().map((point) => `${point.value} il ${this.formatDate(point.createdAt)}`).join(', ')}`);

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  }
}
