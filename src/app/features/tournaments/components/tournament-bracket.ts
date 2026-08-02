import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Tournament, TournamentGame } from '../models/tournament.model';
import { teamLabel } from '../tournaments.utils';

@Component({
  selector: 'app-tournament-bracket',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rounds().length) {
      <div class="mobile-nav" aria-label="Navigazione turni"><p-button icon="pi pi-chevron-left" [text]="true" ariaLabel="Turno precedente" [disabled]="activeRound() === 0" (onClick)="activeRound.set(activeRound() - 1)"/><strong>{{ roundTitle(activeRound()) }}</strong><p-button icon="pi pi-chevron-right" [text]="true" ariaLabel="Turno successivo" [disabled]="activeRound() === rounds().length - 1" (onClick)="activeRound.set(activeRound() + 1)"/></div>
      <div class="bracket" aria-label="Tabellone a eliminazione diretta">
        @for (round of rounds(); track $index; let roundIndex = $index) {
          <section [class.active]="activeRound() === roundIndex" [attr.aria-label]="roundTitle(roundIndex)">
            <h3>{{ roundTitle(roundIndex) }}</h3>
            <div class="games">
              @for (game of round; track game.id) {
                <article [class.completed]="game.status === 'completed'">
                  <div [class.winner]="game.winner_team_id === game.team1_id"><span>{{ label(game.team1_id) }}</span><strong>{{ score(game, 1) }}</strong></div>
                  <div [class.winner]="game.winner_team_id === game.team2_id"><span>{{ label(game.team2_id) }}</span><strong>{{ score(game, 2) }}</strong></div>
                </article>
              }
            </div>
          </section>
        }
      </div>
    } @else { <div class="empty"><i class="pi pi-sitemap" aria-hidden="true"></i><p>Il tabellone sarà disponibile dopo la chiusura delle iscrizioni.</p></div> }
  `,
  styles: `
    :host { display:block; }.mobile-nav { display:grid; grid-template-columns:44px 1fr 44px; align-items:center; gap:8px; margin-bottom:12px; text-align:center; }.mobile-nav strong { font-size:.78rem; }
    .bracket { overflow:hidden; }.bracket section { display:none; }.bracket section.active { display:block; }h3 { margin:0 0 10px; color:var(--color-brand-strong); font-size:.7rem; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }.games { display:grid; gap:12px; }
    article { overflow:hidden; border:1px solid var(--color-border); border-radius:14px; background:white; }article > div { display:grid; min-height:44px; grid-template-columns:1fr auto; align-items:center; gap:10px; padding:8px 12px; font-size:.72rem; }article > div + div { border-top:1px solid var(--color-border); }article .winner { color:var(--color-success); background:var(--color-success-soft); font-weight:850; }article strong { font-size:.9rem; }.empty { display:grid; min-height:190px; place-content:center; justify-items:center; color:var(--color-ink-muted); text-align:center; }.empty i { color:var(--color-brand); font-size:1.6rem; }
    @media (min-width:760px) { .mobile-nav { display:none; }.bracket { display:flex; align-items:stretch; gap:28px; overflow-x:auto; padding:4px 2px 16px; }.bracket section,.bracket section.active { display:grid; min-width:240px; flex:1; grid-template-rows:auto 1fr; }.games { align-content:space-around; }.bracket section:not(:last-child) article { position:relative; }.bracket section:not(:last-child) article::after { position:absolute; top:50%; left:100%; width:29px; height:1px; background:var(--color-border); content:''; } }
  `,
})
export class TournamentBracket {
  tournament = input.required<Tournament>();
  protected readonly activeRound = signal(0);
  protected readonly rounds = computed(() => {
    const games = (this.tournament().games ?? []).filter(game => game.phase === 'knockout');
    const max = Math.max(0, ...games.map(game => game.round_no));
    return Array.from({ length: max }, (_, index) => games.filter(game => game.round_no === index + 1).sort((a, b) => a.position - b.position));
  });
  protected label(teamId: string | null): string { return teamLabel(this.tournament().teams.find(team => team.id === teamId)); }
  protected score(game: TournamentGame, side: 1 | 2): string { const scores = side === 1 ? game.team1_scores : game.team2_scores; return scores?.join(' · ') ?? '–'; }
  protected roundTitle(index: number): string { const remaining = this.rounds().length - index; return remaining === 1 ? 'Finale' : remaining === 2 ? 'Semifinali' : remaining === 3 ? 'Quarti di finale' : `Turno ${index + 1}`; }
}
