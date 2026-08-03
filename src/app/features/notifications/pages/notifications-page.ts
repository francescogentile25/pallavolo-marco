import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { PageActionsService } from '../../../core/services/page-actions.service';
import { AppNotification } from '../models/notification.model';
import { NotificationsService } from '../services/notifications.service';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-notifications-page',
  imports: [Paginator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="notif-page">
      <header class="notif-hero">
        <p class="eyebrow">Aggiornamenti</p>
        <h1>Notifiche</h1>
        <p>Inviti, cambi partita e risultati dei tornei a cui partecipi.</p>
      </header>

      @if (loading()) {
        <div class="state" role="status"><span class="spinner"></span> Caricamento notifiche</div>
      } @else {
        <section class="notif-list" aria-label="Elenco notifiche">
          @for (n of items(); track n.id) {
            <div class="notif-row" [class.is-unread]="!n.is_read">
              <button type="button" class="notif-main" (click)="openNotification(n)">
                <span class="notif-ico"><i class="pi {{ service.icon(n) }}" aria-hidden="true"></i></span>
                <span class="notif-body">
                  <strong>{{ service.title(n) }}</strong>
                  <span class="notif-msg">{{ service.message(n) }}</span>
                  <small>{{ service.timeAgo(n.created_at) }}</small>
                </span>
              </button>
              @if (!n.is_read) {
                <button type="button" class="notif-check" aria-label="Segna come letta" (click)="markRead(n)">
                  <i class="pi pi-check" aria-hidden="true"></i>
                </button>
              }
            </div>
          } @empty {
            <div class="state empty">
              <i class="pi pi-bell" aria-hidden="true"></i>
              <h3>Nessuna notifica</h3>
              <p>Gli aggiornamenti su partite e tornei compariranno qui.</p>
            </div>
          }
        </section>

        @if (total() > rows()) {
          <p-paginator
            styleClass="notif-paginator"
            [first]="first()"
            [rows]="rows()"
            [totalRecords]="total()"
            [showCurrentPageReport]="true"
            currentPageReportTemplate="{first}-{last} di {totalRecords}"
            (onPageChange)="onPage($event)"
          />
        }
      }
    </main>
  `,
  styles: `
    :host { display: block; }
    .notif-page { width: min(100%, 760px); padding: 18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 48px); margin: 0 auto; }
    .notif-hero { padding: 22px 4px 18px; }
    .eyebrow { margin: 0 0 8px; color: var(--color-brand-strong); font-size: .72rem; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
    h1 { margin: 0 0 8px; font: 900 clamp(2rem, 9vw, 3.4rem)/.95 var(--display-font); letter-spacing: -.045em; }
    .notif-hero > p:last-child { max-width: 40rem; margin: 0; color: var(--color-ink-muted); line-height: 1.5; }
    .notif-list { display: grid; gap: 8px; }
    .notif-row { display: grid; grid-template-columns: 1fr auto; align-items: center; border: 1px solid var(--color-border); border-radius: 16px; background: var(--color-surface); }
    .notif-row.is-unread { border-color: color-mix(in srgb, var(--color-brand) 40%, var(--color-border)); background: color-mix(in srgb, var(--color-brand) 6%, var(--color-surface)); }
    .notif-main { display: grid; grid-template-columns: auto 1fr; gap: 12px; padding: 14px; text-align: left; border: 0; background: none; cursor: pointer; }
    .notif-ico { display: grid; width: 42px; height: 42px; place-items: center; color: var(--color-brand-strong); border-radius: 12px; background: var(--color-brand-soft); font-size: .95rem; }
    .notif-body { display: grid; gap: 3px; min-width: 0; }
    .notif-body strong { font-size: .84rem; }
    .notif-msg { color: var(--color-ink-muted); font-size: .78rem; line-height: 1.4; }
    .notif-body small { color: var(--color-ink-muted); font-size: .68rem; }
    .notif-check { display: grid; width: 40px; height: 40px; margin-right: 10px; place-items: center; color: var(--color-brand-strong); border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); cursor: pointer; }
    .notif-check:hover { background: var(--color-surface-muted); }
    .state { display: grid; min-height: 240px; place-content: center; justify-items: center; gap: 10px; color: var(--color-ink-muted); text-align: center; }
    .state.empty { border: 1px dashed var(--color-border); border-radius: 20px; }
    .state.empty i { font-size: 2rem; }
    .state.empty h3, .state.empty p { margin: 0; }
    .spinner { width: 18px; height: 18px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }
    :host ::ng-deep .notif-paginator, :host ::ng-deep .notif-paginator .p-paginator { display: flex; justify-content: center; flex-wrap: wrap; gap: 2px; margin-top: 14px; padding: 4px; background: transparent; border: 0; }
    button:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 2px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
  `,
})
export class NotificationsPage implements OnInit, OnDestroy {
  protected readonly service = inject(NotificationsService);
  private readonly pageActions = inject(PageActionsService);
  private readonly router = inject(Router);

  protected readonly items = signal<AppNotification[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly first = signal(0);
  protected readonly rows = signal(PAGE_SIZE);
  private readonly page = computed(() => Math.floor(this.first() / this.rows()) + 1);

  ngOnInit(): void {
    this.pageActions.set([
      { id: 'mark-all', label: 'Segna tutte come lette', shortLabel: 'Tutte lette', icon: 'pi-check', primary: true, click: () => void this.markAll() },
      { id: 'refresh-notif', label: 'Aggiorna', icon: 'pi-refresh', iconOnly: true, click: () => void this.load() },
    ]);
    void this.load();
  }

  ngOnDestroy(): void { this.pageActions.clear(); }

  private async load(): Promise<void> {
    this.loading.set(true);
    const { items, total } = await this.service.fetchPage(this.page(), this.rows());
    this.items.set(items);
    this.total.set(total);
    this.loading.set(false);
  }

  protected onPage(event: PaginatorState): void {
    this.first.set(event.first ?? 0);
    this.rows.set(event.rows ?? PAGE_SIZE);
    void this.load();
  }

  protected async markRead(n: AppNotification): Promise<void> {
    await this.service.markRead(n.id);
    this.items.update((list) => list.map((item) => (item.id === n.id ? { ...item, is_read: true } : item)));
  }

  protected async markAll(): Promise<void> {
    await this.service.markAllRead();
    this.items.update((list) => list.map((item) => ({ ...item, is_read: true })));
  }

  protected async openNotification(n: AppNotification): Promise<void> {
    await this.markRead(n);
    void this.router.navigate(this.service.link(n));
  }
}
