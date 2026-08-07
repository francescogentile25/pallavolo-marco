import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal, untracked, viewChild } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageActionsService } from '../../core/services/page-actions.service';
import { NearbyPlaces } from '../../shared/places/nearby.service';
import { motionAllowed, Reveal } from '../../shared/motion/reveal.directive';
import { WeatherPanel } from '../../shared/weather/weather-panel';
import { AuthStore } from '../auth/store/auth.store';
import { BeachMatch } from '../matches/models/match.model';
import { availableSpots, levelLabel } from '../matches/matches.utils';
import { MatchesStore } from '../matches/store/matches.store';
import { Tournament } from '../tournaments/models/tournament.model';
import { TournamentsStore } from '../tournaments/store/tournaments.store';
import { CalendarEvent, HomeCalendar } from './components/home-calendar';
import { matchVenuePoint as venuePoint, tournamentPoint } from '../../shared/places/place-points';

const DAY = 24 * 60 * 60 * 1000;

gsap.registerPlugin(ScrollTrigger);

/**
 * Home: la prossima partita occupa la testata, il programma personale e il meteo
 * stanno sotto affiancati, e in fondo si trova cosa c'e da prendere al volo,
 * partite aperte e tornei con le iscrizioni ancora aperte.
 */
@Component({
  selector: 'app-home',
  imports: [DatePipe, RouterLink, Reveal, WeatherPanel, HomeCalendar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <section class="hero" [class.hero-empty]="!nextMatch()" #hero>
        <span class="hero-media" #heroMedia aria-hidden="true"></span>
        <span class="hero-veil" aria-hidden="true"></span>
        <div class="hero-inner">
          <div class="hero-content">
            @if (nextMatch(); as match) {
              <span class="eyebrow light">La tua prossima partita</span>
              <h1><span class="line"><span>Il campo</span></span><span class="line"><span>ti aspetta.</span></span></h1>
              <p class="hero-description">
                {{ whenLabel(match.starts_at) }} giochi a
                <strong>{{ match.court.venue.name }}</strong>. Preparati per il prossimo match.
              </p>

              <div class="match-summary">
                <div class="summary-item">
                  <span class="summary-icon"><i class="pi pi-clock" aria-hidden="true"></i></span>
                  <div class="summary-copy"><span>{{ dayLabel(match.starts_at) }}</span><strong>{{ match.starts_at | date: 'HH:mm' }}</strong></div>
                </div>
                <span class="summary-separator" aria-hidden="true"></span>
                <div class="summary-item">
                  <span class="summary-icon"><i class="pi pi-chart-line" aria-hidden="true"></i></span>
                  <div class="summary-copy"><span>Livello</span><strong>{{ levelText(match) }}</strong></div>
                </div>
                <span class="summary-separator" aria-hidden="true"></span>
                <div class="summary-item">
                  <span class="summary-icon"><i class="pi pi-map-marker" aria-hidden="true"></i></span>
                  <div class="summary-copy"><span>Campo</span><strong>{{ match.court.name }}</strong></div>
                </div>
              </div>
            } @else {
              <span class="eyebrow light">Nessuna partita in programma</span>
              <h1><span class="line"><span>Il campo</span></span><span class="line"><span>è libero.</span></span></h1>
              <p class="hero-description">
                Non sei iscritto a nessuna partita. <strong>Aprine una</strong> oppure entra in una di quelle qui sotto.
              </p>
            }

            <div class="hero-actions">
              <a class="btn btn-primary" routerLink="/partite/nuova">Crea una partita <i class="pi pi-arrow-right" aria-hidden="true"></i></a>
              <a class="btn btn-secondary" routerLink="/partite/mie"><i class="pi pi-list" aria-hidden="true"></i> Le mie partite</a>
            </div>
          </div>

          @if (nextMatch(); as match) {
            <aside class="hero-side">
              <p class="places"><strong #spotsValue>{{ spots(match) }}</strong><span>{{ spots(match) === 1 ? 'posto libero' : 'posti liberi' }}</span></p>
            </aside>
          }
        </div>
      </section>

      <section class="top-grid" appReveal="stagger">
        <app-home-calendar [events]="calendarEvents()" />
        <app-weather-panel [latitude]="cityLatitude()" [longitude]="cityLongitude()" [place]="cityName()" />
      </section>

      <section class="bottom-grid" appReveal="stagger">
        <article class="panel list-panel" aria-labelledby="open-matches-title">
          <div class="section-head">
            <div><span class="eyebrow">{{ nearbyLabel() }}</span><h2 id="open-matches-title">Partite aperte</h2></div>
            <a class="section-link" routerLink="/partite">Vedi tutte <i class="pi pi-arrow-right" aria-hidden="true"></i></a>
          </div>

          <div class="cards">
            @for (match of openMatches(); track match.id) {
              <a class="match-card" [routerLink]="['/partite', match.id]">
                <div class="card-head">
                  <span class="pill">{{ levelText(match) }}</span>
                  <span class="pill places-pill"><strong>{{ spots(match) }}</strong> {{ spots(match) === 1 ? 'posto' : 'posti' }}</span>
                </div>
                <h3>{{ match.court.venue.name }}</h3>
                <p class="meta"><i class="pi pi-calendar" aria-hidden="true"></i> {{ whenLabel(match.starts_at) }}, {{ match.starts_at | date: 'HH:mm' }}</p>
                <div class="card-footer">
                  <span class="players" [attr.aria-label]="match.participants.length + ' iscritti su ' + match.capacity">
                    @for (slot of stack(match); track slot) { <i class="player pi pi-user" aria-hidden="true"></i> }
                    @if (match.participants.length > 3) { <b class="player more">+{{ match.participants.length - 3 }}</b> }
                  </span>
                  <span class="text-action">Partecipa <i class="pi pi-arrow-right" aria-hidden="true"></i></span>
                </div>
              </a>
            } @empty {
              @if (cityName()) {
                <p class="empty">Nessuna partita aperta entro {{ nearbyKm }} km da {{ cityName() }}. <a routerLink="/partite">Guarda tutte le partite</a> o <a routerLink="/partite/nuova">aprine una</a>.</p>
              } @else {
                <p class="empty">Nessuna partita aperta in questo momento. <a routerLink="/partite/nuova">Aprine una</a>.</p>
              }
            }
          </div>
        </article>

        <article class="panel list-panel" aria-labelledby="open-tournaments-title">
          <div class="section-head">
            <div><span class="eyebrow">{{ nearbyLabel() }}</span><h2 id="open-tournaments-title">Tornei aperti</h2></div>
            <a class="section-link" routerLink="/tornei">Vedi tutti <i class="pi pi-arrow-right" aria-hidden="true"></i></a>
          </div>

          <div class="cards">
            @for (tournament of openTournaments(); track tournament.id) {
              <a class="tournament-card" [routerLink]="['/tornei', tournament.id]">
                <span class="date-card"><strong>{{ tournament.starts_at | date: 'dd' }}</strong><span>{{ tournament.starts_at | date: 'MMM':'':'it' }}</span></span>
                <span class="tournament-body">
                  <span class="kicker">Iscrizioni aperte</span>
                  <h3>{{ tournament.title }}</h3>
                  <p>{{ tournament.city || tournament.venue.city }} · {{ tournament.starts_at | date: 'EEEE, HH:mm':'':'it' }}</p>
                  <span class="card-footer">
                    <span class="team-count"><i class="pi pi-users" aria-hidden="true"></i> {{ confirmedTeams(tournament) }} squadre</span>
                    <span class="details-link">Dettagli <i class="pi pi-arrow-right" aria-hidden="true"></i></span>
                  </span>
                </span>
              </a>
            } @empty {
              @if (cityName()) {
                <p class="empty">Nessun torneo con iscrizioni aperte entro {{ nearbyKm }} km da {{ cityName() }}. <a routerLink="/tornei">Guarda il calendario</a>.</p>
              } @else {
                <p class="empty">Nessun torneo con iscrizioni aperte. <a routerLink="/tornei">Guarda il calendario</a>.</p>
              }
            }
          </div>
        </article>
      </section>
    </main>
  `,
  styles: `
    :host{display:block;background:linear-gradient(180deg,#f6fbfd 0%,#f9fbfa 48%,var(--color-canvas) 100%)}
    .page{width:min(1360px,100%);padding:24px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 56px);margin:0 auto;color:var(--color-ink)}
    .eyebrow{display:inline-flex;align-items:center;gap:8px;color:var(--color-brand);font-size:.62rem;font-weight:900;letter-spacing:.18em;text-transform:uppercase}
    .eyebrow.light{color:var(--court-yellow)}

    /* ---- testata: la prossima partita ---- */
    .hero{position:relative;overflow:hidden;color:white;border-radius:28px;background:#062f46;box-shadow:0 26px 75px rgb(4 42 63/.18)}
    /* Foto e velo su due strati: solo cosi l'immagine puo scorrere sotto al testo. */
    .hero-media{position:absolute;inset:-10% 0;z-index:0;background:url('/assets/images/tournaments-hero.webp') center 44%/cover no-repeat;will-change:transform}
    .hero-veil{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(90deg,rgb(3 43 64/.97) 0%,rgb(3 43 64/.92) 32%,rgb(3 43 64/.55) 62%,rgb(3 43 64/.3) 100%),linear-gradient(180deg,transparent 45%,rgb(0 30 45/.2))}
    .hero h1 .line{display:block;overflow:hidden}
    .hero h1 .line>span{display:block}
    .hero-inner{position:relative;z-index:2;display:grid;min-height:430px;grid-template-columns:minmax(0,1fr) 150px}
    .hero-empty .hero-inner{grid-template-columns:minmax(0,1fr)}
    .hero-content{display:flex;width:min(660px,100%);flex-direction:column;justify-content:center;padding:48px 24px}
    .hero h1{margin:16px 0 14px;font-family:var(--display-font);font-size:clamp(2.6rem,5.6vw,4.4rem);font-weight:700;line-height:.95;letter-spacing:-.05em}
    .hero-description{max-width:570px;margin:0;color:#dceaf0;font-size:1rem;line-height:1.55}
    .hero-description strong{color:white}

    .match-summary{display:flex;width:fit-content;max-width:100%;align-items:stretch;gap:18px;margin-top:24px;padding:16px 19px;border:1px solid rgb(255 255 255/.28);border-radius:15px;background:rgb(5 53 76/.48);backdrop-filter:blur(10px)}
    .summary-item{display:flex;min-width:104px;align-items:center;gap:10px}
    .summary-icon{display:grid;width:30px;height:30px;flex:0 0 30px;place-items:center;color:#caecf8;border:1px solid rgb(255 255 255/.18);border-radius:10px}
    .summary-copy{display:flex;min-width:0;flex-direction:column;gap:2px}
    .summary-copy span{color:#a8c7d5;font-size:.54rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
    .summary-copy strong{overflow:hidden;font-size:.76rem;text-overflow:ellipsis;white-space:nowrap}
    .summary-separator{width:1px;background:rgb(255 255 255/.2)}

    .hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
    .btn{display:inline-flex;min-height:52px;align-items:center;justify-content:center;gap:12px;padding:0 22px;border:0;border-radius:14px;font-weight:850;text-decoration:none;transition:transform 160ms ease}
    .btn:hover{transform:translateY(-2px)}
    .btn:focus-visible{outline:3px solid var(--court-yellow);outline-offset:3px}
    .btn-primary{min-width:195px;color:#062f46;background:var(--court-yellow);box-shadow:0 10px 28px rgb(240 180 41/.24)}
    .btn-secondary{color:white;border:1px solid rgb(255 255 255/.45);background:rgb(255 255 255/.08)}

    .hero-side{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;border-left:1px solid rgb(255 255 255/.38);background:rgb(2 47 70/.42)}
    .places{margin:0;text-align:center}
    .places strong{display:block;color:var(--court-yellow);font-family:var(--font-numeric);font-size:3.1rem;line-height:.95}
    .places span{display:block;max-width:82px;margin-top:10px;font-size:.76rem;font-weight:900;line-height:1.4;text-transform:uppercase}

    /* ---- griglie ---- */
    .top-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(0,.95fr);gap:22px;margin-top:24px}
    .bottom-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;margin-top:24px}
    .panel{border:1px solid var(--color-border);border-radius:var(--radius-lg);background:rgb(255 255 255/.94);box-shadow:0 18px 50px rgb(7 54 79/.08)}
    .list-panel{padding:22px}

    .section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:0 1px 16px;border-bottom:2px solid rgb(8 43 61/.12)}
    .section-head h2{margin:5px 0 0;font-family:var(--display-font);font-size:1.65rem;line-height:1.08;letter-spacing:-.035em}
    .section-link{display:inline-flex;align-items:center;gap:6px;color:var(--color-brand);font-size:.78rem;font-weight:850;white-space:nowrap;text-decoration:none}
    .section-link:hover{text-decoration:underline;text-underline-offset:3px}

    .cards{display:flex;flex-direction:column;gap:11px;margin-top:15px}
    .empty{margin:15px 0 0;color:var(--color-ink-muted);font-size:.8rem}
    .match-card,.tournament-card{color:inherit;border:1px solid var(--color-border);border-radius:17px;background:white;text-decoration:none;transition:transform 160ms ease,box-shadow 160ms ease}
    .match-card:hover,.tournament-card:hover{box-shadow:0 14px 36px rgb(8 43 61/.08);transform:translateY(-2px)}
    .match-card:focus-visible,.tournament-card:focus-visible{outline:3px solid var(--color-focus);outline-offset:2px}

    /* partite aperte */
    .match-card{position:relative;display:block;overflow:hidden;padding:16px}
    .match-card::before{content:'';position:absolute;top:0;left:0;width:3px;height:100%;background:var(--color-brand)}
    .card-head,.card-footer{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .pill{display:inline-flex;min-height:26px;align-items:center;padding:0 10px;border-radius:9px;background:#eef6f9;font-size:.6rem;font-weight:850}
    .places-pill{color:var(--color-brand);background:var(--color-brand-soft)}
    .places-pill strong{margin-right:3px;font-family:var(--font-numeric);font-size:.78rem}
    .match-card h3{margin:13px 0 7px;font-size:1rem}
    .meta{display:flex;align-items:center;gap:7px;margin:0;color:var(--color-ink-muted);font-size:.72rem}
    .meta i{color:var(--color-brand)}
    .match-card .card-footer{margin-top:15px}
    .players{display:flex;align-items:center}
    .player{display:grid;width:29px;height:29px;margin-right:-5px;place-items:center;color:#587684;border:2px solid white;border-radius:50%;background:#e1f2f7;font-size:.6rem;font-weight:800}
    .player.more{color:white;background:var(--color-brand);font-family:var(--font-numeric)}
    .text-action{display:inline-flex;align-items:center;gap:5px;color:var(--color-brand);font-size:.68rem;font-weight:900}

    /* tornei aperti */
    .tournament-card{display:grid;grid-template-columns:72px 1fr;gap:16px;padding:15px;border-left:3px solid var(--color-tournament)}
    .date-card{display:flex;width:68px;height:68px;flex-direction:column;align-items:center;justify-content:center;color:white;border-radius:12px;background:#062f46}
    .date-card strong{font-family:var(--font-numeric);font-size:1.7rem;line-height:1}
    .date-card>span{margin-top:5px;color:var(--court-yellow);font-size:.5rem;font-weight:950;letter-spacing:.14em;text-transform:uppercase}
    .tournament-body{display:block;min-width:0}
    .kicker{color:var(--color-brand);font-size:.54rem;font-weight:900;letter-spacing:.07em;text-transform:uppercase}
    .tournament-card h3{margin:5px 0;font-size:1.05rem}
    .tournament-card p{margin:0;color:var(--color-ink-muted);font-size:.72rem}
    .tournament-card .card-footer{margin-top:13px;font-size:.68rem}
    .team-count{display:inline-flex;align-items:center;gap:6px;color:#4c6878}
    .details-link{display:inline-flex;align-items:center;gap:5px;color:var(--color-brand);font-weight:900}

    @media(min-width:760px){.page{padding-left:24px;padding-right:24px}.hero-content{padding:56px 24px 52px 48px}}

    @media(max-width:1120px){
      .top-grid,.bottom-grid{grid-template-columns:minmax(0,1fr)}
    }

    @media(max-width:840px){
      .hero{background-position:62% center}
      .hero-inner{min-height:520px;grid-template-columns:minmax(0,1fr)}
      .hero-content{justify-content:flex-end;padding:36px 20px;background:linear-gradient(90deg,rgb(3 43 64/.86),rgb(3 43 64/.5),transparent)}
      .hero-side{display:none}
      .match-summary{flex-wrap:wrap;width:100%}
      .summary-separator{display:none}
    }

    @media(max-width:560px){
      .hero-actions{flex-direction:column}
      .btn{width:100%}
      .list-panel{padding:18px}
      .section-head{align-items:center}
      .tournament-card{grid-template-columns:64px 1fr;gap:12px}
      .date-card{width:60px;height:64px}
    }
  `,
})
export class Home implements OnInit, OnDestroy {
  private readonly hero = viewChild<ElementRef<HTMLElement>>('hero');
  private readonly heroMedia = viewChild<ElementRef<HTMLElement>>('heroMedia');
  private readonly spotsValue = viewChild<ElementRef<HTMLElement>>('spotsValue');

  private intro?: gsap.core.Timeline;
  private parallax?: ScrollTrigger;
  private lastHadMatch: boolean | null = null;
  private countedNode: HTMLElement | null = null;

  private readonly pageActions = inject(PageActionsService);
  private readonly authStore = inject(AuthStore);
  private readonly matchesStore = inject(MatchesStore);
  private readonly tournamentsStore = inject(TournamentsStore);
  protected readonly nearby = inject(NearbyPlaces);

  protected readonly cityName = computed(() => this.authStore.profile()?.city ?? null);
  protected readonly cityLatitude = computed(() => this.authStore.profile()?.city_latitude ?? null);
  protected readonly cityLongitude = computed(() => this.authStore.profile()?.city_longitude ?? null);

  /** La prima partita a cui sono iscritto e che deve ancora cominciare. */
  protected readonly nextMatch = computed<BeachMatch | null>(() =>
    this.myUpcomingMatches()[0] ?? null,
  );

  protected readonly nearbyKm = this.nearby.radiusKm;
  protected readonly nearbyLabel = computed(() => {
    const city = this.cityName();
    return city ? `Entro ${this.nearby.radiusKm} km da ${city}` : 'Vicino a te';
  });

  protected readonly openMatches = computed<readonly BeachMatch[]>(() => {
    const me = this.authStore.authUser()?.id;
    return this.matchesStore
      .matches()
      .filter(match => match.status === 'open'
        && Date.parse(match.starts_at) >= Date.now()
        && availableSpots(match) > 0
        && !match.participants.some(participant => participant.profile_id === me)
        && this.nearby.isNearby(venuePoint(match.court.venue)))
      .slice(0, 3);
  });

  protected readonly openTournaments = computed<readonly Tournament[]>(() =>
    this.tournamentsStore
      .tournaments()
      .filter(tournament => tournament.status === 'published'
        && Date.parse(tournament.registration_deadline) >= Date.now()
        && this.nearby.isNearby(tournamentPoint(tournament)))
      .sort((first, second) => Date.parse(first.starts_at) - Date.parse(second.starts_at))
      .slice(0, 3),
  );

  /** Programma personale: le partite a cui sono iscritto e i tornei che gioco o organizzo. */
  protected readonly calendarEvents = computed<readonly CalendarEvent[]>(() => {
    const me = this.authStore.authUser()?.id;
    const matches = this.matchesStore
      .myMatches()
      .filter(match => match.status !== 'cancelled')
      .map<CalendarEvent>(match => ({
        id: `match-${match.id}`,
        kind: 'match',
        startsAt: match.starts_at,
        label: match.court.venue.name,
        link: ['/partite', match.id],
      }));

    const tournaments = this.tournamentsStore
      .tournaments()
      .filter(tournament => tournament.status !== 'cancelled' && (
        tournament.organizer_id === me
        || tournament.teams.some(team => team.members.some(member => member.profile_id === me))
      ))
      .map<CalendarEvent>(tournament => ({
        id: `tournament-${tournament.id}`,
        kind: 'tournament',
        startsAt: tournament.starts_at,
        label: tournament.title,
        link: ['/tornei', tournament.id],
      }));

    return [...matches, ...tournaments];
  });

  private readonly myUpcomingMatches = computed<readonly BeachMatch[]>(() =>
    this.matchesStore
      .myMatches()
      .filter(match => match.status !== 'cancelled' && Date.parse(match.starts_at) >= Date.now())
      .sort((first, second) => Date.parse(first.starts_at) - Date.parse(second.starts_at)),
  );

  constructor() {
    // Sedi e tornei creati prima dell'anagrafica hanno solo il nome del comune.
    effect(() => {
      const points = [
        ...this.matchesStore.matches().map(match => venuePoint(match.court.venue)),
        ...this.tournamentsStore.tournaments().map(tournamentPoint),
      ];
      untracked(() => this.nearby.resolveMissing(points));
    });

    // La testata cambia quando arrivano le partite: l'ingresso va suonato sul
    // contenuto definitivo, non su quello di attesa.
    afterRenderEffect(() => {
      const hasMatch = !!this.nextMatch();
      if (this.lastHadMatch === hasMatch) return;
      this.lastHadMatch = hasMatch;
      untracked(() => this.playIntro());
    });

    afterRenderEffect(() => {
      const node = this.spotsValue()?.nativeElement ?? null;
      if (!node || node === this.countedNode) return;
      this.countedNode = node;
      untracked(() => this.countSpots(node));
    });
  }

  /** Ingresso orchestrato della testata, piu il parallasse della foto sullo scorrimento. */
  private playIntro(): void {
    if (!motionAllowed()) return;
    const root = this.hero()?.nativeElement;
    if (!root) return;

    this.intro?.kill();
    const select = gsap.utils.selector(root);
    this.intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from(select('.hero-media'), { scale: 1.14, duration: 1.6, ease: 'power2.out' }, 0)
      .from(select('.eyebrow'), { opacity: 0, y: 14, duration: 0.5 }, 0.15)
      .from(select('h1 .line > span'), { yPercent: 115, duration: 0.9, stagger: 0.09 }, 0.2)
      .from(select('.hero-description'), { opacity: 0, y: 16, duration: 0.6 }, 0.5)
      .from(select('.summary-item'), { opacity: 0, y: 14, duration: 0.5, stagger: 0.08 }, 0.6)
      .from(select('.hero-actions .btn'), { opacity: 0, y: 14, duration: 0.5, stagger: 0.1 }, 0.72)
      .from(select('.hero-side'), { opacity: 0, xPercent: 40, duration: 0.7 }, 0.55);

    const media = this.heroMedia()?.nativeElement;
    if (media && !this.parallax) {
      this.parallax = ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        animation: gsap.fromTo(media, { yPercent: -4 }, { yPercent: 6, ease: 'none' }),
      });
    }
  }

  /** I posti liberi salgono da zero: e il numero che decide se scendi in campo. */
  private countSpots(node: HTMLElement): void {
    if (!motionAllowed()) return;
    const target = Number(node.textContent?.trim() ?? '0');
    if (!Number.isFinite(target) || target <= 0) return;
    const state = { value: 0 };
    node.textContent = '0';
    gsap.to(state, {
      value: target,
      duration: 0.9,
      delay: 0.7,
      ease: 'power2.out',
      snap: { value: 1 },
      onUpdate: () => { node.textContent = String(Math.round(state.value)); },
      onComplete: () => { node.textContent = String(target); },
    });
  }

  protected spots(match: BeachMatch): number { return availableSpots(match); }
  protected levelText(match: BeachMatch): string { return levelLabel(match.max_level); }
  protected confirmedTeams(tournament: Tournament): number {
    return tournament.teams.filter(team => team.status === 'confirmed').length;
  }

  /** Fino a tre pedine nello stack: il resto diventa un contatore. */
  protected stack(match: BeachMatch): readonly number[] {
    return Array.from({ length: Math.min(3, match.participants.length) }, (_, index) => index);
  }

  protected dayLabel(iso: string): string {
    const days = this.daysFromToday(iso);
    if (days === 0) return 'Oggi';
    if (days === 1) return 'Domani';
    return new Date(iso).toLocaleDateString('it-IT', { weekday: 'long' });
  }

  protected whenLabel(iso: string): string {
    const days = this.daysFromToday(iso);
    if (days === 0) return 'Oggi';
    if (days === 1) return 'Domani';
    if (days > 1 && days < 7) return new Date(iso).toLocaleDateString('it-IT', { weekday: 'long' });
    return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  }

  private daysFromToday(iso: string): number {
    const target = new Date(iso);
    target.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / DAY);
  }

  ngOnInit(): void {
    void this.matchesStore.loadMatches(true);
    void this.matchesStore.loadMyMatches(true);
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
    this.intro?.kill();
    this.parallax?.kill();
  }
}
