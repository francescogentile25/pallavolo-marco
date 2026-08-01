import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PageActionsService } from '../../core/services/page-actions.service';

@Component({
  selector: 'app-coming-soon',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="coming-soon">
      <span class="feature-icon" aria-hidden="true">
        <i class="pi {{ icon }}"></i>
      </span>
      <p class="eyebrow">Prossima implementazione</p>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
      <a routerLink="/">Torna alla home</a>
    </main>
  `,
  styles: `
    :host { display: block; }
    .coming-soon {
      display: grid;
      width: min(100% - 32px, 680px);
      min-height: calc(100dvh - var(--header-height) - var(--bottom-nav-height) - 44px);
      align-content: center;
      justify-items: start;
      padding: 42px 6px calc(var(--bottom-nav-height) + 40px);
      margin: 0 auto;
    }
    .feature-icon {
      display: grid;
      width: 62px;
      height: 62px;
      margin-bottom: 22px;
      place-items: center;
      color: white;
      border-radius: 20px;
      background: var(--color-brand-strong);
      box-shadow: 0 12px 26px rgb(11 112 105 / 0.24);
      font-size: 1.5rem;
    }
    .eyebrow { margin: 0 0 8px; color: var(--color-brand-strong); font-size: 0.72rem; font-weight: 850; letter-spacing: 0.1em; text-transform: uppercase; }
    h1 { margin: 0 0 12px; font: 900 clamp(2.4rem, 12vw, 5rem)/0.95 var(--display-font); letter-spacing: -0.055em; }
    p:not(.eyebrow) { max-width: 42rem; margin: 0 0 24px; color: var(--color-ink-muted); line-height: 1.6; }
    a { display: inline-flex; min-height: 44px; align-items: center; padding: 0 18px; color: white; border-radius: 14px; background: var(--color-ocean); font-weight: 800; text-decoration: none; }
    a:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }
  `,
})
export class ComingSoon implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly pageActions = inject(PageActionsService);

  protected readonly title = this.route.snapshot.data['title'] as string;
  protected readonly description = this.route.snapshot.data['description'] as string;
  protected readonly icon = this.route.snapshot.data['icon'] as string;

  ngOnInit(): void {
    this.pageActions.set([
      {
        id: 'back-home',
        label: 'Torna alla home',
        icon: 'pi-arrow-left',
        iconOnly: true,
        routerLink: '/',
      },
    ]);
  }

  ngOnDestroy(): void {
    this.pageActions.clear();
  }
}
