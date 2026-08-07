import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WeatherService } from '../../core/services/weather.service';
import { WeatherGlyph } from './weather-glyph';
import { playability, weatherDescription, WeatherSnapshot } from './weather.model';

/**
 * Meteo della citta scelta nel profilo. Se la citta manca il pannello non finge:
 * dice che manca e porta al profilo. Se il servizio non risponde il blocco resta
 * discreto, perche il meteo non deve mai bloccare la home.
 */
@Component({
  selector: 'app-weather-panel',
  imports: [DatePipe, DecimalPipe, RouterLink, WeatherGlyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="weather" aria-labelledby="weather-title">
      <header class="head">
        <h2 id="weather-title">Meteo</h2>
        @if (place()) { <span class="place"><i class="pi pi-map-marker" aria-hidden="true"></i>{{ place() }}</span> }
      </header>

      @if (!hasPlace()) {
        <a class="empty" routerLink="/profilo">
          <strong>Imposta la tua città</strong>
          <span>Serve per sapere che tempo fa dove giochi.</span>
          <i class="pi pi-arrow-right" aria-hidden="true"></i>
        </a>
      } @else if (loading()) {
        <p class="state" role="status">Lettura del cielo…</p>
      } @else if (snapshot(); as data) {
        <div class="now">
          <app-weather-glyph class="glyph" [code]="data.current.weatherCode" />
          <p class="temp num">{{ data.current.temperature | number: '1.0-0' }}<span>°</span></p>
          <p class="sky">{{ describe(data.current.weatherCode) }}</p>
        </div>

        <p class="verdict" [class]="'verdict verdict-' + verdict()?.level">
          <strong>{{ verdict()?.label }}</strong>
          <span>{{ verdict()?.reason }}</span>
        </p>

        <dl class="metrics">
          <div><dt>Percepita</dt><dd class="num">{{ (data.current.apparentTemperature ?? data.current.temperature) | number: '1.0-0' }}°</dd></div>
          <div><dt>Umidità</dt><dd class="num">{{ data.current.humidity | number: '1.0-0' }}%</dd></div>
          <div><dt>Vento</dt><dd class="num">{{ data.current.windSpeed | number: '1.0-0' }}<small>km/h</small></dd></div>
          <div><dt>Raffiche</dt><dd class="num">{{ data.current.windGusts | number: '1.0-0' }}<small>km/h</small></dd></div>
          @if (data.current.uvIndex !== null) { <div><dt>UV</dt><dd class="num">{{ data.current.uvIndex | number: '1.0-0' }}</dd></div> }
        </dl>

        @if (data.hours.length) {
          <ul class="hours">
            @for (hour of data.hours; track hour.time) {
              <li>
                <span class="num">{{ hour.time | date: 'HH:mm' }}</span>
                <app-weather-glyph class="mini" [code]="hour.weatherCode" />
                <b class="num">{{ hour.temperature | number: '1.0-0' }}°</b>
              </li>
            }
          </ul>
        }

        <p class="credit">Dati meteo di <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo.com</a></p>
      } @else {
        <p class="state">Meteo non disponibile in questo momento.</p>
      }
    </section>
  `,
  styles: `
    :host{display:block}
    .weather{display:grid;gap:14px;height:100%;padding:18px;border:1px solid var(--color-border);border-radius:var(--radius-lg);background:var(--color-surface)}
    .num{font-family:var(--font-numeric);font-variant-numeric:tabular-nums}
    .head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px}
    h2{margin:0;font-family:var(--display-font);font-size:1rem;font-weight:850}
    .place{display:inline-flex;align-items:center;gap:5px;color:var(--color-ink-muted);font-size:.7rem;font-weight:750}

    .empty{display:grid;grid-template-columns:1fr auto;align-items:center;gap:2px 12px;min-height:44px;padding:14px;color:inherit;border:1px dashed var(--color-border);border-radius:var(--radius);text-decoration:none}
    .empty strong{font-size:.86rem}
    .empty span{color:var(--color-ink-muted);font-size:.7rem}
    .empty i{grid-row:1/3}
    .state{margin:0;color:var(--color-ink-muted);font-size:.72rem}

    .now{display:grid;grid-template-columns:auto auto 1fr;align-items:center;gap:4px 12px}
    .glyph{width:52px;height:52px;grid-row:1/3;color:var(--color-ink-muted)}
    .temp{margin:0;align-self:end;font-size:2.6rem;font-weight:800;line-height:1}
    .temp span{font-size:1.2rem;vertical-align:super}
    .sky{grid-column:2/-1;margin:0;color:var(--color-ink-muted);font-size:.76rem;font-weight:700}

    .verdict{display:grid;gap:2px;margin:0;padding:11px 13px;border-radius:var(--radius);font-size:.72rem}
    .verdict strong{font-size:.8rem}
    .verdict-buone{color:#14532d;background:#dcfce7}
    .verdict-attenzione{color:#7a4a06;background:var(--color-tournament-soft)}
    .verdict-difficili{color:#7f1d1d;background:var(--color-danger-soft)}

    .metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:0}
    .metrics div{display:grid;gap:1px;padding:9px 11px;border-radius:var(--radius-sm);background:var(--color-surface-muted)}
    .metrics dt{color:var(--color-ink-muted);font-size:.62rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
    .metrics dd{margin:0;font-size:1rem;font-weight:800}
    .metrics small{margin-left:3px;font-size:.6rem;font-weight:700}

    .hours{display:flex;gap:8px;padding:0;margin:0;overflow-x:auto;list-style:none;scrollbar-width:none}
    .hours::-webkit-scrollbar{display:none}
    .hours li{display:grid;flex:0 0 auto;justify-items:center;gap:4px;min-width:56px;padding:9px 8px;border:1px solid var(--color-border);border-radius:var(--radius-sm)}
    .hours span{color:var(--color-ink-muted);font-size:.64rem;font-weight:750}
    .mini{width:24px;height:24px;color:var(--color-ink-muted)}
    .hours b{font-size:.82rem}

    .credit{margin:0;color:var(--color-ink-muted);font-size:.6rem}
    .credit a{color:inherit}

    @media(min-width:520px){.metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}
  `,
})
export class WeatherPanel {
  readonly latitude = input<number | null>(null);
  readonly longitude = input<number | null>(null);
  readonly place = input<string | null>(null);
  protected readonly hasPlace = computed(() => this.latitude() !== null && this.longitude() !== null);

  private readonly weather = inject(WeatherService);
  protected readonly snapshot = signal<WeatherSnapshot | null>(null);
  protected readonly loading = signal(false);
  protected readonly verdict = computed(() => {
    const current = this.snapshot()?.current;
    return current ? playability(current) : null;
  });

  constructor() {
    effect(() => {
      const latitude = this.latitude();
      const longitude = this.longitude();
      untracked(() => void this.load(latitude, longitude));
    });
  }

  protected describe(code: number): string { return weatherDescription(code); }

  private async load(latitude: number | null, longitude: number | null): Promise<void> {
    if (latitude === null || longitude === null) { this.snapshot.set(null); return; }
    this.loading.set(true);
    this.snapshot.set(await this.weather.snapshot({ latitude, longitude }));
    this.loading.set(false);
  }
}
