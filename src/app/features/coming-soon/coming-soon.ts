import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PageActionsService } from '../../core/services/page-actions.service';
import { AuthStore } from '../auth/store/auth.store';

@Component({
  selector: 'app-coming-soon',
  imports: [ButtonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="coming-soon">
      <span class="feature-icon" aria-hidden="true">
        <i class="pi {{ icon }}"></i>
      </span>
      <p class="eyebrow">Prossima implementazione</p>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
      <div class="actions">
        @if (showAction()) { <a pButton [routerLink]="actionLink"><i class="pi pi-plus" pButtonIcon></i><span pButtonLabel>{{ actionLabel }}</span></a> }
        <a pButton severity="secondary" [outlined]="true" routerLink="/"><i class="pi pi-arrow-left" pButtonIcon></i><span pButtonLabel>Torna alla home</span></a>
      </div>
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
      padding: 42px 6px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 56px);
      margin: 0 auto;
    }
    .feature-icon {
      display: grid;
      width: 62px;
      height: 62px;
      margin-bottom: 22px;
      place-items: center;
      color: white;
      border-radius: var(--radius-lg);
      background: var(--color-brand-strong);
      box-shadow: 0 12px 26px rgb(11 112 105 / 0.24);
      font-size: 1.5rem;
    }
    .eyebrow { margin: 0 0 8px; color: var(--color-brand-strong); font-size: 0.72rem; font-weight: 850; letter-spacing: 0.1em; text-transform: uppercase; }
    h1 { margin: 0 0 12px; font: 900 clamp(2.4rem, 12vw, 5rem)/0.95 var(--display-font); letter-spacing: -0.055em; }
    p:not(.eyebrow) { max-width: 42rem; margin: 0 0 24px; color: var(--color-ink-muted); line-height: 1.6; }
    .actions { display: flex; flex-wrap: wrap; gap: 9px; }
    .actions a { justify-content: center; text-decoration: none; }
    a:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }
  `,
})
export class ComingSoon implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly pageActions = inject(PageActionsService);
  private readonly authStore = inject(AuthStore);

  protected readonly title = this.route.snapshot.data['title'] as string;
  protected readonly description = this.route.snapshot.data['description'] as string;
  protected readonly icon = this.route.snapshot.data['icon'] as string;
  protected readonly actionLabel = this.route.snapshot.data['actionLabel'] as string | undefined;
  protected readonly actionLink = this.route.snapshot.data['actionLink'] as string | undefined;
  private readonly actionPermission = this.route.snapshot.data['actionPermission'] as string | undefined;
  protected readonly showAction = computed(() => Boolean(
    this.actionLabel &&
    this.actionLink &&
    (!this.actionPermission || (this.actionPermission === 'organizeTournaments' && this.authStore.canOrganizeTournaments())),
  ));

  ngOnInit(): void {
    this.pageActions.set([
      ...(this.showAction() ? [{ id: 'feature-action', label: this.actionLabel!, shortLabel: 'Organizza', icon: 'pi-plus', primary: true, routerLink: this.actionLink! }] : []),
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
