import { DatePipe } from '@angular/common';
import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, input, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { gsap } from 'gsap';
import { RouterLink } from '@angular/router';
import { DatePicker, DatePickerMonthChangeEvent } from 'primeng/datepicker';
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

/** Metadati della cella giorno passati dal datepicker PrimeNG. */
interface DayMeta {
  day: number;
  month: number;
  year: number;
  otherMonth?: boolean;
  today?: boolean;
  selectable?: boolean;
}

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

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

/**
 * Programma personale costruito sul datepicker di PrimeNG, che porta con se la
 * griglia italiana da lunedi a domenica e la navigazione dei mesi. Le celle
 * segnano con un punto i giorni impegnati; l'elenco sotto racconta gli impegni
 * del periodo scelto, settimana o mese. Sul telefono e l'elenco a fare il
 * lavoro: le celle restano piccole e leggibili invece di ospitare etichette
 * schiacciate.
 */
@Component({
  selector: 'app-home-calendar',
  imports: [DatePipe, FormsModule, RouterLink, DatePicker],
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
            <button type="button" [class.on]="view() === 'week'" [attr.aria-pressed]="view() === 'week'" (click)="setView('week')">Settimana</button>
            <button type="button" [class.on]="view() === 'month'" [attr.aria-pressed]="view() === 'month'" (click)="setView('month')">Mese</button>
          </div>

          <div class="nav">
            <button type="button" class="step" (click)="shift(-1)" [attr.aria-label]="view() === 'week' ? 'Settimana precedente' : 'Mese precedente'">‹</button>
            <span class="range">{{ rangeLabel() }}</span>
            <button type="button" class="step" (click)="shift(1)" [attr.aria-label]="view() === 'week' ? 'Settimana successiva' : 'Mese successivo'">›</button>
          </div>
        </div>
      </div>

      <div class="picker" #picker>
        <p-datepicker
          [inline]="true"
          [ngModel]="cursor()"
          (ngModelChange)="pick($event)"
          [firstDayOfWeek]="1"
          [showOtherMonths]="true"
          [selectOtherMonths]="true"
          (onMonthChange)="jumpToMonth($event)"
          styleClass="calendar-picker">
          <ng-template #date let-day>
            <span class="cell" [class.in-range]="inRange(day)">
              <span class="cell-day">{{ day.day }}</span>
              <span class="dots" aria-hidden="true">
                @if (hasKind(day, 'match')) { <i class="dot match"></i> }
                @if (hasKind(day, 'tournament')) { <i class="dot tournament"></i> }
              </span>
            </span>
          </ng-template>
        </p-datepicker>
      </div>

      <div class="agenda">
        <p class="agenda-head">{{ view() === 'week' ? 'Impegni della settimana' : 'Impegni del mese' }}</p>
        @for (day of agenda(); track day.key) {
          <div class="agenda-day">
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
    :host{display:block}
    .panel{padding:24px;border:1px solid var(--color-border);border-radius:var(--radius-lg);background:rgb(255 255 255/.94);box-shadow:0 18px 50px rgb(7 54 79/.08)}
    .head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px}
    .eyebrow{display:inline-flex;color:var(--color-brand);font-size:.62rem;font-weight:900;letter-spacing:.18em;text-transform:uppercase}
    h2{margin:5px 0 0;font-family:var(--display-font);font-size:1.65rem;line-height:1.08;letter-spacing:-.035em}

    .controls{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
    .switch{display:inline-flex;padding:3px;border:1px solid var(--color-border);border-radius:var(--radius-pill);background:var(--color-surface-muted)}
    .switch button{min-height:38px;padding:0 14px;color:var(--color-ink-muted);border:0;border-radius:var(--radius-pill);background:none;font:inherit;font-size:.72rem;font-weight:850;cursor:pointer}
    .switch button.on{color:white;background:var(--color-brand)}
    .switch button:focus-visible{outline:2px solid var(--color-focus);outline-offset:2px}
    .nav{display:flex;align-items:center;gap:10px;color:var(--color-ink-muted);font-size:.74rem;font-weight:800}
    .range{min-width:118px;text-align:center}
    .step{display:grid;width:38px;height:38px;place-items:center;color:var(--color-brand);border:1px solid var(--color-border);border-radius:50%;background:white;font-size:1.25rem;line-height:1;cursor:pointer}
    .step:hover{background:var(--color-brand-soft)}
    .step:focus-visible{outline:2px solid var(--color-focus);outline-offset:2px}

    .picker{margin-top:18px}
    .cell{display:grid;width:100%;justify-items:center;gap:3px}
    .cell-day{font-family:var(--font-numeric);font-size:.82rem;font-weight:800}
    .dots{display:flex;gap:3px;height:6px}
    .dot{width:6px;height:6px;border-radius:50%;background:var(--color-brand)}
    .dot.tournament{background:var(--color-tournament)}

    .agenda{margin-top:18px}
    .agenda-head{margin:0 0 10px;color:var(--color-ink-muted);font-size:.6rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
    .agenda-day{display:grid;grid-template-columns:52px minmax(0,1fr);gap:12px;padding:9px 0;border-top:1px solid var(--color-border)}
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

    /* Il datepicker inline deve occupare la card, non la sua larghezza naturale. */
    :host ::ng-deep .calendar-picker{width:100%}
    :host ::ng-deep .calendar-picker .p-datepicker-panel{width:100%;max-width:none;border:1px solid var(--color-border);border-radius:16px}
    :host ::ng-deep .calendar-picker table{width:100%;table-layout:fixed}
    :host ::ng-deep .calendar-picker td{padding:2px}
    :host ::ng-deep .calendar-picker td>span{width:100%;min-height:40px;height:auto;border-radius:10px}
    :host ::ng-deep .calendar-picker .p-datepicker-weekday{font-size:.58rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase}
    :host ::ng-deep .calendar-picker td>span:has(.in-range){background:var(--color-brand-soft)}
    :host ::ng-deep .calendar-picker td>span.p-datepicker-day-selected:has(.in-range){color:white;background:var(--color-brand)}
    :host ::ng-deep .calendar-picker td>span.p-datepicker-day-selected .dot{background:white}

    @media(pointer:coarse){
      .step{width:44px;height:44px}
      .switch button{min-height:44px}
      :host ::ng-deep .calendar-picker td>span{min-height:44px}
    }

    @media(max-width:560px){
      .panel{padding:18px}
      .head{align-items:center}
      .range{min-width:0}
      .cell-day{font-size:.76rem}
      .agenda-day{grid-template-columns:44px minmax(0,1fr);gap:9px}
      :host ::ng-deep .calendar-picker .p-datepicker-panel{padding:8px}
      :host ::ng-deep .calendar-picker td{padding:1px}
    }
  `,
})
export class HomeCalendar {
  readonly events = input<readonly CalendarEvent[]>([]);

  protected readonly view = signal<'week' | 'month'>('week');
  /** Giorno di riferimento: la vista ci costruisce sopra settimana o mese. */
  protected readonly cursor = signal(startOfDay(new Date()));

  private readonly picker = viewChild<ElementRef<HTMLElement>>('picker');
  private lastPeriod = '';

  protected readonly rangeLabel = computed(() => {
    const cursor = this.cursor();
    if (this.view() === 'month') return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    const first = startOfWeek(cursor);
    const last = addDays(first, 6);
    return first.getMonth() === last.getMonth()
      ? `${first.getDate()} — ${last.getDate()} ${MONTHS[last.getMonth()].slice(0, 3)}`
      : `${first.getDate()} ${MONTHS[first.getMonth()].slice(0, 3)} — ${last.getDate()} ${MONTHS[last.getMonth()].slice(0, 3)}`;
  });

  /** Estremi del periodo attivo: li usano sia le celle sia l'elenco. */
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
      const key = dayKey(date.getFullYear(), date.getMonth(), date.getDate());
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return map;
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
      untracked(() => {
        const cells = host.querySelectorAll('td');
        if (cells.length) gsap.from(cells, { opacity: 0, y: 6, duration: 0.28, ease: 'power2.out', stagger: 0.008, overwrite: true });
      });
    });
  }

  protected setView(view: 'week' | 'month'): void {
    this.view.set(view);
  }

  protected shift(direction: number): void {
    this.cursor.update(current => this.view() === 'week'
      ? addDays(current, direction * 7)
      : startOfDay(new Date(current.getFullYear(), current.getMonth() + direction, 1)));
  }

  /** Clic su una cella: sposta il periodo attivo su quel giorno. */
  protected pick(value: Date | null): void {
    if (value instanceof Date && !Number.isNaN(value.getTime())) this.cursor.set(startOfDay(value));
  }

  /** Frecce del datepicker: tengono il periodo allineato al mese mostrato. */
  protected jumpToMonth(event: DatePickerMonthChangeEvent): void {
    if (event.month === undefined || event.year === undefined) return;
    const month = event.month - 1;
    const current = this.cursor();
    if (current.getMonth() === month && current.getFullYear() === event.year) return;
    this.cursor.set(startOfDay(new Date(event.year, month, 1)));
  }

  protected hasKind(day: DayMeta, kind: CalendarEventKind): boolean {
    return (this.byDay().get(dayKey(day.year, day.month, day.day)) ?? []).some(event => event.kind === kind);
  }

  protected inRange(day: DayMeta): boolean {
    const date = new Date(day.year, day.month, day.day);
    const { from, to } = this.bounds();
    return date >= from && date < to;
  }
}
