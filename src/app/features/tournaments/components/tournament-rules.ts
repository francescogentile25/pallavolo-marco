import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { Tournament, TournamentRules } from '../models/tournament.model';
import { TournamentsStore } from '../store/tournaments.store';

/** Regole di gioco del torneo: modificabili anche a torneo iniziato, senza riscrivere i risultati. */
@Component({
  selector: 'app-tournament-rules',
  imports: [Button, Checkbox, FormsModule, InputNumber, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rule-card">
      <div class="toolbar"><div><strong>Regole attive</strong><span>La formula lunga vale solo per l’ultima partita di ogni tabellone; tutte le altre seguono i set delle partite. Puoi cambiarle anche a torneo iniziato: non riscrivono risultati passati.</span></div></div>
      <div class="rule-grid">
        <label>Coppie massime<p-inputnumber [ngModel]="rules().maxTeams" (ngModelChange)="updateRule('maxTeams', $event ?? 2)" [min]="2" [max]="64" [showButtons]="true" fluid /></label>
        <label>Set nelle partite<p-select [ngModel]="rules().groupBestOf" (ngModelChange)="updateRule('groupBestOf', $event)" [options]="bestOfOptions" optionLabel="label" optionValue="value" fluid /></label>
        <label>Set nella finale<p-select [ngModel]="rules().knockoutBestOf" (ngModelChange)="updateRule('knockoutBestOf', $event)" [options]="bestOfOptions" optionLabel="label" optionValue="value" fluid /></label>
        <label>Punti set partite<p-inputnumber [ngModel]="rules().groupSetPoints" (ngModelChange)="updateRule('groupSetPoints', $event ?? 21)" [min]="1" [max]="99" fluid /></label>
        <label>Punti set finale<p-inputnumber [ngModel]="rules().knockoutSetPoints" (ngModelChange)="updateRule('knockoutSetPoints', $event ?? 21)" [min]="1" [max]="99" fluid /></label>
      </div>
      <div class="phases">
        <p class="phases-title">Fasi previste</p>
        <div class="phases-checks">
          <p-checkbox inputId="rules-groups" [ngModel]="hasGroups()" (ngModelChange)="setPhase('groups', $event)" [binary]="true" />
          <label for="rules-groups">Gironi<small>Quanti e con chi si decide in corsa, non prima del torneo.</small></label>
          <p-checkbox inputId="rules-knockout" [ngModel]="hasKnockout()" (ngModelChange)="setPhase('knockout', $event)" [binary]="true" />
          <label for="rules-knockout">Fase a eliminazione diretta<small>Uno o piu tabelloni costruiti liberamente.</small></label>
        </div>
      </div>
      <div class="no-draw"><i class="pi pi-shield" aria-hidden="true"></i><div><strong>Nessun pareggio</strong><span>Ogni set e ogni partita devono avere un vincitore.</span></div></div>
      <div class="checks">
        <p-checkbox inputId="rules-win-two" [ngModel]="rules().winByTwo" (ngModelChange)="updateRule('winByTwo', $event)" [binary]="true" />
        <label for="rules-win-two">Vittoria con due punti di scarto</label>
        <p-checkbox inputId="rules-confirm" [ngModel]="rules().resultConfirmationRequired" (ngModelChange)="updateRule('resultConfirmationRequired', $event)" [binary]="true" />
        <label for="rules-confirm">Conferma risultato richiesta</label>
      </div>
      <footer class="rule-actions"><p-button label="Applica le regole" icon="pi pi-check" [loading]="store.saving()" (onClick)="saveRules()" /></footer>
    </section>
  `,
  styles: `
    :host{display:block}
    .rule-card{padding:20px;border:1px solid #d9cdb4;border-radius:var(--radius-lg);background:#faf7f0}
    .toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 0 16px}
    .toolbar>div{display:grid;gap:3px}
    .toolbar strong{font-size:.9rem}
    .toolbar span{color:var(--color-ink-muted);font-size:.68rem}
    .rule-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
    .rule-grid label{display:grid;min-width:0;gap:7px;color:var(--color-ink);font-size:.68rem;font-weight:850}
    /* "Al meglio di 3" allargava il campo oltre la colonna e copriva quello
       accanto: il testo scelto ora si tronca dentro il suo spazio. */
    .rule-grid ::ng-deep .p-select,.rule-grid ::ng-deep .p-inputnumber{max-width:100%}
    .rule-grid ::ng-deep .p-select-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rule-grid ::ng-deep .p-inputnumber-input{min-width:0}
    .phases{padding:14px;margin-top:14px;border:1px solid #d9cdb4;border-radius:var(--radius);background:#fff}
    .phases-title{margin:0 0 10px;color:#5b6a72;font-size:.62rem;font-weight:850;letter-spacing:.09em;text-transform:uppercase}
    .phases-checks{display:grid;grid-template-columns:auto 1fr;align-items:start;gap:10px}
    .phases-checks label{display:grid;gap:2px;font-size:.72rem;font-weight:800}
    .phases-checks small{color:var(--color-ink-muted);font-size:.62rem;font-weight:600}
    .no-draw{display:flex;align-items:center;gap:11px;padding:13px;margin-top:14px;color:#14348c;border-radius:var(--radius);background:#e3e8ff}
    .no-draw>i{font-size:1.2rem}
    .no-draw div{display:grid;gap:2px}
    .no-draw span{font-size:.65rem}
    .checks{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:9px;padding:16px 2px;font-size:.68rem}
    .rule-actions{display:flex;justify-content:flex-end;padding-top:14px;border-top:1px solid #d9cdb4}
    @media(min-width:760px){.rule-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `,
})
export class TournamentRulesEditor implements OnInit {
  readonly tournament = input.required<Tournament>();
  protected readonly store = inject(TournamentsStore);
  protected readonly rules = signal<TournamentRules>(this.emptyRules());

  protected readonly bestOfOptions = [{ label: 'Un set', value: 1 }, { label: 'Al meglio di 3', value: 3 }, { label: 'Al meglio di 5', value: 5 }];

  ngOnInit(): void { this.rules.set(this.rulesFromTournament(this.tournament())); }

  protected readonly hasGroups = computed(() => this.rules().format !== 'knockout');
  protected readonly hasKnockout = computed(() => this.rules().format !== 'groups');

  /** Le due caselle mappano sul formato; almeno una fase deve restare attiva. */
  protected setPhase(phase: 'groups' | 'knockout', enabled: boolean): void {
    const groups = phase === 'groups' ? enabled : this.hasGroups();
    const knockout = phase === 'knockout' ? enabled : this.hasKnockout();
    if (!groups && !knockout) return;
    this.updateRule('format', groups && knockout ? 'mixed' : groups ? 'groups' : 'knockout');
  }

  protected updateRule<K extends keyof TournamentRules>(key: K, value: TournamentRules[K]): void {
    this.rules.update(rules => ({ ...rules, [key]: value }));
  }

  protected saveRules(): void { void this.store.updateRules(this.tournament().id, this.rules()); }

  private rulesFromTournament(item: Tournament): TournamentRules {
    return {
      registrationMode: item.registration_mode, format: item.format, maxTeams: item.max_teams,
      guaranteedMatches: item.guaranteed_matches, groupSize: item.group_size, qualifiersPerGroup: item.qualifiers_per_group,
      groupBestOf: item.group_best_of, groupSetPoints: item.group_set_points, knockoutBestOf: item.knockout_best_of,
      knockoutSetPoints: item.knockout_set_points, tiebreakPoints: item.tiebreak_points, winByTwo: item.win_by_two,
      thirdPlace: item.third_place, standingsWinPoints: item.standings_win_points, standingsLossPoints: item.standings_loss_points,
      minimumRestMinutes: item.minimum_rest_minutes, resultConfirmationRequired: item.result_confirmation_required,
    };
  }

  private emptyRules(): TournamentRules {
    return {
      registrationMode: 'hybrid', format: 'mixed', maxTeams: 64, guaranteedMatches: 0, groupSize: 4,
      qualifiersPerGroup: 2, groupBestOf: 1, groupSetPoints: 21, knockoutBestOf: 3, knockoutSetPoints: 21,
      tiebreakPoints: 15, winByTwo: true, thirdPlace: false, standingsWinPoints: 2, standingsLossPoints: 0,
      minimumRestMinutes: 0, resultConfirmationRequired: false,
    };
  }
}
