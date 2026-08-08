import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { MatchParticipant } from '../models/match.model';

@Component({
  selector: 'app-match-feedback-card',
  imports: [Button, Dialog, FormsModule, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-no-show]': 'participant().attendance_status === "no_show"' },
  template: `
    <div class="identity"><span class="avatar" aria-hidden="true">{{ initials() }}</span><div><strong>{{ participant().nome }} {{ participant().cognome }}</strong><small>@if (participant().attendance_status === 'no_show') { Assente · no-show } @else { Livello {{ participant().livello }} }</small></div></div>
    @if (participant().attendance_status !== 'no_show') {
      @if (participant().my_rating; as rating) { <p class="rated"><i class="pi pi-check-circle" aria-hidden="true"></i> Valutazione inviata: <strong>{{ rating }}/7</strong></p> }
      @else { <fieldset [disabled]="busy() || locked()"><legend>{{ locked() ? 'Voti aperti a partita conclusa' : 'Valuta il livello da 1 a 7' }}</legend><div class="scores">@for (score of scores; track score) { <button type="button" [attr.aria-label]="'Valuta ' + score + ' su 7'" (click)="rating.emit(score)">{{ score }}</button> }</div></fieldset> }
      @if (canReportNoShow()) { <p-button severity="danger" variant="text" size="small" label="Segnala no-show" icon="pi pi-user-minus" [loading]="busy()" (onClick)="requestNoShow()" /> }
    }
    <p-dialog header="Segnala no-show" styleClass="app-form-dialog" [visible]="noShowDialogOpen()" (visibleChange)="noShowDialogOpen.set($event)" [modal]="true" [draggable]="false" [resizable]="false" [dismissableMask]="true" appendTo="body">
      <div class="dialog-field">
        <label for="no-show-reason">Motivo della segnalazione</label>
        <input id="no-show-reason" pInputText [ngModel]="noShowReason()" (ngModelChange)="noShowReason.set($event)" maxlength="240" autocomplete="off" />
        <small>Il motivo sarà registrato nello storico di affidabilità.</small>
      </div>
      <ng-template #footer>
        <p-button label="Annulla" severity="secondary" [text]="true" (onClick)="noShowDialogOpen.set(false)" />
        <p-button label="Continua" icon="pi pi-arrow-right" iconPos="right" [disabled]="!noShowReason().trim()" (onClick)="submitNoShow()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `:host{display:grid;gap:12px;padding:14px;border:1px solid var(--color-border);border-radius:var(--radius-lg);background:var(--color-surface-muted)}:host.is-no-show{opacity:.68}.identity{display:flex;align-items:center;gap:10px}.identity>div{display:grid}.identity small{color:var(--color-ink-muted);font-size:.68rem}.avatar{display:grid;width:40px;height:40px;place-items:center;border-radius:var(--radius);color:white;background:var(--color-brand-strong);font-size:.68rem;font-weight:900}fieldset{padding:0;border:0;margin:0}legend{margin-bottom:7px;color:var(--color-ink-muted);font-size:.68rem;font-weight:800}.scores{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}.scores button{min-width:0;min-height:40px;border:1px solid var(--color-border);border-radius:var(--radius);color:var(--color-brand-strong);background:white;font-weight:900;cursor:pointer}.scores button:hover{color:white;background:var(--color-brand-strong)}.scores button:focus-visible{outline:3px solid var(--color-focus);outline-offset:2px}fieldset:disabled .scores button{color:var(--color-ink-muted);background:var(--color-surface-muted);cursor:not-allowed}.rated{margin:0;color:var(--color-success);font-size:.76rem}`,
})
export class MatchFeedbackCard {
  participant = input.required<MatchParticipant>(); canReportNoShow = input(false); busy = input(false);
  /** Partita ancora in corso: le schede si vedono ma i voti restano chiusi. */
  locked = input(false);
  rating = output<number>(); noShow = output<string>(); protected readonly scores = [1, 2, 3, 4, 5, 6, 7];
  protected readonly noShowDialogOpen = signal(false);
  protected readonly noShowReason = signal('Assenza non comunicata');
  protected initials(): string { const p = this.participant(); return `${p.nome.charAt(0)}${p.cognome.charAt(0)}`.toUpperCase(); }
  protected requestNoShow(): void { this.noShowReason.set('Assenza non comunicata'); this.noShowDialogOpen.set(true); }
  protected submitNoShow(): void { const reason = this.noShowReason().trim(); if (!reason) return; this.noShowDialogOpen.set(false); this.noShow.emit(reason); }
}
