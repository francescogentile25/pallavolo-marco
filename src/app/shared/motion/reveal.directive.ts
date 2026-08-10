import { Directive, ElementRef, inject, input, OnDestroy, afterNextRender } from '@angular/core';
import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';
import { loadMotion } from './gsap-loader';

/** Vero solo se l'utente non ha chiesto di ridurre il movimento. */
export function motionAllowed(): boolean {
  return typeof matchMedia !== 'function' || !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Fa entrare un elemento quando entra nello schermo.
 *
 * Con `appReveal="stagger"` anima i figli diretti a cascata, che e il caso piu
 * frequente: una griglia di schede che si compone invece di comparire tutta insieme.
 * Se il movimento e disattivato non carica nemmeno la libreria e lascia il contenuto
 * fermo e visibile: nessun rischio di restare con opacita zero.
 */
@Directive({ selector: '[appReveal]' })
export class Reveal implements OnDestroy {
  readonly appReveal = input<'' | 'self' | 'stagger'>('self');
  readonly revealDelay = input(0);

  private readonly host = inject(ElementRef<HTMLElement>);
  private trigger?: ScrollTriggerType;
  private destroyed = false;

  constructor() {
    afterNextRender(() => void this.play());
  }

  private async play(): Promise<void> {
    if (!motionAllowed()) return;
    const element = this.host.nativeElement as HTMLElement;
    const mode = this.appReveal();
    const targets = mode === 'stagger' ? Array.from(element.children) : [element];
    if (!targets.length) return;

    const { gsap, ScrollTrigger } = await loadMotion();
    // La libreria arriva dopo: nel frattempo la vista puo essere sparita.
    if (this.destroyed) return;

    const animation = gsap.from(targets, {
      opacity: 0,
      y: 18,
      duration: 0.5,
      ease: 'power2.out',
      delay: this.revealDelay(),
      stagger: mode === 'stagger' ? 0.07 : 0,
      paused: true,
      // Evita un layer composito permanente: su Safari iOS puo falsare
      // l'hit-testing dei pulsanti dentro una griglia animata.
      onComplete: () => gsap.set(targets, { clearProps: 'transform,opacity' }),
    });

    this.trigger = ScrollTrigger.create({
      trigger: element,
      start: 'top 88%',
      once: true,
      onEnter: () => animation.play(),
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.trigger?.kill();
  }
}
