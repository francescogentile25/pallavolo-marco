import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

/**
 * Sfondo video delle pagine di accesso: riprodotto in loop, sfocato e coperto da un
 * velo scuro che tiene leggibile la card in vetro davanti.
 *
 * Con `prefers-reduced-motion` il video non viene nemmeno montato: resta il fotogramma
 * di posta, così non si scarica nulla e non si muove niente.
 */
@Component({
  selector: 'app-auth-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" aria-hidden="true">
      @if (showVideo()) {
        <video
          class="backdrop-media"
          autoplay
          muted
          loop
          playsinline
          disablepictureinpicture
          preload="auto"
          poster="assets/video/intro-bg.jpg"
        >
          <source src="assets/video/intro-bg.mp4" type="video/mp4" />
        </video>
      } @else {
        <img class="backdrop-media" src="assets/video/intro-bg.jpg" alt="" />
      }
      <span class="backdrop-veil"></span>
    </div>
  `,
  styles: `
    :host { display: contents; }

    .backdrop {
      position: fixed;
      z-index: 0;
      inset: 0;
      overflow: hidden;
      background: #05161d;
    }

    .backdrop-media {
      width: 100%;
      height: 100%;
      object-fit: cover;
      /* la scala nasconde i bordi ammorbiditi dalla sfocatura */
      transform: scale(1.06);
      filter: blur(4px) saturate(1.06);
    }

    .backdrop-veil {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(180deg, rgb(4 22 29 / .55), rgb(4 22 29 / .78)),
        radial-gradient(circle at 22% 32%, rgb(2 132 199 / .26), transparent 55%);
    }

    @media (max-width: 899px) {
      /* su mobile la card copre quasi tutto: serve piu contrasto sotto */
      .backdrop-veil { background: linear-gradient(180deg, rgb(4 22 29 / .62), rgb(4 22 29 / .86)); }
    }
  `,
})
export class AuthBackdrop {
  /**
   * Il video si monta solo se ha senso scaricarlo: niente movimento se l'utente lo ha
   * disattivato a livello di sistema, e niente 2,4 MB se il browser dichiara il
   * risparmio dati attivo. In quei casi resta il fotogramma di posta, 21 KB.
   */
  protected readonly showVideo = signal(this.shouldPlay());

  private shouldPlay(): boolean {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
    return !connection?.saveData;
  }
}
