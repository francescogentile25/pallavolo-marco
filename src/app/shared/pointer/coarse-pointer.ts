import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

/**
 * Dice se si sta puntando con un dito invece che con un mouse.
 *
 * Serve a spegnere il trascinamento dove non funziona: sul telefono il gesto
 * del drag ruba lo scorrimento della pagina, e chi organizza il torneo resta
 * bloccato. Al suo posto vale il tocco: seleziona, poi tocca la destinazione.
 */
@Injectable({ providedIn: 'root' })
export class CoarsePointer {
  private readonly matches = signal(false);

  readonly isCoarse = computed(() => this.matches());

  constructor() {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia('(pointer: coarse)');
    this.matches.set(query.matches);
    const onChange = (event: MediaQueryListEvent) => this.matches.set(event.matches);
    query.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));
  }
}
