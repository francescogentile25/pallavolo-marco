import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BottomDock } from '../../../shared/components/bottom-dock/bottom-dock';
import { FloatingActionPill } from '../../../shared/components/floating-action-pill/floating-action-pill';
import { Header } from '../header/header';

@Component({
  selector: 'app-main',
  imports: [Header, RouterOutlet, BottomDock, FloatingActionPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-shell">
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
    .page-content { min-height: calc(100dvh - var(--header-height)); }
  `,
})
export class Main {}
