import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PlayerAchievementChart } from '../components/player-achievement-chart';
import { FriendProfileDetails } from '../models/friend.model';
import { FriendsService } from '../services/friends.service';

const SIDE_LABELS: Record<string, string> = { sinistra: 'Sinistra', destra: 'Destra', indifferente: 'Indifferente' };

@Component({
  selector: 'app-friend-profile-page',
  imports: [RouterLink, PlayerAchievementChart],
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
        <section class="fp-metrics" aria-label="Informazioni giocatore">
          <article><span>Livello</span><strong>{{ p.livello.toFixed(1) }}</strong></article>
          <article><span>Affidabilità</span><strong>{{ p.affidabilita.toFixed(1) }}</strong></article>
          <article><span>Lato preferito</span><strong>{{ sideLabel(p.lato_preferito) }}</strong></article>
        </section>

        <section class="performance" aria-labelledby="performance-title">
          <div class="section-head"><div><p class="eyebrow">In campo</p><h2 id="performance-title">Rendimento</h2></div><span class="performance-rate"><strong>{{ winRate(p) }}%</strong><small>vittorie torneo</small></span></div>
          <div class="achievement-grid">
            <article><i class="pi pi-calendar" aria-hidden="true"></i><span>Partite giocate</span><strong>{{ p.matches_played }}</strong></article>
            <article><i class="pi pi-sitemap" aria-hidden="true"></i><span>Tornei disputati</span><strong>{{ p.tournaments_played }}</strong></article>
            <article><i class="pi pi-trophy" aria-hidden="true"></i><span>Tornei vinti</span><strong>{{ p.tournaments_won }}</strong></article>
            <article><i class="pi pi-flag" aria-hidden="true"></i><span>Incontri vinti</span><strong>{{ p.tournament_games_won }}<small>/{{ p.tournament_games_played }}</small></strong></article>
          </div>
          <div class="records">
            <article><span class="record-icon"><i class="pi pi-bolt" aria-hidden="true"></i></span><div><small>Record personale</small><strong>{{ p.best_set_score }} punti</strong><p>Miglior punteggio in un set di torneo.</p></div></article>
            <article><span class="record-icon ocean"><i class="pi pi-chart-line" aria-hidden="true"></i></span><div><small>Percentuale vittorie</small><strong>{{ winRate(p) }}%</strong><p>{{ p.tournament_games_won }} vittorie su {{ p.tournament_games_played }} incontri conclusi.</p></div></article>
          </div>
        </section>

        <section class="fp-podium" aria-labelledby="podium-title">
          <div class="section-head"><div><p class="eyebrow">Tornei</p><h2 id="podium-title">Albo d'oro</h2></div></div>
          @if (totalPodiums(p) > 0) {
            <div class="podiums">
              @for (place of podiumPlaces(p); track place.label) {
                <article [class]="'podium place-' + place.position">
                  <span class="podium-icon"><i class="pi pi-trophy" aria-hidden="true"></i></span>
                  <strong>{{ place.count }}</strong>
                  <p>{{ place.label }}</p>
                </article>
              }
            </div>
          } @else {
            <p class="podium-empty">Nessun podio nei tornei conclusi.</p>
          }
        </section>

        <app-player-achievement-chart [profile]="p" />
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
    .fp-page { display: grid; width: min(100%, 840px); padding: 18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 48px); margin: 0 auto; gap: 14px; }
    .back { display: inline-flex; min-height: 44px; align-items: center; gap: 8px; color: var(--color-brand-strong); font-size: .78rem; font-weight: 850; text-decoration: none; }
    .fp-hero { display: flex; align-items: center; gap: 16px; padding: 22px; color: white; border-radius: 8px; background: radial-gradient(circle at 88% 0, rgb(25 199 181 / .5), transparent 45%), linear-gradient(145deg, #0f1b23, #1d2b33); box-shadow: 0 18px 38px rgb(7 29 38 / .18); }
    .fp-avatar { display: grid; width: 72px; height: 72px; place-items: center; overflow: hidden; border: 3px solid rgb(255 255 255 / .7); border-radius: var(--radius-lg); background: var(--color-tournament); font-size: 1.4rem; font-weight: 900; }
    .fp-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .eyebrow { margin: 0 0 6px; color: #a3b3fb; font-size: .68rem; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
    .fp-hero h1 { margin: 0; font: 900 clamp(1.6rem, 6vw, 2.4rem)/1.02 var(--display-font); letter-spacing: -.03em; overflow-wrap: anywhere; }
    .fp-podium { padding: 18px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); }
    .podiums { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .podium { display: grid; justify-items: center; gap: 4px; padding: 14px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); text-align: center; }
    .podium-icon { display: grid; width: 38px; height: 38px; place-items: center; border-radius: var(--radius); }
    .podium strong { font-size: 1.6rem; line-height: 1; }
    .podium p { margin: 0; color: var(--color-ink-muted); font-size: .64rem; font-weight: 700; }
    .podium.place-1 { border-color: #ffc72c; background: #fffaf0; }
    .podium.place-1 .podium-icon { color: #8a6a12; background: #fff4d6; }
    .podium.place-2 .podium-icon { color: #5b6a72; background: #f4efe4; }
    .podium.place-3 { border-color: #ffd98a; background: #fffaf0; }
    .podium.place-3 .podium-icon { color: #8a6a12; background: #fff4d6; }
    .podium-empty { margin: 0; color: var(--color-ink-muted); font-size: .74rem; }
    .fp-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
    .fp-metrics article { padding: 16px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); text-align: center; }
    .fp-metrics span { display: block; color: var(--color-ink-muted); font-size: .66rem; font-weight: 700; }
    .fp-metrics strong { display: block; margin-top: 4px; font-size: 1.4rem; }
    .performance { padding: 20px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); }
    .section-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
    .section-head .eyebrow { color: var(--color-brand-strong); }
    .section-head h2 { margin: 0; font: 900 1.4rem/1 var(--display-font); }
    .performance-rate { display: grid; min-width: 76px; padding: 9px 12px; place-items: center; border-radius: var(--radius); color: var(--color-brand-strong); background: var(--color-brand-soft); }
    .performance-rate strong { font-size: 1.2rem; line-height: 1; }.performance-rate small { margin-top: 3px; font-size: .58rem; font-weight: 800; text-transform: uppercase; }
    .achievement-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .achievement-grid article { display: grid; gap: 5px; padding: 14px; border-radius: var(--radius-lg); background: var(--color-surface-muted); }
    .achievement-grid i { color: var(--color-brand-strong); font-size: 1rem; }.achievement-grid span { color: var(--color-ink-muted); font-size: .65rem; font-weight: 750; }.achievement-grid strong { font-size: 1.45rem; line-height: 1; }.achievement-grid strong small { color: var(--color-ink-muted); font-size: .75rem; }
    .records { display: grid; gap: 8px; margin-top: 12px; }
    .records article { display: flex; align-items: center; gap: 12px; padding: 13px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
    .record-icon { display: grid; width: 42px; height: 42px; flex: 0 0 42px; place-items: center; color: #a75c20; border-radius: var(--radius); background: #fff0df; }.record-icon.ocean { color: var(--color-brand-strong); background: var(--color-brand-soft); }
    .records small { display: block; color: var(--color-ink-muted); font-size: .65rem; font-weight: 750; }.records strong { display: block; margin: 2px 0; font-size: 1rem; }.records p { margin: 0; color: var(--color-ink-muted); font-size: .68rem; line-height: 1.4; }
    .state { display: grid; min-height: 220px; place-content: center; justify-items: center; gap: 10px; color: var(--color-ink-muted); text-align: center; }
    .state.empty { border: 1px dashed var(--color-border); border-radius: var(--radius-lg); }
    .state.empty i { font-size: 2rem; }
    .state.empty h3, .state.empty p { margin: 0; }
    .spinner { width: 18px; height: 18px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (min-width: 560px) { .fp-page { padding: 34px 28px 120px; gap: 16px; }.fp-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }.achievement-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }.records { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
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
  protected podiumPlaces(p: FriendProfileDetails) {
    return [
      { position: 1, label: 'Primi posti', count: p.tournaments_won },
      { position: 2, label: 'Secondi posti', count: p.tournaments_second },
      { position: 3, label: 'Terzi posti', count: p.tournaments_third },
    ];
  }
  protected totalPodiums(p: FriendProfileDetails): number {
    return p.tournaments_won + p.tournaments_second + p.tournaments_third;
  }
  protected sideLabel(side: string): string { return SIDE_LABELS[side] ?? side; }
  protected winRate(profile: FriendProfileDetails): number {
    return profile.tournament_games_played ? Math.round((profile.tournament_games_won / profile.tournament_games_played) * 100) : 0;
  }
}
