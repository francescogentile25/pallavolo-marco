import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PageAction } from '../../../core/models/page-action.model';
import { PageActionsService } from '../../../core/services/page-actions.service';
import { AuthStore } from '../../../features/auth/store/auth.store';

@Component({
  selector: 'app-bottom-dock',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      class="app-bottom-dock"
      [class.has-actions]="hasActions()"
      aria-label="Navigazione principale"
    >
      @if (hasActions()) {
        <div class="dock-actions" role="group" aria-label="Azioni della pagina">
          @for (action of actions(); track action.id) {
            @if (action.routerLink) {
              <a
                class="dock-action"
                [class]="actionClasses(action)"
                [routerLink]="action.routerLink"
                [queryParams]="action.queryParams ?? null"
                [attr.aria-label]="action.label"
                [attr.title]="action.label"
                (click)="runAction($event, action)"
              >
                <i class="pi {{ action.icon }}" aria-hidden="true"></i>
                @if (showsLabel(action)) {
                  <span class="label-long">{{ action.label }}</span>
                  @if (action.shortLabel) {
                    <span class="label-short">{{ action.shortLabel }}</span>
                  }
                }
              </a>
            } @else if (action.href) {
              <a
                class="dock-action"
                [class]="actionClasses(action)"
                [href]="action.href"
                [attr.aria-label]="action.label"
                [attr.title]="action.label"
                (click)="runAction($event, action)"
              >
                <i class="pi {{ action.icon }}" aria-hidden="true"></i>
                @if (showsLabel(action)) {
                  <span class="label-long">{{ action.label }}</span>
                  @if (action.shortLabel) {
                    <span class="label-short">{{ action.shortLabel }}</span>
                  }
                }
              </a>
            } @else {
              <button
                type="button"
                class="dock-action"
                [class]="actionClasses(action)"
                [attr.aria-label]="action.label"
                [attr.title]="action.label"
                (click)="runAction($event, action)"
              >
                <i class="pi {{ action.icon }}" aria-hidden="true"></i>
                @if (showsLabel(action)) {
                  <span class="label-long">{{ action.label }}</span>
                  @if (action.shortLabel) {
                    <span class="label-short">{{ action.shortLabel }}</span>
                  }
                }
              </button>
            }
          }
        </div>
      }

      <ul class="dock-nav-list" role="list">
        @for (item of navItems; track item.id) {
          <li [class.is-create]="item.id === 'avatar'">
            <a
              [routerLink]="item.route"
              routerLinkActive="is-active"
              [routerLinkActiveOptions]="{ exact: item.route === '/' }"
            >
              <span class="nav-icon">
                @if (item.id === 'avatar') {
                  @if (avatarUrl(); as url) { <img [src]="url" alt="" /> } @else { <span class="dock-ini">{{ initials() }}</span> }
                } @else {
                  <i class="pi {{ item.icon }}" aria-hidden="true"></i>
                }
              </span>
              <span>{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: `
    :host { display: contents; }

    .app-bottom-dock {
      position: fixed;
      z-index: var(--z-fixed);
      right: var(--space-3);
      bottom: calc(var(--safe-bottom) + var(--space-3));
      left: var(--space-3);
      overflow: visible;
      color: var(--color-ink);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: rgb(255 255 255 / 0.92);
      box-shadow: 0 18px 44px rgb(20 24 26 / 0.16), 0 2px 8px rgb(20 24 26 / 0.07);
      backdrop-filter: saturate(1.4) blur(22px);
      -webkit-backdrop-filter: saturate(1.4) blur(22px);
    }

    .dock-nav-list {
      display: flex;
      align-items: stretch;
      height: var(--bottom-nav-height);
      padding: 0 4px;
      margin: 0;
      list-style: none;
    }

    .dock-nav-list li { flex: 1; min-width: 0; }

    .dock-nav-list a {
      display: flex;
      height: 100%;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 4px;
      color: var(--color-ink-muted);
      font-size: 0.68rem;
      font-weight: 750;
      letter-spacing: 0.01em;
      text-decoration: none;
      -webkit-tap-highlight-color: transparent;
    }

    .nav-icon {
      display: grid;
      width: 30px;
      height: 26px;
      place-items: center;
      border-radius: var(--radius);
      font-size: 1.1rem;
      transition: transform var(--duration-fast) var(--ease-out);
    }

    .dock-nav-list a.is-active { color: var(--color-brand-strong); }
    .dock-nav-list a.is-active .nav-icon { background: var(--color-brand-soft); }
    .dock-nav-list a.is-active .nav-icon { transform: translateY(-2px); }

    .dock-nav-list .is-create .nav-icon {
      width: 46px;
      height: 46px;
      margin-top: -27px;
      overflow: hidden;
      color: white;
      border: 4px solid rgb(255 255 255 / 0.95);
      border-radius: 50%;
      background: var(--color-brand);
      box-shadow: 0 8px 18px rgb(212 86 42 / 0.3);
    }

    .dock-nav-list .is-create .nav-icon img { width: 100%; height: 100%; object-fit: cover; }
    .dock-ini { font-size: 0.95rem; font-weight: 900; color: white; }

    .dock-actions {
      display: flex;
      min-height: 58px;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding: 8px 10px 6px;
      border-bottom: 1px solid var(--color-border);
    }

    .dock-action {
      display: inline-flex;
      min-width: 44px;
      min-height: 44px;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 0 14px;
      color: var(--color-ink);
      border: 0;
      border-radius: var(--radius);
      background: var(--color-surface-muted);
      font: inherit;
      font-size: 0.78rem;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
    }

    .dock-action.is-icon-only { flex: 0 0 44px; padding: 0; }
    .dock-action.is-danger { order: 1; color: var(--color-danger); background: var(--color-danger-soft); }
    .dock-action.is-default, .dock-action.is-labeled { order: 2; }
    .dock-action.is-success { order: 3; color: var(--color-success); background: var(--color-success-soft); }
    .dock-action.is-primary {
      order: 9;
      flex: 1 1 auto;
      color: white;
      background: var(--color-brand);
    }

    .label-short { display: none; }
    .dock-actions:has(.is-primary):has(.is-danger, .is-success) .label-long { display: none; }
    .dock-actions:has(.is-primary):has(.is-danger, .is-success) .label-short { display: inline; }

    a:focus-visible, button:focus-visible {
      outline: 3px solid var(--color-focus);
      outline-offset: 2px;
    }

    @media (min-width: 1024px) {
      .app-bottom-dock { display: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .nav-icon { transition: none; }
    }
  `,
})
export class BottomDock {
  private readonly pageActions = inject(PageActionsService);

  protected readonly actions = this.pageActions.actions;
  protected readonly hasActions = computed(() => this.actions().length > 0);
  private readonly authStore = inject(AuthStore);
  protected readonly avatarUrl = computed(() => this.authStore.profile()?.avatar_url ?? null);
  protected readonly initials = computed(() => {
    const p = this.authStore.profile();
    return p ? `${p.nome.charAt(0)}${p.cognome.charAt(0)}`.toUpperCase() : 'BV';
  });
  protected readonly navItems = [
    { id: 'home', route: '/', icon: 'pi-home', label: 'Home' },
    { id: 'matches', route: '/partite', icon: 'pi-users', label: 'Partite' },
    { id: 'avatar', route: '/profilo', icon: 'pi-user', label: 'Profilo' },
    { id: 'tournaments', route: '/tornei', icon: 'pi-trophy', label: 'Tornei' },
    { id: 'courts', route: '/campi', icon: 'pi-map-marker', label: 'Campi' },
  ] as const;

  protected showsLabel(action: PageAction): boolean {
    return Boolean(
      !action.iconOnly &&
        !action.iconOnlyMobile &&
        (action.primary || action.danger || action.success || action.labeled),
    );
  }

  protected actionClasses(action: PageAction): string {
    const classes = ['dock-action'];
    if (action.primary) classes.push('is-primary');
    if (action.danger) classes.push('is-danger');
    if (action.success) classes.push('is-success');
    if (action.labeled) classes.push('is-labeled');
    if (!action.primary && !action.danger && !action.success && !action.labeled) {
      classes.push('is-default');
    }
    if (!this.showsLabel(action)) classes.push('is-icon-only');
    return classes.join(' ');
  }

  protected runAction(event: Event, action: PageAction): void {
    if (action.click && !action.routerLink && !action.href) {
      event.preventDefault();
    }
    action.click?.();
  }
}
