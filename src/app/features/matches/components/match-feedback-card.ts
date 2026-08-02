import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { MatchParticipant } from '../models/match.model';

@Component({
  selector: 'app-match-feedback-card',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-no-show]': 'participant().attendance_status === "no_show"' },
  template: `
    <div class="identity"><span class="avatar" aria-hidden="true">{{ initials() }}</span><div><strong>{{ participant().nome }} {{ participant().cognome }}</strong><small>@if (participant().attendance_status === 'no_show') { Assente · no-show } @else { Livello {{ participant().livello }} }</small></div></div>
    @if (participant().attendance_status !== 'no_show') {
      @if (participant().my_rating; as rating) { <p class="rated"><i class="pi pi-check-circle" aria-hidden="true"></i> Valutazione inviata: <strong>{{ rating }}/7</strong></p> }
      @else { <fieldset [disabled]="busy()"><legend>Valuta il livello da 1 a 7</legend><div class="scores">@for (score of scores; track score) { <button type="button" [attr.aria-label]="'Valuta ' + score + ' su 7'" (click)="rating.emit(score)">{{ score }}</button> }</div></fieldset> }
      @if (canReportNoShow()) { <p-button severity="danger" variant="text" size="small" label="Segnala no-show" icon="pi pi-user-minus" [loading]="busy()" (onClick)="requestNoShow()" /> }
    }
  `,
  styles: `:host{display:grid;gap:12px;padding:14px;border:1px solid var(--color-border);border-radius:18px;background:var(--color-surface-muted)}:host.is-no-show{opacity:.68}.identity{display:flex;align-items:center;gap:10px}.identity>div{display:grid}.identity small{color:var(--color-ink-muted);font-size:.68rem}.avatar{display:grid;width:40px;height:40px;place-items:center;border-radius:13px;color:white;background:var(--color-brand-strong);font-size:.68rem;font-weight:900}fieldset{padding:0;border:0;margin:0}legend{margin-bottom:7px;color:var(--color-ink-muted);font-size:.68rem;font-weight:800}.scores{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}.scores button{min-width:0;min-height:40px;border:1px solid var(--color-border);border-radius:10px;color:var(--color-brand-strong);background:white;font-weight:900;cursor:pointer}.scores button:hover{color:white;background:var(--color-brand-strong)}.scores button:focus-visible{outline:3px solid var(--color-focus);outline-offset:2px}.rated{margin:0;color:var(--color-success);font-size:.76rem}`,
})
export class MatchFeedbackCard {
  participant = input.required<MatchParticipant>(); canReportNoShow = input(false); busy = input(false);
  rating = output<number>(); noShow = output<string>(); protected readonly scores = [1, 2, 3, 4, 5, 6, 7];
  protected initials(): string { const p = this.participant(); return `${p.nome.charAt(0)}${p.cognome.charAt(0)}`.toUpperCase(); }
  protected requestNoShow(): void { const reason = window.prompt('Motivo del no-show (sarà registrato nello storico):', 'Assenza non comunicata')?.trim(); if (reason) this.noShow.emit(reason); }
}
