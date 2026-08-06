import { Directive, ElementRef, inject, input, OnDestroy, afterNextRender } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** Vero solo se l'utente non ha chiesto di ridurre il movimento. */
export function motionAllowed(): boolean {
  return typeof matchMedia !== 'function' || !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Fa entrare un elemento quando entra nello schermo.
 *
 * Con `appReveal="stagger"` anima i figli diretti a cascata, che e il caso piu
 * frequente: una griglia di schede che si compone invece di comparire tutta insieme.
 * Se il movimento e disattivato non registra nulla e lascia il contenuto fermo e
 * visibile: nessun rischio di restare con opacita zero.
 */
@Directive({ selector: '[appReveal]' })
export class Reveal implements OnDestroy {
  readonly appReveal = input<'' | 'self' | 'stagger'>('self');
  readonly revealDelay = input(0);

  private readonly host = inject(ElementRef<HTMLElement>);
  private trigger?: ScrollTrigger;

  constructor() {
    afterNextRender(() => this.play());
  }

  private play(): void {
    if (!motionAllowed()) return;
    const element = this.host.nativeElement as HTMLElement;
    const mode = this.appReveal();
    const targets = mode === 'stagger' ? Array.from(element.children) : [element];
    if (!targets.length) return;

    const animation = gsap.from(targets, {
      opacity: 0,
      y: 18,
      duration: 0.5,
      ease: 'power2.out',
      delay: this.revealDelay(),
      stagger: mode === 'stagger' ? 0.07 : 0,
      paused: true,
    });

    this.trigger = ScrollTrigger.create({
      trigger: element,
      start: 'top 88%',
      once: true,
      onEnter: () => animation.play(),
    });
  }

  ngOnDestroy(): void {
    this.trigger?.kill();
  }
}
