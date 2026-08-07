import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { WeatherGlyph } from './weather-glyph';
import { WeatherPoint } from './weather.model';

/**
 * Le prossime ore, in colonna sotto al meteo. Riempie lo spazio che avanza
 * accanto al calendario: piu il calendario e alto, piu ore si vedono. Serve a
 * scegliere quando scendere in campo, non a fare da tappabuchi decorativo.
 */
@Component({
  selector: 'app-weather-hours',
  imports: [DatePipe, DecimalPipe, WeatherGlyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hours" aria-labelledby="weather-hours-title">
      <p class="head" id="weather-hours-title">Prossime ore</p>
      @if (rows().length) {
        <ul>
          @for (hour of rows(); track hour.time) {
            <li>
              <span class="time num">{{ hour.time | date: 'HH:mm' }}</span>
              <app-weather-glyph class="glyph" [code]="hour.weatherCode" [night]="isNight(hour)" />
              <span class="temp num">{{ hour.temperature | number: '1.0-0' }}°</span>
              <span class="detail num">
                @if ((hour.precipitationProbability ?? 0) >= 20) {
                  <i class="pi pi-cloud" aria-hidden="true"></i>{{ hour.precipitationProbability | number: '1.0-0' }}%
                } @else {
                  <i class="pi pi-send" aria-hidden="true"></i>{{ hour.windSpeed | number: '1.0-0' }} km/h
                }
              </span>
            </li>
          }
        </ul>
      } @else {
        <p class="empty">Previsione oraria non disponibile.</p>
      }
    </section>
  `,
  styles: `
    :host{display:block;height:100%}
    .num{font-family:var(--font-numeric);font-variant-numeric:tabular-nums}
    .hours{display:flex;height:100%;flex-direction:column;overflow:hidden;padding:16px 18px;border:1px solid var(--color-border);border-radius:var(--radius-lg);background:rgb(255 255 255/.94);box-shadow:0 18px 50px rgb(7 54 79/.08)}
    .head{margin:0 0 8px;color:var(--color-ink-muted);font-size:.6rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
    ul{display:flex;min-height:0;flex:1;flex-direction:column;padding:0;margin:0;overflow:hidden;list-style:none}
    li{display:grid;grid-template-columns:44px 26px 1fr auto;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--color-border)}
    li:first-child{border-top:0}
    .time{color:var(--color-ink-muted);font-size:.7rem;font-weight:800}
    .glyph{width:26px;height:26px;color:var(--color-ink-muted)}
    .temp{font-size:.9rem;font-weight:850}
    .detail{display:inline-flex;align-items:center;gap:5px;color:var(--color-ink-muted);font-size:.68rem;font-weight:750}
    .empty{margin:0;color:var(--color-ink-muted);font-size:.74rem}
  `,
})
export class WeatherHours {
  readonly hours = input<readonly WeatherPoint[]>([]);
  readonly sunrise = input<string | null>(null);
  readonly sunset = input<string | null>(null);

  protected readonly rows = computed(() => this.hours().slice(0, 12));

  /** L'ora mostrata decide l'icona: alle 22 serve la luna anche se ora e giorno. */
  protected isNight(point: WeatherPoint): boolean {
    const time = Date.parse(point.time);
    const start = this.sunrise() ? Date.parse(this.sunrise()!) : NaN;
    const end = this.sunset() ? Date.parse(this.sunset()!) : NaN;
    if (Number.isFinite(start) && Number.isFinite(end)) return time < start || time > end;
    const hour = new Date(time).getHours();
    return hour < 6 || hour >= 21;
  }
}
