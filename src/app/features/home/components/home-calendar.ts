import { DatePipe } from '@angular/common';
import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, input, signal, untracked, viewChild } from '@angular/core';
import { loadMotion } from '../../../shared/motion/gsap-loader';
import { RouterLink } from '@angular/router';
import { motionAllowed } from '../../../shared/motion/reveal.directive';

export type CalendarEventKind = 'match' | 'tournament';

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  /** Istante ISO di inizio. */
  startsAt: string;
  label: string;
  link: readonly string[];
}

interface AgendaDay {
  key: string;
  date: Date;
  events: readonly CalendarEvent[];
}

/** Una casella della griglia: porta con se tutto quello che serve a disegnarla. */
interface CalendarCell {
  key: string;
  date: Date;
  day: number;
  outside: boolean;
  today: boolean;
  selected: boolean;
  hasMatch: boolean;
  hasTournament: boolean;
  label: string;
}

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const WEEKDAYS = [
  { short: 'Lun', long: 'lunedì' },
  { short: 'Mar', long: 'martedì' },
  { short: 'Mer', long: 'mercoledì' },
  { short: 'Gio', long: 'giovedì' },
  { short: 'Ven', long: 'venerdì' },
  { short: 'Sab', long: 'sabato' },
  { short: 'Dom', long: 'domenica' },
];

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** La settimana comincia di lunedi, come nel calendario italiano. */
function startOfWeek(value: Date): Date {
  const date = startOfDay(value);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function dayKey(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`;
}

function keyOf(date: Date): string {
  return dayKey(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Programma personale: una griglia da lunedi a domenica dove ogni giorno e un
 * pulsante vero, cosi il tocco sul telefono vale quanto il clic sul mouse.
 * Le caselle segnano con un punto i giorni impegnati; l'elenco sotto racconta
 * gli impegni del periodo scelto, settimana o mese, ed evidenzia il giorno
 * selezionato. Sul telefono e l'elenco a fare il lavoro: le caselle restano
 * piccole e leggibili invece di ospitare etichette schiacciate.
 */
@Component({
  selector: 'app-home-calendar',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="panel">
      <div class="head">
        <div class="titles">
          <span class="eyebrow">Il tuo programma</span>
          <h2>{{ view() === 'week' ? 'Questa settimana' : 'Questo mese' }}</h2>
        </div>

        <div class="controls">
          <div class="switch" role="group" aria-label="Scala del calendario">
            <button type="button" [class.on]="view() === 'week'" [attr.aria-pressed]="view() === 'week'"
                    (pointerup)="setViewFromPointer($event, 'week')" (click)="setViewFromClick('week')">Settimana</button>
            <button type="button" [class.on]="view() === 'month'" [attr.aria-pressed]="view() === 'month'"
                    (pointerup)="setViewFromPointer($event, 'month')" (click)="setViewFromClick('month')">Mese</button>
          </div>

          <div class="nav">
            <button type="button" class="step" (pointerup)="shiftFromPointer($event, -1)" (click)="shiftFromClick(-1)" [attr.aria-label]="view() === 'week' ? 'Settimana precedente' : 'Mese precedente'">‹</button>
            <span class="range">{{ rangeLabel() }}</span>
            <button type="button" class="step" (pointerup)="shiftFromPointer($event, 1)" (click)="shiftFromClick(1)" [attr.aria-label]="view() === 'week' ? 'Settimana successiva' : 'Mese successivo'">›</button>
          </div>
        </div>
      </div>

      <div class="picker" #picker>
        <div class="weekdays" aria-hidden="true">
          @for (weekday of weekdays; track weekday.short) { <span>{{ weekday.short }}</span> }
        </div>
        <div class="grid" [attr.aria-label]="'Giorni di ' + rangeLabel()">
          @for (cell of cells(); track cell.key) {
            <button type="button" class="cell"
                    [class.outside]="cell.outside"
                    [class.today]="cell.today"
                    [class.selected]="cell.selected"
                    [attr.aria-pressed]="cell.selected"
                    [attr.aria-label]="cell.label"
                    (pointerup)="pickFromPointer($event, cell.date)"
                    (click)="pickFromClick(cell.date)">
              <span class="cell-day">{{ cell.day }}</span>
              <span class="dots" aria-hidden="true">
                @if (cell.hasMatch) { <i class="dot match"></i> }
                @if (cell.hasTournament) { <i class="dot tournament"></i> }
              </span>
            </button>
          }
        </div>
      </div>

      <div class="agenda">
        <p class="agenda-head">{{ view() === 'week' ? 'Impegni della settimana' : 'Impegni del mese' }}</p>
        @for (day of agenda(); track day.key) {
          <div class="agenda-day" [class.is-selected]="day.key === selectedKey()">
            <span class="agenda-date"><b>{{ day.date | date: 'dd' }}</b>{{ day.date | date: 'MMM':'':'it' }}</span>
            <ul>
              @for (event of day.events; track event.id) {
                <li>
                  <a [routerLink]="event.link" [class.tournament]="event.kind === 'tournament'">
                    <time [attr.datetime]="event.startsAt">{{ event.startsAt | date: 'HH:mm' }}</time>
                    <span>{{ event.label }}</span>
                  </a>
                </li>
              }
            </ul>
          </div>
        } @empty {
          <p class="agenda-empty">Nessun impegno in questo periodo.</p>
        }
      </div>

      <div class="legend">
        <span><i class="dot match" aria-hidden="true"></i> Le mie partite</span>
        <span><i class="dot tournament" aria-hidden="true"></i> I miei tornei</span>
      </div>
    </article>
  `,
  styles: `
    :host{position:relative;z-index:0;display:block;isolation:isolate}
    .panel{padding:24px;border:1px solid var(--color-border);border-radius:var(--radius-lg);background:rgb(255 255 255/.94);box-shadow:0 18px 50px rgb(7 54 79/.08)}
    .head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px}
    .eyebrow{display:inline-flex;color:var(--color-brand);font-size:.62rem;font-weight:900;letter-spacing:.18em;text-transform:uppercase}
    h2{margin:5px 0 0;font-family:var(--display-font);font-size:1.65rem;line-height:1.08;letter-spacing:-.035em}

    .controls{position:relative;z-index:2;display:flex;flex-wrap:wrap;align-items:center;gap:10px;pointer-events:auto}
    .switch{display:inline-flex;padding:3px;border:1px solid var(--color-border);border-radius:var(--radius-pill);background:var(--color-surface-muted)}
    .switch button{min-height:38px;padding:0 14px;color:var(--color-ink-muted);border:0;border-radius:var(--radius-pill);background:none;font:inherit;font-size:.72rem;font-weight:850;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
    .switch button.on{color:white;background:var(--color-brand)}
    .switch button:focus-visible{outline:2px solid var(--color-focus);outline-offset:2px}
    .nav{display:flex;align-items:center;gap:10px;color:var(--color-ink-muted);font-size:.74rem;font-weight:800}
    .range{min-width:118px;text-align:center}
    .step{display:grid;width:38px;height:38px;place-items:center;color:var(--color-brand);border:1px solid var(--color-border);border-radius:50%;background:white;font-size:1.25rem;line-height:1;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
    .step:hover{background:var(--color-brand-soft)}
    .step:focus-visible{outline:2px solid var(--color-focus);outline-offset:2px}

    /* Griglia nostra invece del datepicker: ogni giorno e un pulsante, cosi
       risponde al tocco senza dipendere dagli handler della libreria. */
    .picker{margin-top:18px;padding:10px;border:1px solid var(--color-border);border-radius:16px}
    .weekdays,.grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px}
    .weekdays{margin-bottom:5px;color:var(--color-ink-muted);font-size:.58rem;font-weight:900;letter-spacing:.06em;text-align:center;text-transform:uppercase}
    .cell{display:grid;width:100%;min-height:44px;align-content:center;justify-items:center;gap:3px;padding:4px 0;color:inherit;border:0;border-radius:10px;background:none;font:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
    .cell:hover{background:var(--color-surface-muted)}
    .cell:focus-visible{outline:2px solid var(--color-focus);outline-offset:-2px}
    .cell.outside{color:var(--color-ink-muted);opacity:.55}
    .cell.today .cell-day{color:var(--color-brand)}
    .cell.selected{color:white;background:var(--color-brand)}
    .cell.selected .dot{background:white}
    .cell-day{font-family:var(--font-numeric);font-size:.82rem;font-weight:800}
    .dots{display:flex;gap:3px;height:6px}
    .dot{width:6px;height:6px;border-radius:50%;background:var(--color-brand)}
    .dot.tournament{background:var(--color-tournament)}

    .agenda{margin-top:18px}
    .agenda-head{margin:0 0 10px;color:var(--color-ink-muted);font-size:.6rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
    .agenda-day{display:grid;grid-template-columns:52px minmax(0,1fr);gap:12px;padding:9px 0;border-top:1px solid var(--color-border)}
    .agenda-day.is-selected .agenda-date{color:white;background:var(--color-brand)}
    .agenda-day.is-selected .agenda-date b{color:white}
    .agenda-date{display:grid;align-content:start;justify-items:center;padding:6px 0;color:var(--color-ink-muted);border-radius:var(--radius-sm);background:var(--color-surface-muted);font-size:.56rem;font-weight:850;text-transform:uppercase}
    .agenda-date b{color:var(--color-ink);font-family:var(--font-numeric);font-size:1rem}
    .agenda-day ul{display:grid;gap:6px;padding:0;margin:0;list-style:none}
    .agenda-day a{display:flex;min-height:44px;align-items:center;gap:10px;padding:8px 12px;color:#086391;border-left:3px solid var(--color-brand);border-radius:9px;background:#dff4fd;font-size:.74rem;font-weight:800;text-decoration:none}
    .agenda-day a.tournament{color:#755400;border-left-color:var(--color-tournament);background:#fff1c6}
    .agenda-day a:hover{filter:brightness(.97)}
    .agenda-day a:focus-visible{outline:2px solid var(--color-focus);outline-offset:2px}
    .agenda-day time{flex:0 0 auto;opacity:.8;font-family:var(--font-numeric)}
    .agenda-day a span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .agenda-empty{margin:0;padding-top:10px;border-top:1px solid var(--color-border);color:var(--color-ink-muted);font-size:.74rem;font-style:italic}

    .legend{display:flex;flex-wrap:wrap;gap:22px;margin-top:16px;color:var(--color-ink-muted);font-size:.7rem}
    .legend span{display:inline-flex;align-items:center;gap:7px}

    @media(pointer:coarse){
      .step{width:44px;height:44px}
      .switch button{min-height:44px}
      .cell{min-height:48px}
    }

    @media(max-width:560px){
      .panel{padding:18px}
      .head{align-items:center}
      .range{min-width:0}
      .picker{padding:6px}
      .cell-day{font-size:.76rem}
      .agenda-day{grid-template-columns:44px minmax(0,1fr);gap:9px}
    }
  `,
})
export class HomeCalendar {
  readonly events = input<readonly CalendarEvent[]>([]);

  protected readonly weekdays = WEEKDAYS;
  protected readonly view = signal<'week' | 'month'>('week');
  /** Giorno scelto: la vista ci costruisce sopra la settimana o il mese. */
  protected readonly cursor = signal(startOfDay(new Date()));
  protected readonly selectedKey = computed(() => keyOf(this.cursor()));

  private readonly picker = viewChild<ElementRef<HTMLElement>>('picker');
  private lastPeriod = '';
  /** Il click sintetico di Safari segue pointerup: va ignorato una sola volta. */
  private lastTouchActivation = 0;

  protected readonly rangeLabel = computed(() => {
    const cursor = this.cursor();
    if (this.view() === 'month') return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    const first = startOfWeek(cursor);
    const last = addDays(first, 6);
    return first.getMonth() === last.getMonth()
      ? `${first.getDate()} — ${last.getDate()} ${MONTHS[last.getMonth()].slice(0, 3)}`
      : `${first.getDate()} ${MONTHS[first.getMonth()].slice(0, 3)} — ${last.getDate()} ${MONTHS[last.getMonth()].slice(0, 3)}`;
  });

  /** Estremi del periodo attivo: li usano sia le caselle sia l'elenco. */
  private readonly bounds = computed(() => {
    const cursor = this.cursor();
    if (this.view() === 'week') {
      const from = startOfWeek(cursor);
      return { from, to: addDays(from, 7) };
    }
    return {
      from: new Date(cursor.getFullYear(), cursor.getMonth(), 1),
      to: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
    };
  });

  private readonly byDay = computed(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of this.events()) {
      const date = new Date(event.startsAt);
      if (Number.isNaN(date.getTime())) continue;
      const key = keyOf(date);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return map;
  });

  /**
   * Le caselle del periodo: sette in vista settimana, il mese intero completato
   * fino a chiudere le righe in vista mese.
   */
  protected readonly cells = computed<readonly CalendarCell[]>(() => {
    const { from, to } = this.bounds();
    const month = this.cursor().getMonth();
    // Il mese parte dal lunedi della sua prima settimana e arriva alla domenica
    // dell'ultima: cosi le righe restano piene e la griglia non si sfalsa.
    const first = this.view() === 'week' ? from : startOfWeek(from);
    const last = this.view() === 'week' ? addDays(from, 6) : addDays(startOfWeek(addDays(to, -1)), 6);
    const total = Math.round((last.getTime() - first.getTime()) / DAY) + 1;
    const today = keyOf(new Date());
    const selected = this.selectedKey();
    const byDay = this.byDay();

    return Array.from({ length: total }, (_, index) => {
      const date = addDays(first, index);
      const key = keyOf(date);
      const events = byDay.get(key) ?? [];
      return {
        key,
        date,
        day: date.getDate(),
        outside: this.view() === 'month' && date.getMonth() !== month,
        today: key === today,
        selected: key === selected,
        hasMatch: events.some(event => event.kind === 'match'),
        hasTournament: events.some(event => event.kind === 'tournament'),
        label: this.cellLabel(date, events.length),
      };
    });
  });

  protected readonly agenda = computed<readonly AgendaDay[]>(() => {
    const { from, to } = this.bounds();
    const days: AgendaDay[] = [];
    for (const [key, events] of this.byDay()) {
      const day = startOfDay(new Date(events[0].startsAt));
      if (day < from || day >= to) continue;
      days.push({ key, date: day, events });
    }
    return days.sort((first, second) => first.date.getTime() - second.date.getTime());
  });

  constructor() {
    // Cambio di periodo o di scala: la griglia si ricompone, cosi il salto e leggibile.
    afterRenderEffect(() => {
      const period = `${this.view()}:${this.cursor().getTime()}`;
      const host = this.picker()?.nativeElement;
      if (!host || period === this.lastPeriod) return;
      const first = !this.lastPeriod;
      this.lastPeriod = period;
      if (first || !motionAllowed()) return;
      untracked(() => void this.animateCells(host));
    });
  }

  private async animateCells(host: HTMLElement): Promise<void> {
    const { gsap } = await loadMotion();
    const cells = host.querySelectorAll('.cell');
    if (cells.length) gsap.from(cells, { opacity: 0, y: 6, duration: 0.28, ease: 'power2.out', stagger: 0.008, overwrite: true });
  }

  private cellLabel(date: Date, count: number): string {
    const weekday = WEEKDAYS[(date.getDay() + 6) % 7].long;
    const when = `${weekday} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
    if (count === 0) return `${when}, nessun impegno`;
    return count === 1 ? `${when}, 1 impegno` : `${when}, ${count} impegni`;
  }

  protected setView(view: 'week' | 'month'): void {
    this.view.set(view);
  }

  protected setViewFromPointer(event: PointerEvent, view: 'week' | 'month'): void {
    if (!this.handleDirectTouch(event)) return;
    this.setView(view);
  }

  protected setViewFromClick(view: 'week' | 'month'): void {
    if (!this.isFollowUpClick()) this.setView(view);
  }

  protected shift(direction: number): void {
    this.cursor.update(current => this.view() === 'week'
      ? addDays(current, direction * 7)
      : startOfDay(new Date(current.getFullYear(), current.getMonth() + direction, 1)));
  }

  protected shiftFromPointer(event: PointerEvent, direction: number): void {
    if (!this.handleDirectTouch(event)) return;
    this.shift(direction);
  }

  protected shiftFromClick(direction: number): void {
    if (!this.isFollowUpClick()) this.shift(direction);
  }

  /** Tocco su una casella: sposta il giorno scelto, e con lui il periodo. */
  protected pick(value: Date): void {
    this.cursor.set(startOfDay(value));
  }

  protected pickFromPointer(event: PointerEvent, value: Date): void {
    if (!this.handleDirectTouch(event)) return;
    this.pick(value);
  }

  protected pickFromClick(value: Date): void {
    if (!this.isFollowUpClick()) this.pick(value);
  }

  /** Touch e pen usano pointerup; mouse e tastiera continuano a usare click. */
  private handleDirectTouch(event: PointerEvent): boolean {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return false;
    event.preventDefault();
    this.lastTouchActivation = Date.now();
    return true;
  }

  private isFollowUpClick(): boolean {
    return Date.now() - this.lastTouchActivation < 800;
  }
}
