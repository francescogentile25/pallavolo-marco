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
import { PageActionsService } from '../../core/services/page-actions.service';
import { Reveal } from '../../shared/motion/reveal.directive';
import { AuthStore } from '../auth/store/auth.store';
import { TournamentsStore } from '../tournaments/store/tournaments.store';
import { Tournament } from '../tournaments/models/tournament.model';

/** Segnaposto: queste partite sono ancora dati finti, non arrivano dal database. */
interface OpenMatchPreview {
  id: number;
  level: string;
  spots: number;
  place: string;
  when: string;
  players: number;
}

/**
 * Home costruita sulla geometria del campo: 16x8 metri, cioe 2:1. Il blocco di
 * apertura e un campo vero, con le fettucce che lo delimitano e la banda della rete
 * al centro. Sulla rete sta il numero che decide se scendi in spiaggia adesso: i
 * posti liberi nella prima partita utile.
 */
@Component({
  selector: 'app-home',
  imports: [DatePipe, RouterLink, Reveal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="home">
      <section class="court" aria-labelledby="home-title" appReveal>
        <span class="stake stake-tl" aria-hidden="true"></span>
        <span class="stake stake-tr" aria-hidden="true"></span>
        <span class="stake stake-bl" aria-hidden="true"></span>
        <span class="stake stake-br" aria-hidden="true"></span>

        <div class="court-half court-half-near">
          <p class="tag">Oggi in campo</p>
          @if (nextMatch(); as match) {
            <h1 id="home-title">{{ match.place }}</h1>
            <p class="court-meta">
              <span class="num">{{ match.when }}</span>
              <span class="sep" aria-hidden="true">/</span>
              {{ match.level }}
            </p>
          } @else {
            <h1 id="home-title">Campo libero</h1>
            <p class="court-meta">Nessuna partita aperta. Aprila tu.</p>
          }
        </div>

        <div class="net" role="presentation">
          <span class="net-band">
            @if (nextMatch(); as match) {
              <b>{{ match.spots }}</b> {{ match.spots === 1 ? 'posto libero' : 'posti liberi' }}
            } @else {
              <b>0</b> partite aperte
            }
          </span>
        </div>

        <div class="court-half court-half-far">
          <a class="serve" routerLink="/partite/nuova">
            Crea una partita
            <i class="pi pi-arrow-right" aria-hidden="true"></i>
          </a>
          <a class="receive" routerLink="/partite">Guarda tutte le partite</a>
        </div>
      </section>

      <div class="mosaic" appReveal="stagger">
      <section class="block block-open" aria-labelledby="open-title">
        <header class="block-head">
          <h2 id="open-title">Partite aperte</h2>
          <a routerLink="/partite">Tutte <i class="pi pi-arrow-right" aria-hidden="true"></i></a>
        </header>

        <ul class="rally">
          @for (match of matches; track match.id) {
            <li class="side">
              <p class="side-when num">{{ match.when }}</p>
              <h3>{{ match.place }}</h3>
              <p class="side-level">{{ match.level }}</p>
              <p class="side-spots num"><b>{{ match.spots }}</b> <span>liberi</span></p>
            </li>
          } @empty {
            <li class="side side-empty">Nessuna partita aperta in questo momento.</li>
          }
        </ul>
      </section>

      <section class="block block-tournament" aria-labelledby="tournament-title">
        <header class="block-head">
          <h2 id="tournament-title">Prossimo torneo</h2>
          <a routerLink="/tornei">Tutti <i class="pi pi-arrow-right" aria-hidden="true"></i></a>
        </header>

        @if (nextTournament(); as tournament) {
          <a class="tournament" [routerLink]="['/tornei', tournament.id]">
            <span class="tournament-date num" aria-hidden="true">
              {{ tournament.starts_at | date: 'dd' }}<em>{{ tournament.starts_at | date: 'MMM':'':'it' }}</em>
            </span>
            <span class="tournament-body">
              <strong>{{ tournament.title }}</strong>
              <small>{{ tournament.starts_at | date: 'EEEE, HH:mm':'':'it' }} · {{ tournament.city || tournament.venue.city }}</small>
            </span>
            <i class="pi pi-arrow-right" aria-hidden="true"></i>
          </a>
        } @else {
          <a class="tournament tournament-empty" routerLink="/tornei">
            <span class="tournament-body">
              <strong>Nessun torneo in programma</strong>
              <small>Guarda l'archivio o organizzane uno.</small>
            </span>
            <i class="pi pi-arrow-right" aria-hidden="true"></i>
          </a>
        }
      </section>
      </div>
    </main>
  `,
  styles: `
    :host { display: block; background: var(--court-sand); }

    .home {
      width: min(100%, 1080px);
      padding: 16px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 48px);
      margin: 0 auto;
      font-family: var(--font-body);
      color: var(--court-ink);
    }

    .num { font-family: var(--font-numeric); font-variant-numeric: tabular-nums; }

    /* ---- il campo ---- */
    .court {
      position: relative;
      display: grid;
      grid-template-rows: 1fr auto 1fr;
      padding: clamp(20px, 5vw, 34px);
      border: var(--court-line) solid var(--court-tape);
      border-radius: var(--radius-sm);
      background: var(--court-blue);
      box-shadow: 0 22px 44px rgb(15 27 35 / .22);
      color: var(--court-tape);
    }

    /* i picchetti che tengono la fettuccia agli angoli */
    .stake {
      position: absolute;
      width: 10px;
      height: 10px;
      background: var(--court-yellow);
      border-radius: var(--radius-sm);
    }
    .stake-tl { top: -6px; left: -6px; }
    .stake-tr { top: -6px; right: -6px; }
    .stake-bl { bottom: -6px; left: -6px; }
    .stake-br { bottom: -6px; right: -6px; }

    .court-half { display: grid; align-content: center; gap: 8px; padding: clamp(10px, 4vw, 26px) 0; }
    .court-half-far { justify-items: start; gap: 14px; }

    .tag {
      margin: 0;
      font-family: var(--font-numeric);
      font-size: .66rem;
      font-weight: 700;
      letter-spacing: .18em;
      text-transform: uppercase;
      color: var(--court-yellow);
    }

    .court h1 {
      margin: 0;
      font-family: var(--font-display);
      font-size: clamp(2.1rem, 8.5vw, 3.6rem);
      font-weight: 800;
      font-stretch: 125%;
      line-height: .98;
      letter-spacing: -.02em;
      text-wrap: balance;
    }

    .court-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin: 0; font-size: .92rem; color: rgb(255 255 255 / .86); }
    .court-meta .sep { color: var(--court-yellow); }

    /* la rete: porta il numero che conta */
    .net {
      position: relative;
      display: flex;
      justify-content: center;
      margin: 0 calc(clamp(20px, 5vw, 34px) * -1);
      border-top: var(--court-line) solid var(--court-tape);
      border-bottom: var(--court-line) solid var(--court-tape);
      background: rgb(15 27 35 / .28);
    }

    .net-band {
      padding: 9px 18px;
      font-family: var(--font-numeric);
      font-size: .74rem;
      font-weight: 500;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: var(--court-tape);
    }
    .net-band b { font-size: 1.4rem; font-weight: 700; color: var(--court-yellow); }

    .serve {
      display: inline-flex;
      min-height: 52px;
      align-items: center;
      gap: 12px;
      padding: 0 22px;
      color: var(--court-ink);
      border-radius: var(--radius-sm);
      background: var(--court-yellow);
      font-family: var(--font-display);
      font-size: 1rem;
      font-weight: 700;
      font-stretch: 112%;
      text-decoration: none;
      transition: transform var(--duration-fast) var(--ease-out);
    }
    .serve:hover { transform: translateX(4px); }

    .receive { color: rgb(255 255 255 / .82); font-size: .9rem; text-decoration: underline; text-underline-offset: 4px; }

    /* ---- blocchi ---- */
    .mosaic { display: grid; gap: 22px; margin-top: 30px; }
    .block { margin: 0; }

    .block-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 14px;
      padding-bottom: 10px;
      margin-bottom: 16px;
      border-bottom: var(--court-line) solid var(--court-tape);
    }

    .block-head h2 {
      margin: 0;
      font-family: var(--font-display);
      font-size: clamp(1.25rem, 4.4vw, 1.7rem);
      font-weight: 800;
      font-stretch: 125%;
      letter-spacing: -.01em;
    }

    .block-head a { display: inline-flex; align-items: center; gap: 6px; color: var(--court-blue); font-size: .82rem; font-weight: 700; text-decoration: none; }
    .block-head a:hover { text-decoration: underline; text-underline-offset: 3px; }

    .rally { display: grid; gap: 10px; padding: 0; margin: 0; list-style: none; }

    .side {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 2px 16px;
      padding: 16px;
      border-left: var(--court-line) solid var(--court-blue);
      border-radius: var(--radius);
      background: var(--court-tape);
    }

    .side-when { grid-column: 1; margin: 0; font-size: .72rem; letter-spacing: .04em; color: var(--court-ink-soft); }
    .side h3 { grid-column: 1; margin: 0; font-family: var(--font-display); font-size: 1.05rem; font-weight: 700; font-stretch: 112%; }
    .side-level { grid-column: 1; margin: 0; font-size: .8rem; color: var(--court-ink-soft); }

    .side-spots { grid-column: 2; grid-row: 1 / 4; display: grid; justify-items: center; margin: 0; }
    .side-spots b { font-size: 1.9rem; font-weight: 700; line-height: 1; color: var(--court-blue); }
    .side-spots span { font-size: .6rem; letter-spacing: .1em; text-transform: uppercase; color: var(--court-ink-soft); }

    .side-empty { display: block; padding: 20px 16px; color: var(--court-ink-soft); }

    .tournament {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 18px;
      padding: 16px;
      color: inherit;
      background: var(--court-tape);
      border-left: var(--court-line) solid var(--court-yellow);
      border-radius: var(--radius);
      text-decoration: none;
    }

    .tournament-date {
      display: grid;
      justify-items: center;
      padding: 8px 12px;
      background: var(--court-ink);
      color: var(--court-tape);
      border-radius: var(--radius-sm);
      font-size: 1.7rem;
      font-weight: 700;
      line-height: 1;
    }
    .tournament-date em { font-size: .58rem; font-style: normal; letter-spacing: .12em; text-transform: uppercase; color: var(--court-yellow); }

    .tournament-body { display: grid; gap: 3px; min-width: 0; }
    .tournament-body strong { font-family: var(--font-display); font-size: 1.05rem; font-weight: 700; font-stretch: 112%; }
    .tournament-body small { font-size: .8rem; color: var(--court-ink-soft); }
    .tournament > i { color: var(--court-blue); }
    .tournament-empty { border-left-color: var(--court-sand-deep); }

    a:focus-visible { outline: 3px solid var(--court-ink); outline-offset: 3px; }
    .court a:focus-visible { outline-color: var(--court-yellow); }

    @media (min-width: 760px) {
      .home { padding: 30px 24px 120px; }

      /* il campo visto dall'alto: rete verticale, due meta affiancate */
      .court { grid-template-rows: none; grid-template-columns: 1.15fr auto 1fr; align-items: stretch; }
      .court h1 { font-size: clamp(2.4rem, 4.4vw, 3.6rem); }
      .court-half-far { align-content: center; padding-left: clamp(20px, 3vw, 34px); }

      .net {
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin: calc(clamp(20px, 5vw, 34px) * -1) 0;
        border-top: 0;
        border-bottom: 0;
        border-left: var(--court-line) solid var(--court-tape);
        border-right: var(--court-line) solid var(--court-tape);
      }
      .net-band { writing-mode: vertical-rl; padding: 18px 9px; }
      .net-band b { font-size: 1.5rem; }

      /* mosaico: partite e torneo affiancati sotto il campo */
      .mosaic { grid-template-columns: minmax(0, 1.75fr) minmax(260px, 1fr); align-items: start; gap: 26px; }
      .rally { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .side { grid-template-columns: minmax(0, 1fr) auto; }
      .block-tournament .tournament { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 14px; }
      .block-tournament .tournament > i { display: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .serve { transition: none; }
      .serve:hover { transform: none; }
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

  protected readonly matches: readonly OpenMatchPreview[] = [
    { id: 1, level: 'Intermedio', spots: 2, place: 'Pala Beach Tiburtina', when: 'Oggi, 19:30', players: 2 },
    { id: 2, level: 'Base', spots: 1, place: 'Beach Town Ostia', when: 'Domani, 18:00', players: 3 },
    { id: 3, level: 'Avanzato', spots: 2, place: 'Empire Sport', when: 'Sabato, 10:00', players: 2 },
  ];

  /** La prima partita utile: e quella che finisce sulla rete, in cima alla pagina. */
  protected readonly nextMatch = computed(() => this.matches[0] ?? null);

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
