import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WeatherService } from '../../core/services/weather.service';
import { WeatherGlyph } from './weather-glyph';
import { WeatherScene } from './weather-scene';
import { isNight } from './weather-icon.model';
import { playability, weatherDescription, WeatherSnapshot } from './weather.model';

/**
 * Meteo della citta scelta nel profilo. Se la citta manca il pannello non finge:
 * dice che manca e porta al profilo. Se il servizio non risponde il blocco resta
 * discreto, perche il meteo non deve mai bloccare la home.
 */
@Component({
  selector: 'app-weather-panel',
  imports: [DatePipe, DecimalPipe, RouterLink, WeatherGlyph, WeatherScene],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="weather" aria-labelledby="weather-title">
      @if (snapshot(); as data) { <app-weather-scene [code]="data.current.weatherCode" [night]="night()" /> }
      <div class="top">
        <div>
          <span class="eyebrow">Meteo di oggi</span>
          <h2 id="weather-title">{{ place() || 'La tua città' }}</h2>
        </div>
        @if (snapshot(); as data) { <app-weather-glyph class="glyph" [code]="data.current.weatherCode" [night]="night()" /> }
      </div>

      @if (!hasPlace()) {
        <a class="empty" routerLink="/profilo">
          <strong>Imposta la tua città</strong>
          <span>Serve per sapere che tempo fa dove giochi.</span>
          <i class="pi pi-arrow-right" aria-hidden="true"></i>
        </a>
      } @else if (loading()) {
        <p class="state" role="status">Lettura del cielo…</p>
      } @else if (snapshot(); as data) {
        <p class="temperature num">{{ data.current.temperature | number: '1.0-0' }}°</p>
        <strong class="verdict">{{ verdict()?.label }}</strong>
        <p class="copy">{{ describe(data.current.weatherCode) }} · {{ verdict()?.reason }}</p>

        <dl class="stats">
          <div><dt>Vento</dt><dd class="num">{{ data.current.windSpeed | number: '1.0-0' }} km/h</dd></div>
          <div><dt>Umidità</dt><dd class="num">{{ data.current.humidity | number: '1.0-0' }}%</dd></div>
          @if (data.sunset) {
            <div><dt>Tramonto</dt><dd class="num">{{ data.sunset | date: 'HH:mm' }}</dd></div>
          } @else {
            <div><dt>Raffiche</dt><dd class="num">{{ data.current.windGusts | number: '1.0-0' }} km/h</dd></div>
          }
        </dl>

        <p class="credit">Dati meteo di <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo.com</a></p>
      } @else {
        <p class="state">Meteo non disponibile in questo momento.</p>
      }
    </section>
  `,
  styles: `
    :host{display:block;height:100%}
    .num{font-family:var(--font-numeric);font-variant-numeric:tabular-nums}
    .weather{position:relative;display:flex;height:100%;flex-direction:column;overflow:hidden;padding:24px;color:white;border-radius:var(--radius-lg);
      background:linear-gradient(145deg,#056cad 0%,#0477bd 52%,#084866 100%);box-shadow:0 18px 50px rgb(7 54 79/.12);text-shadow:0 1px 12px rgb(4 30 48/.35)}
    .weather>*{position:relative;z-index:2}
    app-weather-scene{z-index:0}

    .top{display:flex;justify-content:space-between;gap:16px}
    .eyebrow{display:inline-flex;color:#b5def0;font-size:.62rem;font-weight:900;letter-spacing:.18em;text-transform:uppercase}
    h2{margin:7px 0 0;font-family:var(--display-font);font-size:1.65rem;letter-spacing:-.03em}
    .glyph{width:64px;height:64px;flex:0 0 64px;color:rgb(255 255 255/.85)}

    .temperature{margin:20px 0 0;font-size:4.4rem;font-weight:600;line-height:1;letter-spacing:-.06em}
    .verdict{display:block;margin-top:8px;font-size:1rem}
    .copy{margin:6px 0 0;color:#d3edf7;font-size:.74rem}

    .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:auto 0 0;padding-top:18px;border-top:1px solid rgb(255 255 255/.2)}
    .stats>div{min-width:0;padding-right:10px}
    .stats>div+div{padding-left:13px;border-left:1px solid rgb(255 255 255/.12)}
    .stats dt{color:#b6d9e8;font-size:.54rem;font-weight:850;letter-spacing:.1em;text-transform:uppercase}
    .stats dd{margin:5px 0 0;font-size:.78rem;font-weight:800}

    .empty{display:grid;grid-template-columns:1fr auto;align-items:center;gap:2px 12px;min-height:44px;margin-top:20px;padding:14px;color:white;border:1px dashed rgb(255 255 255/.45);border-radius:var(--radius);text-decoration:none}
    .empty strong{font-size:.9rem}
    .empty span{color:#d3edf7;font-size:.72rem}
    .empty i{grid-row:1/3}
    .state{margin:20px 0 0;color:#d3edf7;font-size:.76rem}
    .credit{margin:14px 0 0;color:#a9cfe2;font-size:.58rem}
    .credit a{color:inherit}

    @media(max-width:1120px){.weather{min-height:330px}}
    @media(max-width:560px){.weather{padding:18px}.temperature{font-size:3.6rem}}
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
  /** Notte secondo alba e tramonto del luogo: decide icone e colore del cielo. */
  protected readonly night = computed(() => {
    const data = this.snapshot();
    return isNight(new Date(), data?.sunrise ?? null, data?.sunset ?? null);
  });
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
