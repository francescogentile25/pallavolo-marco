import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../auth/store/auth.store';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="app-header">
      <a class="brand" routerLink="/" aria-label="Beach Volley Hub, home">
        <span class="brand-ball" aria-hidden="true">
          <span></span>
        </span>
        <span>
          <strong>Beach Volley</strong>
          <small>Hub</small>
        </span>
      </a>

      <nav aria-label="Navigazione desktop">
        <a routerLink="/partite">Partite</a>
        <a routerLink="/tornei">Tornei</a>
        <a routerLink="/profilo">Profilo</a>
      </nav>

      <div class="account-actions">
        <span class="user-name">{{ authStore.userName() }}</span>
        @if (authStore.isAdmin()) {
          <a class="icon-action" routerLink="/admin/utenti" aria-label="Gestione utenti" title="Gestione utenti">
            <i class="pi pi-users" aria-hidden="true"></i>
          </a>
        }
        <a class="icon-action notifications" routerLink="/notifiche" aria-label="Notifiche">
          <i class="pi pi-bell" aria-hidden="true"></i>
          <span aria-hidden="true"></span>
        </a>
        <button class="icon-action logout" type="button" aria-label="Esci" (click)="logout()">
          <i class="pi pi-sign-out" aria-hidden="true"></i>
        </button>
      </div>
    </header>
  `,
  styles: `
    :host { display: block; }

    .app-header {
      position: sticky;
      z-index: var(--z-sticky);
      top: 0;
      display: flex;
      height: var(--header-height);
      align-items: center;
      justify-content: space-between;
      padding: max(8px, env(safe-area-inset-top)) 18px 8px;
      color: white;
      background: var(--color-ocean);
    }

    .brand { display: inline-flex; align-items: center; gap: 10px; color: white; text-decoration: none; }
    .brand > span:last-child { display: flex; flex-direction: column; line-height: 0.92; text-transform: uppercase; }
    .brand strong { font-family: var(--display-font); font-size: 0.86rem; letter-spacing: 0.02em; }
    .brand small { color: var(--color-brand); font-size: 0.69rem; font-weight: 900; letter-spacing: 0.18em; }

    .brand-ball {
      position: relative;
      display: block;
      width: 34px;
      height: 34px;
      overflow: hidden;
      border: 2px solid white;
      border-radius: 50%;
    }
    .brand-ball::before, .brand-ball::after, .brand-ball span {
      position: absolute;
      content: '';
      border: 1.5px solid white;
      border-radius: 50%;
    }
    .brand-ball::before { inset: 6px -15px 6px 13px; }
    .brand-ball::after { inset: -14px 6px 13px 6px; }
    .brand-ball span { inset: 15px 12px -18px -10px; }

    nav { display: none; align-items: center; gap: 26px; }
    nav a { color: rgb(255 255 255 / 0.78); font-weight: 750; text-decoration: none; }
    nav a:hover { color: white; }

    .account-actions { display: flex; align-items: center; gap: 8px; }
    .user-name { display: none; color: rgb(255 255 255 / 0.72); font-size: 0.78rem; font-weight: 750; }
    .icon-action {
      position: relative;
      display: grid;
      width: 42px;
      height: 42px;
      place-items: center;
      color: white;
      border: 0;
      border-radius: 50%;
      background: rgb(255 255 255 / 0.08);
      font: inherit;
      text-decoration: none;
      cursor: pointer;
    }
    .notifications span { position: absolute; top: 9px; right: 9px; width: 7px; height: 7px; border: 2px solid var(--color-ocean); border-radius: 50%; background: var(--color-tournament); }
    a:focus-visible, button:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }

    @media (min-width: 768px) {
      .app-header { padding-inline: 32px; }
      nav { display: flex; }
      .user-name { display: inline; }
    }
  `,
})
export class Header {
  protected readonly authStore = inject(AuthStore);

  protected logout(): void {
    void this.authStore.logout();
  }
}
