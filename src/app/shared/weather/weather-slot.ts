import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { WeatherService } from '../../core/services/weather.service';
import { WeatherGlyph } from './weather-glyph';
import { playability, weatherDescription, WeatherPoint } from './weather.model';

interface SlotRequest {
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  startsAt: string;
  indoor: boolean;
}

/**
 * Previsione all'ora di inizio di una partita o di un torneo. Compare solo quando
 * c'e qualcosa di utile da dire: campo scoperto, evento futuro entro l'orizzonte
 * delle previsioni e luogo riconosciuto.
 */
@Component({
  selector: 'app-weather-slot',
  imports: [DecimalPipe, WeatherGlyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (point(); as forecast) {
      <section class="slot" [class]="'slot slot-' + verdict()?.level" aria-labelledby="weather-slot-title">
        <app-weather-glyph class="glyph" [code]="forecast.weatherCode" />
        <div class="lead">
          <p class="eyebrow" id="weather-slot-title">Meteo all'inizio</p>
          <p class="headline"><b class="num">{{ forecast.temperature | number: '1.0-0' }}°</b> {{ describe(forecast.weatherCode) }}</p>
          <p class="verdict">{{ verdict()?.label }} · {{ verdict()?.reason }}</p>
        </div>
        <dl class="facts">
          <div><dt>Umidità</dt><dd class="num">{{ forecast.humidity | number: '1.0-0' }}%</dd></div>
          <div><dt>Vento</dt><dd class="num">{{ forecast.windSpeed | number: '1.0-0' }} km/h</dd></div>
          <div><dt>Raffiche</dt><dd class="num">{{ forecast.windGusts | number: '1.0-0' }} km/h</dd></div>
          @if (forecast.precipitationProbability !== null) {
            <div><dt>Pioggia</dt><dd class="num">{{ forecast.precipitationProbability | number: '1.0-0' }}%</dd></div>
          }
          @if (forecast.uvIndex !== null) { <div><dt>UV</dt><dd class="num">{{ forecast.uvIndex | number: '1.0-0' }}</dd></div> }
        </dl>
        <p class="credit">Dati meteo di <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo.com</a></p>
      </section>
    }
  `,
  styles: `
    :host{display:block}
    .num{font-family:var(--font-numeric);font-variant-numeric:tabular-nums}
    .slot{display:grid;grid-template-columns:auto 1fr;gap:10px 14px;padding:15px;border:1px solid var(--color-border);border-left-width:4px;border-radius:var(--radius);background:var(--color-surface)}
    .slot-buone{border-left-color:#15803d}
    .slot-attenzione{border-left-color:var(--color-tournament)}
    .slot-difficili{border-left-color:var(--color-danger)}
    .glyph{width:44px;height:44px;color:var(--color-ink-muted)}
    .lead{display:grid;gap:2px}
    .eyebrow{margin:0;color:var(--color-ink-muted);font-size:.6rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}
    .headline{margin:0;font-size:.86rem;font-weight:800}
    .headline b{margin-right:4px;font-size:1.15rem}
    .verdict{margin:0;color:var(--color-ink-muted);font-size:.7rem;font-weight:700}
    .facts{display:flex;flex-wrap:wrap;gap:8px;grid-column:1/-1;margin:0}
    .facts div{display:grid;gap:1px;padding:7px 10px;border-radius:var(--radius-sm);background:var(--color-surface-muted)}
    .facts dt{color:var(--color-ink-muted);font-size:.58rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
    .facts dd{margin:0;font-size:.78rem;font-weight:800}
    .credit{grid-column:1/-1;margin:0;color:var(--color-ink-muted);font-size:.58rem}
    .credit a{color:inherit}
  `,
})
export class WeatherSlot {
  /** Citta della sede: usata solo quando non ci sono coordinate salvate. */
  readonly city = input<string | null>(null);
  readonly latitude = input<number | null>(null);
  readonly longitude = input<number | null>(null);
  readonly startsAt = input.required<string>();
  /** Al coperto il meteo non cambia la partita: il riquadro resta nascosto. */
  readonly indoor = input(false);

  private readonly weather = inject(WeatherService);
  protected readonly point = signal<WeatherPoint | null>(null);
  protected readonly verdict = computed(() => {
    const forecast = this.point();
    return forecast ? playability(forecast) : null;
  });

  constructor() {
    effect(() => {
      const request: SlotRequest = {
        city: this.city(), latitude: this.latitude(), longitude: this.longitude(),
        startsAt: this.startsAt(), indoor: this.indoor(),
      };
      untracked(() => void this.load(request));
    });
  }

  protected describe(code: number): string { return weatherDescription(code); }

  private async load(request: SlotRequest): Promise<void> {
    if (request.indoor || !request.startsAt) { this.point.set(null); return; }
    const saved = request.latitude !== null && request.longitude !== null
      ? { latitude: request.latitude, longitude: request.longitude }
      : null;
    const coordinates = await this.weather.coordinatesForCity(request.city, saved);
    if (!coordinates) { this.point.set(null); return; }
    this.point.set(await this.weather.forecastAt(coordinates, request.startsAt));
  }
}
