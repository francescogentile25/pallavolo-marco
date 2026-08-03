import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FriendProfileDetails } from '../models/friend.model';
import { FriendsService } from '../services/friends.service';

const SIDE_LABELS: Record<string, string> = { sinistra: 'Sinistra', destra: 'Destra', indifferente: 'Indifferente' };

@Component({
  selector: 'app-friend-profile-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="fp-page">
      <a class="back" routerLink="/amici"><i class="pi pi-arrow-left" aria-hidden="true"></i> Amici</a>
      @if (loading()) {
        <div class="state" role="status"><span class="spinner"></span> Caricamento</div>
      } @else if (profile(); as p) {
        <header class="fp-hero">
          <span class="fp-avatar" aria-hidden="true">
            @if (p.avatar_url) { <img [src]="p.avatar_url" [alt]="p.nome + ' ' + p.cognome" /> } @else { {{ initials(p) }} }
          </span>
          <div>
            <p class="eyebrow">Profilo giocatore</p>
            <h1>{{ p.nome }} {{ p.cognome }}</h1>
          </div>
        </header>
        <section class="fp-metrics">
          <article><span>Livello</span><strong>{{ p.livello.toFixed(1) }}</strong></article>
          <article><span>Affidabilità</span><strong>{{ p.affidabilita.toFixed(1) }}</strong></article>
          <article><span>Lato preferito</span><strong>{{ sideLabel(p.lato_preferito) }}</strong></article>
        </section>
      } @else {
        <div class="state empty">
          <i class="pi pi-lock" aria-hidden="true"></i>
          <h3>Profilo non disponibile</h3>
          <p>Puoi vedere il profilo solo dei tuoi amici.</p>
        </div>
      }
    </main>
  `,
  styles: `
    :host { display: block; }
    .fp-page { width: min(100%, 640px); padding: 18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 48px); margin: 0 auto; }
    .back { display: inline-flex; min-height: 44px; align-items: center; gap: 8px; color: var(--color-brand-strong); font-size: .78rem; font-weight: 850; text-decoration: none; }
    .fp-hero { display: flex; align-items: center; gap: 16px; padding: 22px; color: white; border-radius: 26px; background: radial-gradient(circle at 88% 0, rgb(25 199 181 / .5), transparent 45%), linear-gradient(145deg, #071d26, #123945); box-shadow: 0 18px 38px rgb(7 29 38 / .18); }
    .fp-avatar { display: grid; width: 72px; height: 72px; place-items: center; overflow: hidden; border: 3px solid rgb(255 255 255 / .7); border-radius: 22px; background: var(--color-tournament); font-size: 1.4rem; font-weight: 900; }
    .fp-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .eyebrow { margin: 0 0 6px; color: #84efe3; font-size: .68rem; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
    .fp-hero h1 { margin: 0; font: 900 clamp(1.6rem, 6vw, 2.4rem)/1.02 var(--display-font); letter-spacing: -.03em; overflow-wrap: anywhere; }
    .fp-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
    .fp-metrics article { padding: 16px 12px; border: 1px solid var(--color-border); border-radius: 18px; background: var(--color-surface); text-align: center; }
    .fp-metrics span { display: block; color: var(--color-ink-muted); font-size: .66rem; font-weight: 700; }
    .fp-metrics strong { display: block; margin-top: 4px; font-size: 1.4rem; }
    .state { display: grid; min-height: 220px; place-content: center; justify-items: center; gap: 10px; color: var(--color-ink-muted); text-align: center; }
    .state.empty { border: 1px dashed var(--color-border); border-radius: 20px; }
    .state.empty i { font-size: 2rem; }
    .state.empty h3, .state.empty p { margin: 0; }
    .spinner { width: 18px; height: 18px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `,
})
export class FriendProfilePage implements OnInit {
  private readonly service = inject(FriendsService);
  private readonly route = inject(ActivatedRoute);
  protected readonly profile = signal<FriendProfileDetails | null>(null);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    void this.load(id);
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    try { this.profile.set(await this.service.getProfile(id)); } catch { this.profile.set(null); }
    this.loading.set(false);
  }

  protected initials(p: FriendProfileDetails): string { return `${p.nome?.[0] ?? ''}${p.cognome?.[0] ?? ''}`.toUpperCase(); }
  protected sideLabel(side: string): string { return SIDE_LABELS[side] ?? side; }
}
