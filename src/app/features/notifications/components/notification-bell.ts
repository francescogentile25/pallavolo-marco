import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../auth/store/auth.store';
import { AppNotification } from '../models/notification.model';
import { NotificationsService } from '../services/notifications.service';

const DROPDOWN_LIMIT = 10;

@Component({
  selector: 'app-notification-bell',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bell">
      <button
        type="button"
        class="bell-trigger"
        [attr.aria-expanded]="open()"
        aria-haspopup="menu"
        [attr.aria-label]="'Notifiche' + (unreadCount() ? ', ' + unreadCount() + ' non lette' : '')"
        (click)="toggle()"
      >
        <i class="pi pi-bell" aria-hidden="true"></i>
        @if (unreadCount() > 0) {
          <span class="bell-badge" aria-hidden="true">{{ badgeLabel() }}</span>
        }
      </button>

      @if (open()) {
        <div class="bell-pop" role="menu">
          <div class="bell-pop-head">
            <strong>Notifiche</strong>
            @if (unreadCount() > 0) {
              <button type="button" class="link-btn" (click)="service.markAllRead()">Segna tutte come lette</button>
            }
          </div>
          <div class="bell-pop-list" role="list">
            @for (n of recent(); track n.id) {
              <button type="button" class="bell-row" [class.is-unread]="!n.is_read" role="listitem" (click)="openNotification(n)">
                <span class="bell-ico"><i class="pi {{ service.icon(n) }}" aria-hidden="true"></i></span>
                <span class="bell-body">
                  <strong>{{ service.title(n) }}</strong>
                  <span class="bell-msg">{{ service.message(n) }}</span>
                  <small>{{ service.timeAgo(n.created_at) }}</small>
                </span>
                @if (!n.is_read) { <span class="bell-dot" aria-hidden="true"></span> }
              </button>
            } @empty {
              <p class="bell-empty">Nessuna notifica.</p>
            }
          </div>
          <a class="bell-pop-foot" routerLink="/notifiche" (click)="close()">Vedi tutte →</a>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: contents; }
    .bell { position: relative; display: grid; }
    .bell-trigger { position: relative; display: grid; width: 40px; height: 40px; place-items: center; color: var(--color-ink-muted); border: 0; border-radius: 12px; background: var(--color-surface-muted); cursor: pointer; }
    .bell-trigger:hover { color: var(--color-brand-strong); }
    .bell-badge { position: absolute; top: 3px; right: 3px; min-width: 18px; height: 18px; padding: 0 4px; display: grid; place-items: center; color: white; background: var(--color-brand); border-radius: 999px; box-shadow: 0 0 0 2px var(--color-surface-muted); font-size: .6rem; font-weight: 850; font-variant-numeric: tabular-nums; }
    .bell-pop { position: absolute; z-index: var(--z-sticky, 50); top: calc(100% + 8px); right: 0; width: 340px; max-width: calc(100vw - 24px); border: 1px solid var(--color-border); border-radius: 18px; background: var(--color-surface); box-shadow: 0 18px 40px rgb(20 24 26 / .16); overflow: hidden; }
    .bell-pop-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--color-border); }
    .bell-pop-head strong { font-size: .85rem; }
    .link-btn { padding: 0; color: var(--color-brand-strong); border: 0; background: none; font: inherit; font-size: .72rem; font-weight: 750; cursor: pointer; }
    .bell-pop-list { max-height: 360px; overflow-y: auto; }
    .bell-row { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; width: 100%; padding: 11px 14px; text-align: left; border: 0; border-top: 1px solid var(--color-border); background: none; cursor: pointer; }
    .bell-row:first-child { border-top: 0; }
    .bell-row:hover { background: var(--color-surface-muted); }
    .bell-row.is-unread { background: color-mix(in srgb, var(--color-brand) 8%, transparent); }
    .bell-row.is-unread:hover { background: color-mix(in srgb, var(--color-brand) 14%, transparent); }
    .bell-ico { display: grid; width: 34px; height: 34px; place-items: center; color: var(--color-brand-strong); border-radius: 10px; background: var(--color-brand-soft); font-size: .85rem; }
    .bell-body { display: grid; gap: 2px; min-width: 0; }
    .bell-body strong { font-size: .78rem; }
    .bell-msg { color: var(--color-ink-muted); font-size: .74rem; line-height: 1.35; }
    .bell-body small { color: var(--color-ink-muted); font-size: .66rem; }
    .bell-dot { align-self: center; width: 8px; height: 8px; border-radius: 50%; background: var(--color-brand); }
    .bell-empty { margin: 0; padding: 24px 14px; color: var(--color-ink-muted); text-align: center; font-size: .78rem; }
    .bell-pop-foot { display: block; padding: 11px 14px; color: var(--color-brand-strong); border-top: 1px solid var(--color-border); text-align: center; font-size: .76rem; font-weight: 750; text-decoration: none; }
    .bell-trigger:focus-visible, .link-btn:focus-visible, .bell-row:focus-visible, .bell-pop-foot:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 2px; }
  `,
})
export class NotificationBell {
  private readonly authStore = inject(AuthStore);
  protected readonly service = inject(NotificationsService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly open = signal(false);
  protected readonly unreadCount = this.service.unreadCount;
  protected readonly badgeLabel = computed(() => (this.unreadCount() > 99 ? '99+' : String(this.unreadCount())));
  protected readonly recent = computed<AppNotification[]>(() => this.service.notifications().slice(0, DROPDOWN_LIMIT));

  constructor() {
    effect(() => {
      const userId = this.authStore.isAuthenticated() ? this.authStore.authUser()?.id : null;
      if (userId) void this.service.connect(userId);
      else void this.service.disconnect();
    });
  }

  protected toggle(): void { this.open.update((v) => !v); }
  protected close(): void { this.open.set(false); }

  protected async openNotification(n: AppNotification): Promise<void> {
    this.close();
    await this.service.markRead(n.id);
    void this.router.navigate(this.service.link(n));
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }
}
