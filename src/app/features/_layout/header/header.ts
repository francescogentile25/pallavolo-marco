import { afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { loadMotion } from '../../../shared/motion/gsap-loader';
import { motionAllowed } from '../../../shared/motion/reveal.directive';
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
        <img src="assets/img/logo-banner.svg" alt="Beach Volley Hub" />
      </a>

      <nav aria-label="Navigazione desktop" #navEl>
        <span class="nav-marker" aria-hidden="true"></span>
        <a routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }"><i class="pi pi-home"></i> Home</a>
        <a routerLink="/partite" routerLinkActive="is-active"><i class="pi pi-users"></i> Partite</a>
        <a routerLink="/tornei" routerLinkActive="is-active"><i class="pi pi-trophy"></i> Tornei</a>
        <a routerLink="/campi" routerLinkActive="is-active"><i class="pi pi-map-marker"></i> Campi</a>
        <a routerLink="/amici" routerLinkActive="is-active"><i class="pi pi-user-plus"></i> Amici</a>
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
        <a class="user-avatar" routerLink="/profilo" aria-label="Apri il tuo profilo">
          @if (avatarUrl(); as url) {
            <img [src]="url" alt="" (error)="avatarBroken.set(true)" />
          } @else { {{ userInitials() }} }
        </a>
      </div>
    </header>
  `,
  styles: `
    :host { display: block; }
    .app-header { position: sticky; z-index: var(--z-sticky); top: 0; display: flex; height: var(--header-height); align-items: center; justify-content: space-between; flex-wrap: nowrap; gap: 12px; padding: max(8px, env(safe-area-inset-top)) 16px 8px; color: var(--color-ink); border-bottom: 1px solid var(--color-border); background: rgb(255 255 255 / .92); box-shadow: 0 5px 20px rgb(20 24 26 / .035); backdrop-filter: blur(18px); }
    .brand { display: inline-flex; min-width: 0; flex: 0 1 auto; align-items: center; text-decoration: none; }
    .brand img { height: 54px; width: auto; max-width: 100%; display: block; }
    @media (max-width: 1179px) { .brand img { height: 46px; } }
    @media (max-width: 420px) { .brand img { height: 42px; } }
    .brand strong { font: 800 .93rem/1 var(--display-font); letter-spacing: -.025em; white-space: nowrap; }
    .brand strong span { color: var(--color-brand); }
    .brand-mark { display: grid; width: 36px; height: 36px; place-items: center; color: white; border-radius: var(--radius); background: var(--color-ocean); box-shadow: 0 7px 16px rgb(20 24 26 / .16); }
    nav { position: relative; display: none; min-width: 0; align-items: center; gap: 24px; }
    .nav-marker { position: absolute; bottom: 0; left: 0; height: 2px; width: 0; background: var(--color-brand); opacity: 0; pointer-events: none; }
    nav a { display: inline-flex; align-items: center; gap: 7px; padding: 9px 0; color: var(--color-ink-muted); border-bottom: 2px solid transparent; font-size: .81rem; font-weight: 750; text-decoration: none; }
    nav a i { font-size: .76rem; }
    nav a:hover, nav a.is-active { color: var(--color-ink); }
    nav a.is-active { border-bottom-color: transparent; }
    .brand img { transition: transform var(--duration-fast) var(--ease-out); }
    /* Col dito il :hover resta attaccato dopo il tocco e il logo rimaneva
       storto: l'inclinazione vale solo dove c'e un puntatore vero. */
    @media (hover: hover) and (pointer: fine) { .brand:hover img { transform: rotate(-2deg) scale(1.03); } }
    .account-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 7px; }
    .user-name { display: none; max-width: 15ch; overflow: hidden; color: var(--color-ink); font-size: .74rem; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
    .user-name small { display: block; color: var(--color-ink-muted); font-size: .62rem; font-weight: 650; text-align: right; }
    .icon-action { position: relative; display: none; width: 40px; height: 40px; place-items: center; color: var(--color-ink-muted); border: 0; border-radius: var(--radius); background: var(--color-surface-muted); font: inherit; text-decoration: none; cursor: pointer; }
    .icon-action.notifications, .icon-action.logout { display: grid; }
    .icon-action:hover { color: var(--color-brand-strong); transform: translateY(-1px); }
    .notifications span { position: absolute; top: 8px; right: 8px; width: 7px; height: 7px; border: 2px solid var(--color-surface-muted); border-radius: 50%; background: var(--color-brand); }
    .user-avatar { display: grid; width: 38px; height: 38px; flex: 0 0 38px; place-items: center; overflow: hidden; color: white; border-radius: var(--radius); background: var(--color-brand); font-size: .68rem; font-weight: 850; text-decoration: none; }
    .user-avatar img { width: 100%; height: 100%; object-fit: cover; }
    a:focus-visible, button:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }
    @media (max-width: 420px) { .brand strong { max-width: 74px; white-space: normal; } .icon-action.logout { display: none; } }
    /* Fra 768 e 1023 la barra non conteneva logo, sei voci, nome utente e azioni:
       fino a 1024 resta il dock in basso, come su telefono. */
    @media (min-width: 768px) { .app-header { padding-inline: clamp(20px, 3vw, 52px); } }
    @media (min-width: 1024px) { nav { display: flex; gap: 16px; } .icon-action { display: grid; } }
    @media (min-width: 1180px) { nav { gap: 24px; } .user-name { display: inline; } }
  `,
})
export class Header {
  protected readonly authStore = inject(AuthStore);
  protected readonly avatarBroken = signal(false);
  /** Segue lo snapshot del profilo: cambiando la foto la navbar si aggiorna da sola. */
  protected readonly avatarUrl = computed(() => (this.avatarBroken() ? null : this.authStore.profile()?.avatar_url ?? null));
  private readonly navEl = viewChild<ElementRef<HTMLElement>>('navEl');

  constructor() {
    afterNextRender(() => void this.trackNav());
  }

  /**
   * Un trattino scorre sotto la voce puntata e torna sull'attiva quando esci dal
   * menu: da qui si legge dove stai andando prima ancora di cliccare.
   */
  private async trackNav(): Promise<void> {
    const nav = this.navEl()?.nativeElement;
    if (!nav || !motionAllowed()) return;
    const marker = nav.querySelector<HTMLElement>('.nav-marker');
    if (!marker) return;

    const { gsap } = await loadMotion();

    const moveTo = (link: HTMLElement | null, immediate = false) => {
      if (!link) { gsap.to(marker, { opacity: 0, duration: 0.18 }); return; }
      gsap.to(marker, {
        x: link.offsetLeft,
        width: link.offsetWidth,
        opacity: 1,
        duration: immediate ? 0 : 0.32,
        ease: 'power3.out',
      });
    };
    const active = () => nav.querySelector<HTMLElement>('a.is-active');

    nav.querySelectorAll<HTMLElement>('a').forEach((link) => {
      link.addEventListener('pointerenter', () => moveTo(link));
      link.addEventListener('focus', () => moveTo(link));
    });
    nav.addEventListener('pointerleave', () => moveTo(active()));
    moveTo(active(), true);
  }

  protected logout(): void { void this.authStore.logout(); }

  protected userInitials(): string {
    return this.authStore.userName().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'BV';
  }
}
