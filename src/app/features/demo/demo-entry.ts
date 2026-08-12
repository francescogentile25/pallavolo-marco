import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthStore } from '../auth/store/auth.store';
import { FORCE_DEMO_TOUR_KEY } from '../../core/tours/tour-launcher.service';

@Component({
  selector: 'app-demo-entry',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="entry" role="status"><span></span><p>Prepariamo la demo nell'app reale…</p></main>`,
  styles: `:host{display:block;min-height:100dvh;background:var(--color-ocean)}.entry{display:grid;min-height:100dvh;place-content:center;justify-items:center;gap:14px;color:white}.entry span{width:28px;height:28px;border:3px solid #ffffff55;border-top-color:var(--court-yellow);border-radius:50%;animation:spin .7s linear infinite}.entry p{font-weight:750}@keyframes spin{to{transform:rotate(360deg)}}`,
})
export class DemoEntry {
  private readonly auth = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  constructor() {
    effect(() => {
      if (!this.auth.initialized()) return;
      const role = this.route.snapshot.paramMap.get('ruolo') === 'organizzatore' ? 'organizzatore' : 'giocatore';
      sessionStorage.setItem(FORCE_DEMO_TOUR_KEY, '1');
      void this.auth.enterDemo(role);
    });
  }
}
