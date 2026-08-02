import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PageActionsService } from '../../core/services/page-actions.service';
import { AuthStore } from '../auth/store/auth.store';
import { TournamentsStore } from '../tournaments/store/tournaments.store';
import { Tournament } from '../tournaments/models/tournament.model';

@Component({
  selector: 'app-home',
  imports: [ButtonModule, DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="home-page">
      <div class="home-feature-grid">
      <section class="hero" aria-labelledby="home-title">
        <div>
          <p class="eyebrow">La tua prossima partita</p>
          <h1 id="home-title">Entra in campo.</h1>
          <p class="hero-copy">
            Trova giocatori al tuo livello, crea una partita o iscriviti al prossimo torneo.
          </p>
        </div>
        <div class="hero-actions">
          <a class="hero-cta" routerLink="/partite/nuova">
            <span class="ball-mark" aria-hidden="true"><i class="pi pi-plus"></i></span>
            <span><small>Organizza</small>Crea una partita</span>
            <i class="pi pi-arrow-right" aria-hidden="true"></i>
          </a>
          <a pButton class="my-matches-button" routerLink="/partite/mie">
            <i class="pi pi-calendar" pButtonIcon aria-hidden="true"></i>
            <span pButtonLabel>Le mie partite</span>
          </a>
        </div>
        <div class="hero-stamp" aria-hidden="true"><i class="pi pi-sun"></i><span>Beach<br />Volley</span></div>
      </section>

      <section class="section-block" aria-labelledby="matches-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Vicino a te</p>
            <h2 id="matches-title">Partite aperte</h2>
          </div>
          <a routerLink="/partite">Vedi tutte <i class="pi pi-arrow-right"></i></a>
        </div>

        <div class="match-scroller">
          @for (match of matches; track match.id) {
            <article class="match-card">
              <div class="match-topline">
                <span class="level">{{ match.level }}</span>
                <span class="spots">{{ match.spots }} posti</span>
              </div>
              <h3>{{ match.place }}</h3>
              <p><i class="pi pi-calendar" aria-hidden="true"></i> {{ match.when }}</p>
              <div class="players" aria-label="Giocatori iscritti">
                <span aria-hidden="true">FG</span>
                <span aria-hidden="true">MR</span>
                <strong>+{{ match.players }}</strong>
              </div>
            </article>
          }
        </div>
      </section>
      </div>

      <section class="tournament-card" aria-labelledby="tournament-title">
        <div class="tournament-number" aria-hidden="true">{{ nextTournament()?.starts_at | date:'dd' }}</div>
        <div>
          <p class="eyebrow">{{ nextTournament() ? 'Prossimo torneo' : 'Tornei' }}</p>
          <h2 id="tournament-title">{{ nextTournament()?.title ?? 'La prossima sfida' }}</h2>
          @if (nextTournament(); as tournament) {
            <p>{{ tournament.starts_at | date:'EEE d MMM, HH:mm':'':'it' }} · {{ tournament.venue.city }}</p>
          } @else {
            <p>Scopri i tornei e scegli come partecipare.</p>
          }
        </div>
        <a [routerLink]="nextTournament() ? ['/tornei', nextTournament()!.id] : '/tornei'">Scopri <i class="pi pi-arrow-up-right"></i></a>
      </section>
    </main>
  `,
  styles: `
    :host { display: block; }

    .home-page {
      width: min(100%, 1120px);
      padding: 18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 50px);
      margin: 0 auto;
    }

    .hero {
      position: relative;
      overflow: hidden;
      padding: 28px 22px 22px;
      color: white;
      border-radius: 28px;
      background: var(--color-ocean);
      box-shadow: 0 18px 38px rgb(20 24 26 / 0.18);
    }

    .hero::after {
      position: absolute;
      width: 150px;
      height: 150px;
      right: -55px;
      bottom: -76px;
      content: '';
      border: 18px solid rgb(255 255 255 / 0.065);
      border-radius: 50%;
    }

    .eyebrow {
      margin: 0 0 6px;
      color: var(--color-brand);
      font-size: 0.72rem;
      font-weight: 850;
      letter-spacing: 0.11em;
      text-transform: uppercase;
    }

    .hero .eyebrow { color: #f2b08e; }
    h1, h2, h3, p { margin-top: 0; }

    h1 {
      max-width: 10ch;
      margin-bottom: 10px;
      font-family: var(--display-font);
      font-size: clamp(2.35rem, 11vw, 4.8rem);
      line-height: 0.93;
      letter-spacing: -0.055em;
    }

    .hero-copy {
      max-width: 33rem;
      margin-bottom: 24px;
      color: rgb(255 255 255 / 0.76);
      line-height: 1.5;
    }

    .hero-cta {
      position: relative;
      z-index: 1;
      display: flex;
      min-height: 62px;
      align-items: center;
      gap: 12px;
      padding: 8px 14px 8px 9px;
      color: white;
      border-radius: 16px;
      background: var(--color-brand);
      font-weight: 850;
      text-decoration: none;
    }

    .hero-actions { position: relative; z-index: 1; display: grid; gap: 10px; }

    .hero-cta > i { margin-left: auto; }
    .hero-cta small { display: block; color: rgb(255 255 255 / .68); font-size: 0.68rem; }

    .ball-mark {
      display: grid;
      width: 46px;
      height: 46px;
      flex: 0 0 46px;
      place-items: center;
      color: white;
      border-radius: 50%;
      background: rgb(255 255 255 / .16);
    }

    .hero-stamp { position: absolute; right: 24px; bottom: 22px; display: none; align-items: center; gap: 8px; color: rgb(255 255 255 / .32); font: 800 .63rem/.95 var(--display-font); letter-spacing: .08em; text-transform: uppercase; }
    .hero-stamp i { font-size: 1.65rem; }

    .section-block { padding: 28px 0 8px; }
    .section-heading { display: flex; align-items: end; justify-content: space-between; margin-bottom: 14px; }
    .section-heading h2, .tournament-card h2 { margin-bottom: 0; font-family: var(--display-font); font-size: 1.7rem; letter-spacing: -0.035em; }
    .section-heading > a { color: var(--color-brand-strong); font-size: 0.82rem; font-weight: 800; text-decoration: none; }

    .match-scroller {
      display: grid;
      grid-auto-columns: minmax(245px, 82%);
      grid-auto-flow: column;
      gap: 12px;
      overflow-x: auto;
      padding: 2px 2px 12px;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
    }

    .match-card {
      min-height: 180px;
      padding: 18px;
      border: 1px solid var(--color-border);
      border-radius: 18px;
      background: var(--color-surface);
      box-shadow: 0 8px 24px rgb(20 24 26 / 0.045);
      scroll-snap-align: start;
    }

    .match-topline { display: flex; justify-content: space-between; margin-bottom: 22px; }
    .level, .spots { padding: 5px 8px; border-radius: 9px; font-size: 0.68rem; font-weight: 850; }
    .level { color: var(--color-ink); background: var(--color-surface-muted); }
    .spots { color: var(--color-tournament); background: var(--color-tournament-soft); }
    .match-card h3 { margin-bottom: 8px; font-size: 1.08rem; }
    .match-card p { color: var(--color-ink-muted); font-size: 0.82rem; }
    .match-card p i { margin-right: 5px; color: var(--color-brand); }

    .players { display: flex; align-items: center; margin-top: 20px; }
    .players span, .players strong {
      display: grid;
      width: 32px;
      height: 32px;
      place-items: center;
      margin-right: -7px;
      border: 2px solid white;
      border-radius: 50%;
      background: var(--color-sand);
      font-size: 0.62rem;
    }
    .players strong { color: white; background: var(--color-brand-strong); }

    .tournament-card {
      position: relative;
      display: grid;
      min-height: 160px;
      align-items: end;
      grid-template-columns: 1fr auto;
      overflow: hidden;
      padding: 22px;
      color: white;
      border-radius: 22px;
      background: var(--color-brand);
    }

    .tournament-card .eyebrow { color: rgb(255 255 255 / 0.7); }
    .tournament-card p { margin-bottom: 0; color: rgb(255 255 255 / 0.8); }
    .tournament-card a { color: white; font-weight: 850; text-decoration: none; }
    .tournament-number { position: absolute; top: -32px; right: 10px; color: rgb(255 255 255 / 0.11); font: 900 9rem/1 var(--display-font); }

    a:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }

    @media (min-width: 768px) {
      .home-page { padding: 36px 28px 120px; }
      .home-feature-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(310px, .85fr); gap: 20px; align-items: stretch; }
      .hero { min-height: 430px; display: grid; align-content: center; padding: 48px; }
      .hero-actions { grid-template-columns: minmax(260px, 350px); align-items: stretch; justify-content: start; }
      .hero-stamp { display: flex; }
      .section-block { display: grid; grid-template-rows: auto 1fr; padding: 4px 0; }
      .match-scroller { grid-auto-flow: row; grid-template-columns: 1fr; overflow: visible; }
      .match-card { min-height: 0; padding: 16px; }
      .match-topline { margin-bottom: 12px; }
      .players { margin-top: 12px; }
      .tournament-card { margin-top: 20px; }
    }
    @media (min-width: 1040px) {
      .home-feature-grid { grid-template-columns: minmax(0, 1.3fr) minmax(340px, .7fr); }
    }
  `,
})
export class Home implements OnInit, OnDestroy {
  private readonly pageActions = inject(PageActionsService);
  private readonly authStore = inject(AuthStore);
  private readonly tournamentsStore = inject(TournamentsStore);

  protected readonly nextTournament = computed<Tournament | null>(() =>
    [...this.tournamentsStore.tournaments()]
      .filter(({ status, ends_at }) => !['draft', 'cancelled', 'archived'].includes(status) && new Date(ends_at).getTime() >= Date.now())
      .sort((first, second) => new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime())[0] ?? null,
  );

  protected readonly matches = [
    { id: 1, level: 'Intermedio', spots: 2, place: 'Pala Beach Tiburtina', when: 'Oggi, 19:30', players: 2 },
    { id: 2, level: 'Base', spots: 1, place: 'Beach Town Ostia', when: 'Domani, 18:00', players: 3 },
    { id: 3, level: 'Avanzato', spots: 2, place: 'Empire Sport', when: 'Sabato, 10:00', players: 2 },
  ] as const;

  ngOnInit(): void {
    void this.tournamentsStore.loadList(true);
    this.pageActions.set([
      ...(this.authStore.canOrganizeTournaments() ? [{ id: 'organize-tournament', label: 'Organizza un torneo', shortLabel: 'Torneo', icon: 'pi-trophy', routerLink: '/tornei/organizza' }] : []),
      {
        id: 'create-match',
        label: 'Crea una partita',
        shortLabel: 'Crea',
        icon: 'pi-plus',
        primary: true,
        routerLink: '/partite/nuova',
      },
    ]);
  }

  ngOnDestroy(): void {
    this.pageActions.clear();
  }
}
