import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageAction } from '../../../core/models/page-action.model';
import { PageActionsService } from '../../../core/services/page-actions.service';

@Component({
  selector: 'app-floating-action-pill',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (actions().length) {
      <div class="action-pill" role="group" aria-label="Azioni della pagina">
        @for (action of actions(); track action.id) {
          @if (action.routerLink) {
            <a
              [class]="actionClasses(action)"
              [routerLink]="action.routerLink"
              [queryParams]="action.queryParams ?? null"
              [attr.aria-label]="action.label"
              [attr.title]="action.label"
              (click)="runAction($event, action)"
            >
              <i class="pi {{ action.icon }}" aria-hidden="true"></i>
              @if (!action.iconOnly) { <span>{{ action.label }}</span> }
            </a>
          } @else if (action.href) {
            <a
              [class]="actionClasses(action)"
              [href]="action.href"
              [attr.aria-label]="action.label"
              [attr.title]="action.label"
              (click)="runAction($event, action)"
            >
              <i class="pi {{ action.icon }}" aria-hidden="true"></i>
              @if (!action.iconOnly) { <span>{{ action.label }}</span> }
            </a>
          } @else {
            <button
              type="button"
              [class]="actionClasses(action)"
              [attr.aria-label]="action.label"
              [attr.title]="action.label"
              (click)="runAction($event, action)"
            >
              <i class="pi {{ action.icon }}" aria-hidden="true"></i>
              @if (!action.iconOnly) { <span>{{ action.label }}</span> }
            </button>
          }
        }
      </div>
    }
  `,
  styles: `
    :host { display: contents; }

    .action-pill {
      position: fixed;
      z-index: var(--z-fixed);
      right: 28px;
      bottom: 28px;
      display: none;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: rgb(255 255 255 / 0.94);
      box-shadow: 0 18px 44px rgb(20 24 26 / 0.16);
      backdrop-filter: blur(20px);
    }

    .pill-action {
      display: inline-flex;
      min-width: 44px;
      min-height: 44px;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 0 15px;
      color: var(--color-ink);
      border: 0;
      border-radius: 999px;
      background: var(--color-surface-muted);
      font: inherit;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
    }

    .is-icon-only { width: 44px; padding: 0; }
    .is-danger { order: 1; color: var(--color-danger); background: var(--color-danger-soft); }
    .is-default { order: 2; }
    .is-success { order: 3; color: var(--color-success); background: var(--color-success-soft); }
    .is-primary { order: 9; color: white; background: var(--color-brand); }
    .pill-action:hover { transform: translateY(-2px); }

    a:focus-visible, button:focus-visible {
      outline: 3px solid var(--color-focus);
      outline-offset: 2px;
    }

    @media (min-width: 1024px) {
      .action-pill { display: flex; }
    }
  `,
})
export class FloatingActionPill {
  private readonly pageActions = inject(PageActionsService);
  protected readonly actions = this.pageActions.actions;

  protected actionClasses(action: PageAction): string {
    const classes = ['pill-action'];
    if (action.primary) classes.push('is-primary');
    else if (action.danger) classes.push('is-danger');
    else if (action.success) classes.push('is-success');
    else classes.push('is-default');
    if (action.iconOnly) classes.push('is-icon-only');
    return classes.join(' ');
  }

  protected runAction(event: Event, action: PageAction): void {
    if (action.click && !action.routerLink && !action.href) {
      event.preventDefault();
    }
    action.click?.();
  }
}
