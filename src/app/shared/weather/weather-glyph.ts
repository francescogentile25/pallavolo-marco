import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { weatherDescription, weatherGlyph } from './weather.model';

/**
 * Icone meteo disegnate a mano: il set PrimeIcons non copre pioggia, neve e nebbia,
 * e forme geometriche semplici stanno bene accanto alle fettucce del campo.
 */
@Component({
  selector: 'app-weather-glyph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 48 48" role="img" [attr.aria-label]="label()" focusable="false">
      @switch (glyph()) {
        @case ('sereno') {
          <circle class="sun" cx="24" cy="24" r="10" />
          @for (ray of rays; track ray) { <line class="ray" x1="24" y1="4" x2="24" y2="10" [attr.transform]="'rotate(' + ray + ' 24 24)'" /> }
        }
        @case ('poco-nuvoloso') {
          <circle class="sun" cx="19" cy="18" r="8" />
          <path class="cloud" d="M18 38h17a7 7 0 0 0 .6-14 10 10 0 0 0-18.9 3A6 6 0 0 0 18 38Z" />
        }
        @case ('nuvoloso') {
          <path class="cloud" d="M15 38h19a8 8 0 0 0 .7-16 11 11 0 0 0-20.8 3.3A6.4 6.4 0 0 0 15 38Z" />
        }
        @case ('nebbia') {
          <path class="cloud" d="M15 30h19a8 8 0 0 0 .7-16 11 11 0 0 0-20.8 3.3A6.4 6.4 0 0 0 15 30Z" />
          <line class="ray" x1="11" y1="37" x2="37" y2="37" />
          <line class="ray" x1="15" y1="43" x2="33" y2="43" />
        }
        @case ('pioggia') {
          <path class="cloud" d="M15 30h19a8 8 0 0 0 .7-16 11 11 0 0 0-20.8 3.3A6.4 6.4 0 0 0 15 30Z" />
          <line class="drop" x1="18" y1="35" x2="15" y2="43" />
          <line class="drop" x1="26" y1="35" x2="23" y2="43" />
          <line class="drop" x1="34" y1="35" x2="31" y2="43" />
        }
        @case ('neve') {
          <path class="cloud" d="M15 30h19a8 8 0 0 0 .7-16 11 11 0 0 0-20.8 3.3A6.4 6.4 0 0 0 15 30Z" />
          <circle class="flake" cx="17" cy="39" r="2" />
          <circle class="flake" cx="25" cy="42" r="2" />
          <circle class="flake" cx="33" cy="39" r="2" />
        }
        @case ('temporale') {
          <path class="cloud" d="M15 30h19a8 8 0 0 0 .7-16 11 11 0 0 0-20.8 3.3A6.4 6.4 0 0 0 15 30Z" />
          <path class="flash" d="M26 33 19 43h6l-2 6 9-11h-6l2-5Z" />
        }
      }
    </svg>
  `,
  styles: `
    :host{display:inline-flex}
    svg{width:100%;height:100%}
    .sun{fill:var(--court-yellow,#f0b429)}
    .ray{stroke:var(--court-yellow,#f0b429);stroke-width:3;stroke-linecap:round}
    .cloud{fill:currentColor;opacity:.9}
    .drop{stroke:var(--color-brand,#1e4fa3);stroke-width:3;stroke-linecap:round}
    .flake{fill:var(--color-brand,#1e4fa3)}
    .flash{fill:var(--court-yellow,#f0b429)}
  `,
})
export class WeatherGlyph {
  readonly code = input.required<number>();
  protected readonly rays = [0, 45, 90, 135, 180, 225, 270, 315];
  protected readonly glyph = computed(() => weatherGlyph(this.code()));
  protected readonly label = computed(() => weatherDescription(this.code()));
}
