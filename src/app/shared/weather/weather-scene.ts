import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { motionAllowed } from '../motion/reveal.directive';
import { skyMood } from './weather-icon.model';

/**
 * Sfondo vivo del pannello meteo: il cielo cambia colore con le condizioni e con
 * l'ora, le nuvole scorrono, la pioggia cade, di notte si accendono le stelle.
 * Tutto in CSS, senza canvas ne timer: il browser lo compone sul compositor e
 * non costa niente al thread principale. Con `prefers-reduced-motion` resta il
 * solo gradiente, fermo.
 */
@Component({
  selector: 'app-weather-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scene" [class]="'scene mood-' + mood() + (night() ? ' is-night' : '')" aria-hidden="true">
      @if (moving) {
        @if (night()) {
          @for (star of stars; track star.left) {
            <i class="star" [style.left.%]="star.left" [style.top.%]="star.top" [style.animation-delay.s]="star.delay"></i>
          }
        } @else if (mood() === 'clear' || mood() === 'partly') {
          <i class="sun-glow"></i>
        }

        @if (mood() !== 'clear') {
          <i class="cloud cloud-a"></i>
          <i class="cloud cloud-b"></i>
          @if (mood() === 'overcast' || mood() === 'storm' || mood() === 'rain') { <i class="cloud cloud-c"></i> }
        }

        @if (mood() === 'rain' || mood() === 'storm') {
          @for (drop of drops; track drop.left) {
            <i class="drop" [style.left.%]="drop.left" [style.animation-delay.s]="drop.delay" [style.animation-duration.s]="drop.duration"></i>
          }
        }

        @if (mood() === 'snow') {
          @for (flake of drops; track flake.left) {
            <i class="flake" [style.left.%]="flake.left" [style.animation-delay.s]="flake.delay" [style.animation-duration.s]="flake.duration * 3"></i>
          }
        }

        @if (mood() === 'storm') { <i class="flash"></i> }
        @if (mood() === 'fog') { <i class="haze"></i> }
      }
    </div>
  `,
  styles: `
    :host{position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none}
    .scene{position:absolute;inset:0;background:linear-gradient(160deg,#0f8ad0,#0a6fae 46%,#084866)}

    /* il cielo secondo le condizioni */
    .mood-clear{background:linear-gradient(160deg,#33a9e6,#0a80c8 45%,#075a91)}
    .mood-partly{background:linear-gradient(160deg,#2f9fdc,#0a72b4 48%,#075784)}
    .mood-overcast{background:linear-gradient(160deg,#5c7f96,#41647c 50%,#2c4a5e)}
    .mood-fog{background:linear-gradient(160deg,#7e93a1,#5d7686 52%,#3f5666)}
    .mood-rain{background:linear-gradient(160deg,#3d6f92,#2b5473 50%,#1d3b53)}
    .mood-snow{background:linear-gradient(160deg,#7fa6c4,#5b83a4 52%,#3d5f7c)}
    .mood-storm{background:linear-gradient(160deg,#2f4560,#233449 50%,#151f2e)}
    .is-night.mood-clear,.is-night.mood-partly{background:linear-gradient(160deg,#123055,#0d2140 46%,#07142a)}
    .is-night.mood-overcast,.is-night.mood-fog{background:linear-gradient(160deg,#2a3b4d,#1d2a38 52%,#111a24)}
    .is-night.mood-rain,.is-night.mood-snow{background:linear-gradient(160deg,#1f3a52,#16293b 52%,#0d1a26)}

    /* sole: alone caldo che respira */
    .sun-glow{position:absolute;top:-70px;right:-60px;width:260px;height:260px;border-radius:50%;
      background:radial-gradient(circle,rgb(255 214 102/.55),rgb(255 191 36/.18) 45%,transparent 70%);
      animation:breathe 9s ease-in-out infinite}

    /* nuvole: tre banchi a velocita diverse */
    .cloud{position:absolute;height:70px;border-radius:999px;background:rgb(255 255 255/.14);filter:blur(6px)}
    .cloud::before,.cloud::after{position:absolute;border-radius:50%;background:inherit;content:''}
    .cloud::before{top:-24px;left:26px;width:78px;height:78px}
    .cloud::after{top:-16px;right:30px;width:56px;height:56px}
    .cloud-a{top:14%;width:190px;animation:drift 34s linear infinite}
    .cloud-b{top:42%;width:150px;opacity:.7;animation:drift 46s linear infinite;animation-delay:-12s}
    .cloud-c{top:64%;width:220px;opacity:.5;animation:drift 58s linear infinite;animation-delay:-26s}

    /* precipitazioni */
    .drop{position:absolute;top:-12%;width:2px;height:16px;border-radius:2px;background:linear-gradient(180deg,transparent,rgb(255 255 255/.55));animation:fall linear infinite}
    .flake{position:absolute;top:-8%;width:5px;height:5px;border-radius:50%;background:rgb(255 255 255/.75);animation:flutter linear infinite}

    .flash{position:absolute;inset:0;background:rgb(255 255 255/.75);opacity:0;animation:strike 7s steps(1,end) infinite}
    .haze{position:absolute;inset:0;background:linear-gradient(0deg,rgb(255 255 255/.22),transparent 55%);animation:breathe 12s ease-in-out infinite}
    .star{position:absolute;width:2px;height:2px;border-radius:50%;background:white;opacity:.75;animation:twinkle 4s ease-in-out infinite}

    @keyframes drift{from{transform:translateX(-40%)}to{transform:translateX(320%)}}
    @keyframes fall{from{transform:translateY(0)}to{transform:translateY(340px)}}
    @keyframes flutter{from{transform:translate(0,0)}50%{transform:translate(14px,170px)}to{transform:translate(0,340px)}}
    @keyframes breathe{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}
    @keyframes twinkle{0%,100%{opacity:.25}50%{opacity:.9}}
    @keyframes strike{0%,92%,100%{opacity:0}93%{opacity:.5}94%{opacity:0}96%{opacity:.35}97%{opacity:0}}
  `,
})
export class WeatherScene {
  readonly code = input.required<number>();
  readonly night = input(false);

  protected readonly moving = motionAllowed();
  protected readonly mood = computed(() => skyMood(this.code()));

  /** Posizioni fisse: cosi le gocce non saltano a ogni ciclo di rendering. */
  protected readonly drops = [8, 19, 27, 36, 44, 53, 61, 70, 78, 87, 94].map((left, index) => ({
    left,
    delay: (index % 5) * 0.4,
    duration: 0.9 + (index % 4) * 0.25,
  }));

  protected readonly stars = [12, 24, 33, 47, 58, 66, 74, 82, 91].map((left, index) => ({
    left,
    top: 8 + ((index * 13) % 46),
    delay: (index % 6) * 0.7,
  }));
}
