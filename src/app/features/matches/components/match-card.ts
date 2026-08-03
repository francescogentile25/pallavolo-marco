import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BeachMatch } from '../models/match.model';
import {
  availableSpots,
  MATCH_GENDER_LABELS,
  MATCH_STATUS_LABELS,
  levelRangeLabel,
} from '../matches.utils';

@Component({
  selector: 'app-match-card',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="match-card">
      <div class="topline">
        <span class="status" [class]="'status status-' + match().status">
          {{ statusLabels[match().status] }}
        </span>
        <button type="button" class="more" aria-label="Apri azioni partita" (click)="actions.emit(match())">
          <i class="pi pi-ellipsis-v" aria-hidden="true"></i>
        </button>
      </div>
      <a class="card-link" [routerLink]="['/partite', match().id]">
        <p class="date"><i class="pi pi-calendar" aria-hidden="true"></i> {{ match().starts_at | date: 'EEE d MMM, HH:mm' : undefined : 'it-IT' }}</p>
        <h2>{{ match().court.venue.name }}</h2>
        <p class="location">{{ match().court.name }} · {{ match().court.venue.city }}</p>
        <div class="facts">
          <span><i class="pi pi-users" aria-hidden="true"></i> {{ genderLabels[match().gender] }}</span>
          <span><i class="pi pi-chart-line" aria-hidden="true"></i> {{ levelRange(match()) }}</span>
          <span><i class="pi pi-clock" aria-hidden="true"></i> {{ match().duration_minutes ? match().duration_minutes + ' min' : 'durata libera' }}</span>
        </div>
        <div class="availability">
          <div class="avatars" aria-hidden="true">
            @for (participant of match().participants.slice(0, 3); track participant.profile_id; let index = $index) {
              <span>{{ index + 1 }}</span>
            }
          </div>
          <strong>{{ spots(match()) }} {{ spots(match()) === 1 ? 'posto libero' : 'posti liberi' }}</strong>
          <i class="pi pi-arrow-right" aria-hidden="true"></i>
        </div>
      </a>
    </article>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .match-card { position: relative; overflow: hidden; border: 1px solid var(--color-border); border-radius: 18px; background: var(--color-surface); box-shadow: 0 10px 28px rgb(20 24 26 / .045); transition: transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out); }
    .match-card:hover { transform: translateY(-3px); box-shadow: 0 16px 34px rgb(20 24 26 / .09); }
    .topline { position: absolute; z-index: 1; top: 14px; right: 14px; left: 16px; display: flex; align-items: center; justify-content: space-between; pointer-events: none; }
    .status { padding: 5px 8px; border-radius: 8px; color: var(--color-success); background: var(--color-success-soft); font-size: .66rem; font-weight: 900; text-transform: uppercase; }
    .status-full, .status-cancelled { color: var(--color-danger); background: var(--color-danger-soft); }
    .status-in_progress { color: var(--color-tournament); background: var(--color-tournament-soft); }
    .status-completed { color: var(--color-ink-muted); background: var(--color-surface-muted); }
    .more { display: grid; width: 40px; height: 40px; place-items: center; border: 0; border-radius: 12px; color: var(--color-ink); background: var(--color-surface-muted); cursor: pointer; pointer-events: auto; }
    .card-link { display: block; padding: 66px 18px 18px; color: inherit; text-decoration: none; }
    .date { margin: 0 0 9px; color: var(--color-brand-strong); font-size: .75rem; font-weight: 850; text-transform: capitalize; }
    .date i { margin-right: 5px; }
    h2 { margin: 0; font: 900 1.28rem/1.1 var(--display-font); letter-spacing: -.025em; }
    .location { margin: 5px 0 16px; color: var(--color-ink-muted); font-size: .78rem; }
    .facts { display: flex; flex-wrap: wrap; gap: 6px; }
    .facts span { padding: 6px 8px; border-radius: 9px; background: var(--color-surface-muted); font-size: .67rem; font-weight: 750; }
    .facts i { margin-right: 4px; color: var(--color-brand-strong); }
    .availability { display: flex; min-height: 44px; align-items: center; gap: 10px; padding-top: 16px; margin-top: 17px; border-top: 1px solid var(--color-border); font-size: .72rem; }
    .availability > i { margin-left: auto; }
    .avatars { display: flex; padding-left: 6px; }
    .avatars span { display: grid; width: 28px; height: 28px; place-items: center; margin-left: -6px; border: 2px solid white; border-radius: 50%; color: white; background: var(--color-brand-strong); font-size: .6rem; }
    a:focus-visible, button:focus-visible { outline: 3px solid var(--color-focus); outline-offset: -3px; }
  `,
})
export class MatchCard {
  match = input.required<BeachMatch>();
  actions = output<BeachMatch>();
  protected readonly statusLabels = MATCH_STATUS_LABELS;
  protected readonly genderLabels = MATCH_GENDER_LABELS;
  protected readonly spots = availableSpots;
  protected readonly levelRange = levelRangeLabel;
}
