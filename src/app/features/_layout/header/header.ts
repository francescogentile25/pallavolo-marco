import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../../auth/store/auth.store';
import { NotificationBell } from '../../notifications/components/notification-bell';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, NotificationBell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="app-header">
      <a class="brand" routerLink="/" aria-label="Beach Volley Hub, home">
        <span class="brand-mark" aria-hidden="true"><i class="pi pi-sun"></i></span>
        <strong>Beach Volley <span>Hub</span></strong>
      </a>

      <nav aria-label="Navigazione desktop">
        <a routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }"><i class="pi pi-home"></i> Home</a>
        <a routerLink="/partite" routerLinkActive="is-active"><i class="pi pi-users"></i> Partite</a>
        <a routerLink="/tornei" routerLinkActive="is-active"><i class="pi pi-trophy"></i> Tornei</a>
        <a routerLink="/profilo" routerLinkActive="is-active"><i class="pi pi-user"></i> Profilo</a>
      </nav>

      <div class="account-actions">
        <span class="user-name">{{ authStore.userName() }} <small>{{ authStore.roleLabel() }}</small></span>
        @if (authStore.canOrganizeTournaments()) {
          <a class="icon-action" routerLink="/tornei/organizza" aria-label="Organizza torneo" title="Organizza torneo"><i class="pi pi-trophy" aria-hidden="true"></i></a>
        }
        @if (authStore.isAdmin()) {
          <a class="icon-action" routerLink="/admin/utenti" aria-label="Gestione utenti" title="Gestione utenti"><i class="pi pi-users" aria-hidden="true"></i></a>
        }
        <app-notification-bell />
        <button class="icon-action logout" type="button" aria-label="Esci" (click)="logout()"><i class="pi pi-sign-out" aria-hidden="true"></i></button>
        <a class="user-avatar" routerLink="/profilo" aria-label="Apri il tuo profilo">{{ userInitials() }}</a>
      </div>
    </header>
  `,
  styles: `
    :host { display: block; }
    .app-header { position: sticky; z-index: var(--z-sticky); top: 0; display: flex; height: var(--header-height); align-items: center; justify-content: space-between; padding: max(8px, env(safe-area-inset-top)) 16px 8px; color: var(--color-ink); border-bottom: 1px solid var(--color-border); background: rgb(255 255 255 / .92); box-shadow: 0 5px 20px rgb(20 24 26 / .035); backdrop-filter: blur(18px); }
    .brand { display: inline-flex; align-items: center; gap: 10px; color: var(--color-ink); text-decoration: none; }
    .brand strong { font: 800 .93rem/1 var(--display-font); letter-spacing: -.025em; white-space: nowrap; }
    .brand strong span { color: var(--color-brand); }
    .brand-mark { display: grid; width: 36px; height: 36px; place-items: center; color: white; border-radius: 11px; background: var(--color-ocean); box-shadow: 0 7px 16px rgb(20 24 26 / .16); }
    nav { display: none; align-items: center; gap: 24px; }
    nav a { display: inline-flex; align-items: center; gap: 7px; padding: 9px 0; color: var(--color-ink-muted); border-bottom: 2px solid transparent; font-size: .81rem; font-weight: 750; text-decoration: none; }
    nav a i { font-size: .76rem; }
    nav a:hover, nav a.is-active { color: var(--color-ink); }
    nav a.is-active { border-bottom-color: var(--color-brand); }
    .account-actions { display: flex; align-items: center; gap: 7px; }
    .user-name { display: none; color: var(--color-ink); font-size: .74rem; font-weight: 800; }
    .user-name small { display: block; color: var(--color-ink-muted); font-size: .62rem; font-weight: 650; text-align: right; }
    .icon-action { position: relative; display: none; width: 40px; height: 40px; place-items: center; color: var(--color-ink-muted); border: 0; border-radius: 12px; background: var(--color-surface-muted); font: inherit; text-decoration: none; cursor: pointer; }
    .icon-action.notifications, .icon-action.logout { display: grid; }
    .icon-action:hover { color: var(--color-brand-strong); transform: translateY(-1px); }
    .notifications span { position: absolute; top: 8px; right: 8px; width: 7px; height: 7px; border: 2px solid var(--color-surface-muted); border-radius: 50%; background: var(--color-brand); }
    .user-avatar { display: grid; width: 38px; height: 38px; place-items: center; color: white; border-radius: 11px; background: var(--color-brand); font-size: .68rem; font-weight: 850; text-decoration: none; }
    a:focus-visible, button:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }
    @media (max-width: 420px) { .brand strong { max-width: 74px; white-space: normal; } .icon-action.logout { display: none; } }
    @media (min-width: 768px) { .app-header { padding-inline: clamp(24px, 4vw, 52px); } nav { display: flex; } .user-name { display: inline; } .icon-action { display: grid; } }
  `,
})
export class Header {
  protected readonly authStore = inject(AuthStore);

  protected logout(): void { void this.authStore.logout(); }

  protected userInitials(): string {
    return this.authStore.userName().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'BV';
  }
}
