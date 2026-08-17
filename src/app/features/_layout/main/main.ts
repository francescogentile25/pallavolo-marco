import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BottomDock } from '../../../shared/components/bottom-dock/bottom-dock';
import { FloatingActionPill } from '../../../shared/components/floating-action-pill/floating-action-pill';
import { Header } from '../header/header';
import { AuthStore } from '../../auth/store/auth.store';

@Component({
  selector: 'app-main',
  imports: [Header, RouterOutlet, BottomDock, FloatingActionPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-shell">
      @if (auth.isDemo()) {
        <aside class="demo-strip" aria-label="Modalità demo">
          <span><i class="pi pi-sparkles"></i> Demo con dati simulati</span>
          <div><button type="button" [class.active]="auth.profile()?.ruolo === 'giocatore'" (click)="changeRole('giocatore')">Giocatore</button><button type="button" [class.active]="auth.profile()?.ruolo === 'organizzatore'" (click)="changeRole('organizzatore')">Organizzatore</button></div>
        </aside>
      }
      <app-header />
      <div class="page-content">
        <router-outlet />
      </div>
      <app-bottom-dock />
      <app-floating-action-pill />
    </div>
  `,
  styles: `
    :host { display: block; min-height: 100dvh; }
    .app-shell { min-height: 100dvh; }
    .demo-strip{display:flex;min-height:44px;align-items:center;gap:10px;padding:6px 14px;color:white;background:#102e43;font-size:.68rem}.demo-strip>span{font-weight:800}.demo-strip>span i{color:var(--court-yellow)}.demo-strip>div{display:flex;margin-left:auto;padding:2px;border-radius:999px;background:#ffffff18}.demo-strip button{min-height:32px;padding:0 10px;color:#ffffffbb;border:0;border-radius:999px;background:transparent;font-size:.65rem;font-weight:800;cursor:pointer}.demo-strip button.active{color:#102e43;background:white}@media(max-width:520px){.demo-strip>span{font-size:0}.demo-strip>span i{font-size:1rem}}
    .page-content { min-height: calc(100dvh - var(--header-height)); }
  `,
})
export class Main {
  protected readonly auth = inject(AuthStore);
  protected changeRole(role: 'giocatore' | 'organizzatore'): void { void this.auth.changeDemoRole(role); }
}
