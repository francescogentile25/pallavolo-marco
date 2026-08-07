import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

export type CalendarEventKind = 'match' | 'tournament';

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  /** Istante ISO di inizio. */
  startsAt: string;
  label: string;
  link: readonly string[];
}

interface CalendarCell {
  key: string;
  date: Date;
  dayNumber: number;
  weekdayLabel: string;
  today: boolean;
  outside: boolean;
  events: readonly CalendarEvent[];
}

const WEEKDAYS = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** La settimana comincia di lunedi, come nel calendario italiano. */
function startOfWeek(value: Date): Date {
  const date = startOfDay(value);
  const shift = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - shift);
  return date;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function dayKey(value: Date): string {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

/**
 * Programma personale su due scale: la settimana per decidere cosa fare adesso,
 * il mese per vedere quanto si gioca. Le due viste condividono lo stesso cursore,
 * cosi passando da una all'altra non si perde il periodo che si stava guardando.
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

      @if (view() === 'month') {
        <ol class="weekday-row" aria-hidden="true">
          @for (name of weekdays; track name) { <li>{{ name }}</li> }
        </ol>
      }

      <div class="grid" [class.month]="view() === 'month'">
        @for (cell of cells(); track cell.key) {
          <div class="day" [class.today]="cell.today" [class.outside]="cell.outside">
            @if (view() === 'week') { <span class="day-name">{{ cell.weekdayLabel }}</span> }
            <strong class="day-number">{{ cell.dayNumber }}</strong>

            @for (event of cell.events; track event.id) {
              <a class="event" [class.tournament]="event.kind === 'tournament'" [routerLink]="event.link"
                 [attr.aria-label]="event.label + ' · ' + (event.startsAt | date: 'EEEE d MMMM, HH:mm':'':'it')">
                <time [attr.datetime]="event.startsAt">{{ event.startsAt | date: 'HH:mm' }}</time>
                <span>{{ event.label }}</span>
              </a>
            }
          </div>
        }
      </div>

      <div class="legend">
        <span><i class="dot match" aria-hidden="true"></i> Le mie partite</span>
        <span><i class="dot tournament" aria-hidden="true"></i> I miei tornei</span>
        @if (!events().length) { <span class="empty">Nessun impegno in programma.</span> }
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

    .weekday-row{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:0;padding:0;margin:18px 0 6px;list-style:none}
    .weekday-row li{color:var(--color-ink-muted);font-size:.56rem;font-weight:900;letter-spacing:.09em;text-align:center}

    .grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));margin-top:20px;overflow:hidden;border:1px solid var(--color-border);border-radius:16px}
    .grid.month{margin-top:0}
    .day{min-height:155px;padding:13px 8px;border-right:1px solid var(--color-border);background:white;text-align:center}
    .day:nth-child(7n){border-right:0}
    .grid.month .day{min-height:96px;border-bottom:1px solid var(--color-border)}
    .grid.month .day:nth-last-child(-n+7){border-bottom:0}
    .day.today{background:linear-gradient(180deg,#f0f9fd,#e8f6fb);box-shadow:inset 0 3px 0 var(--color-brand)}
    .day.outside{background:var(--color-surface-muted)}
    .day.outside .day-number{color:var(--color-ink-muted);opacity:.55}

    .day-name{display:block;color:var(--color-ink-muted);font-size:.56rem;font-weight:900;letter-spacing:.09em}
    .day-number{display:block;margin-top:6px;font-family:var(--font-numeric);font-size:1.05rem;font-weight:900}

    .event{display:flex;flex-direction:column;align-items:flex-start;gap:2px;margin-top:9px;padding:8px 7px;color:#086391;border-left:3px solid var(--color-brand);border-radius:9px;background:#dff4fd;font-size:.56rem;font-weight:850;line-height:1.25;text-align:left;text-decoration:none}
    .event span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
    .event time{opacity:.75;font-family:var(--font-numeric)}
    .event.tournament{color:#755400;border-left-color:var(--color-tournament);background:#fff1c6}
    .event:hover{filter:brightness(.97)}
    .event:focus-visible{outline:2px solid var(--color-focus);outline-offset:1px}

    .legend{display:flex;flex-wrap:wrap;gap:22px;margin-top:17px;color:var(--color-ink-muted);font-size:.7rem}
    .legend span{display:inline-flex;align-items:center;gap:7px}
    .dot{width:9px;height:9px;border-radius:50%;background:var(--color-brand)}
    .dot.tournament{background:var(--color-tournament)}
    .empty{font-style:italic}

    /* Sul touch le pastiglie del calendario devono restare toccabili. */
    @media(pointer:coarse){
      .event{min-height:44px;justify-content:center}
      .step{width:44px;height:44px}
      .switch button{min-height:44px}
    }

    @media(max-width:840px){
      .panel{padding:18px}
      .grid{overflow-x:auto;grid-template-columns:repeat(7,100px)}
      .grid.month{grid-template-columns:repeat(7,minmax(0,1fr))}
      .grid.month .day{min-height:74px;padding:8px 4px}
      .grid.month .event{padding:5px 4px;font-size:.5rem}
      .grid.month .event time{display:none}
      .weekday-row{grid-template-columns:repeat(7,minmax(0,1fr))}
      .range{min-width:0}
    }
  `,
})
export class HomeCalendar {
  readonly events = input<readonly CalendarEvent[]>([]);

  protected readonly weekdays = WEEKDAYS;
  protected readonly view = signal<'week' | 'month'>('week');
  /** Giorno di riferimento: la vista ci costruisce sopra settimana o mese. */
  protected readonly cursor = signal(startOfDay(new Date()));

  protected readonly rangeLabel = computed(() => {
    const cursor = this.cursor();
    if (this.view() === 'month') return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    const first = startOfWeek(cursor);
    const last = addDays(first, 6);
    const sameMonth = first.getMonth() === last.getMonth();
    return sameMonth
      ? `${first.getDate()} — ${last.getDate()} ${MONTHS[last.getMonth()].slice(0, 3)}`
      : `${first.getDate()} ${MONTHS[first.getMonth()].slice(0, 3)} — ${last.getDate()} ${MONTHS[last.getMonth()].slice(0, 3)}`;
  });

  protected readonly cells = computed<readonly CalendarCell[]>(() => {
    const today = startOfDay(new Date());
    const grouped = this.eventsByDay();
    const cursor = this.cursor();
    const month = cursor.getMonth();
    const first = this.view() === 'week' ? startOfWeek(cursor) : startOfWeek(new Date(cursor.getFullYear(), month, 1));
    const length = this.view() === 'week' ? 7 : this.monthCellCount(cursor);

    return Array.from({ length }, (_, index) => {
      const date = addDays(first, index);
      const key = dayKey(date);
      return {
        key,
        date,
        dayNumber: date.getDate(),
        weekdayLabel: WEEKDAYS[(date.getDay() + 6) % 7],
        today: key === dayKey(today),
        outside: this.view() === 'month' && date.getMonth() !== month,
        events: grouped.get(key) ?? [],
      };
    });
  });

  protected setView(view: 'week' | 'month'): void {
    this.view.set(view);
  }

  protected shift(direction: number): void {
    this.cursor.update(current => {
      if (this.view() === 'week') return addDays(current, direction * 7);
      const next = new Date(current.getFullYear(), current.getMonth() + direction, 1);
      return startOfDay(next);
    });
  }

  private eventsByDay(): Map<string, CalendarEvent[]> {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of this.events()) {
      const date = new Date(event.startsAt);
      if (Number.isNaN(date.getTime())) continue;
      const key = dayKey(date);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return map;
  }

  /** Griglia sempre chiusa a settimane intere: cinque o sei righe secondo il mese. */
  private monthCellCount(cursor: Date): number {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7;
    return Math.ceil((offset + daysInMonth) / 7) * 7;
  }
}
