import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { Tournament, TournamentGame } from '../models/tournament.model';
import { TournamentsStore } from '../store/tournaments.store';
import { calculateStandings, teamLabel } from '../tournaments.utils';

interface QualifiedEntry {
  teamId: string;
  label: string;
  groupName: string;
  position: number;
}

interface SlotTarget { gameId: string; slot: number; }
interface ScoreDraft { first: number; second: number; }

/**
 * Sezione "Tabellone": il tabellone si costruisce liberamente anche mentre si giocano i
 * gironi, ma i risultati si registrano solo dopo la chiusura dei gironi. A gironi chiusi
 * la barra laterale elenca i qualificati con girone e posizione, trascinabili negli slot.
 */
@Component({
  selector: 'app-tournament-knockout',
  imports: [Button, DragDropModule, FormsModule, InputNumber],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bracket-console">
      <header class="bracket-heading">
        <div class="bracket-title">
          <i [class]="groupsClosed() ? 'pi pi-lock-open' : 'pi pi-lock'" aria-hidden="true"></i>
          <div>
            <h3>Scontri diretti</h3>
            <p>Costruisci liberamente il tabellone. Potrai inserire i risultati solo dopo aver completato i gironi.</p>
          </div>
        </div>
        @if (canManage()) {
          @if (groupsClosed()) {
            <p-button label="Gironi completati" icon="pi pi-check-circle" severity="success" [loading]="store.saving()" (onClick)="confirmReopen()" />
          } @else {
            <p-button label="Chiudi i gironi" icon="pi pi-flag-fill" [loading]="store.saving()" (onClick)="confirmClose()" />
          }
        } @else {
          <span class="bracket-status" [class.ready]="groupsClosed()"><i [class]="groupsClosed() ? 'pi pi-check-circle' : 'pi pi-clock'" aria-hidden="true"></i>{{ groupsClosed() ? 'Gironi completati' : 'Gironi in corso' }}</span>
        }
      </header>

      @if (canManage()) {
        <div class="bracket-setup">
          <div><span>Partecipanti</span><p-inputnumber [ngModel]="participants()" (ngModelChange)="participants.set($event ?? 2)" [min]="2" [max]="64" [showButtons]="true" /></div>
          <p-button label="Genera tabellone" icon="pi pi-sparkles" [loading]="store.saving()" (onClick)="generateBracket()" />
          <p-button label="Aggiungi turno" icon="pi pi-plus" [outlined]="true" severity="secondary" [loading]="store.saving()" (onClick)="addRound()" />
          <p>Usa i <strong>BYE</strong> o aggiungi partite/turni extra per far giocare di più.</p>
        </div>
      }
    </section>

    <div class="bracket-layout">
      @if (qualified().length) {
        <aside class="qualified-panel" cdkDropList id="bracket-pool" [cdkDropListConnectedTo]="slotIds()" [cdkDropListSortingDisabled]="true">
          <header><i class="pi pi-list-check" aria-hidden="true"></i><div><h4>Qualificati</h4><small>{{ qualified().length }} giocatori</small></div></header>
          @for (entry of qualified(); track entry.teamId) {
            <div
              class="qualified-row"
              [class.is-placed]="placedTeamIds().has(entry.teamId)"
              [class.is-held]="heldTeamId() === entry.teamId"
              cdkDrag
              [cdkDragData]="entry.teamId"
              [cdkDragDisabled]="!canManage()"
            >
              <b>{{ entry.position }}</b>
              <div><strong>{{ entry.label }}</strong><small>{{ entry.groupName }} · {{ entry.position }}ª posizione</small></div>
              @if (canManage()) {
                <p-button [icon]="heldTeamId() === entry.teamId ? 'pi pi-times' : 'pi pi-arrow-right'" [text]="true" size="small" [ariaLabel]="heldTeamId() === entry.teamId ? 'Annulla selezione' : 'Seleziona per posizionare'" (onClick)="hold(entry.teamId)" />
              }
              <div class="drag-preview" *cdkDragPreview>{{ entry.label }}</div>
            </div>
          }
          @if (canManage()) { <p class="panel-hint">Trascina un giocatore in uno slot, oppure selezionalo e tocca lo slot.</p> }
        </aside>
      }

      <div class="round-board">
        @for (round of rounds(); track round.number) {
          <section class="round-lane">
            <header><span>Turno {{ round.number }}</span><strong>{{ roundTitle(round.number) }}</strong></header>
            @for (game of round.games; track game.id) {
              <article class="bracket-game">
                <div
                  class="bracket-slot"
                  cdkDropList
                  [id]="'slot-' + game.id + '-1'"
                  [cdkDropListData]="{ gameId: game.id, slot: 1 }"
                  (cdkDropListDropped)="dropTeam($event)"
                  [class.is-open]="canManage() && !game.team1_id"
                  (click)="placeHeld(game, 1)"
                >
                  <span>{{ teamNameById(game.team1_id) }}</span>
                  @if (canManage() && game.team1_id && game.status === 'scheduled') {
                    <p-button icon="pi pi-times" [text]="true" size="small" ariaLabel="Svuota slot" (onClick)="clearSlot(game, 1)" />
                  }
                </div>
                <div class="bracket-score">
                  <p-inputnumber [ngModel]="scoreOf(game).first" (ngModelChange)="setScore(game, 'first', $event ?? 0)" [min]="0" [max]="99" [disabled]="!canScore(game)" [inputStyle]="{ width: '2.6rem' }" />
                  <em>VS</em>
                  <p-inputnumber [ngModel]="scoreOf(game).second" (ngModelChange)="setScore(game, 'second', $event ?? 0)" [min]="0" [max]="99" [disabled]="!canScore(game)" [inputStyle]="{ width: '2.6rem' }" />
                </div>
                <div
                  class="bracket-slot"
                  cdkDropList
                  [id]="'slot-' + game.id + '-2'"
                  [cdkDropListData]="{ gameId: game.id, slot: 2 }"
                  (cdkDropListDropped)="dropTeam($event)"
                  [class.is-open]="canManage() && !game.team2_id"
                  (click)="placeHeld(game, 2)"
                >
                  <span>{{ teamNameById(game.team2_id) }}</span>
                  @if (canManage() && game.team2_id && game.status === 'scheduled') {
                    <p-button icon="pi pi-times" [text]="true" size="small" ariaLabel="Svuota slot" (onClick)="clearSlot(game, 2)" />
                  }
                </div>
                @if (canManage()) {
                  <footer>
                    @if (!groupsClosed() && hasGroups()) { <small class="locked"><i class="pi pi-lock" aria-hidden="true"></i> Risultati bloccati</small> }
                    <p-button icon="pi pi-check" [text]="true" size="small" ariaLabel="Salva risultato" [disabled]="!canScore(game) || !validScore(game)" [loading]="store.saving()" (onClick)="saveScore(game)" />
                    @if (game.status === 'scheduled') {
                      <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" ariaLabel="Elimina partita" (onClick)="confirmDeleteGame(game)" />
                    }
                  </footer>
                }
              </article>
            }
            @if (canManage()) {
              <p-button label="Aggiungi partita" icon="pi pi-plus" [outlined]="true" severity="secondary" [loading]="store.saving()" (onClick)="addMatch(round.number)" />
            }
          </section>
        } @empty {
          <div class="bracket-empty">
            <i class="pi pi-trophy" aria-hidden="true"></i>
            <h3>Nessun tabellone</h3>
            <p>{{ canManage() ? 'Genera un tabellone dai partecipanti oppure aggiungi i turni manualmente.' : 'L’organizzatore non ha ancora costruito il tabellone.' }}</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host{display:block}
    .bracket-console{display:grid;gap:22px;padding:22px;margin-bottom:20px;border:1px solid #e2e8f0;border-radius:20px;background:#fff;box-shadow:0 4px 14px rgb(15 23 42/.025)}
    .bracket-heading{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:20px;border-bottom:1px solid #e2e8f0}
    .bracket-title{display:flex;align-items:flex-start;gap:14px}
    .bracket-title>i{display:grid;width:52px;height:52px;flex:0 0 52px;place-items:center;color:#64748b;border-radius:16px;background:#f1f5f9;font-size:1.3rem}
    .bracket-title h3{margin:2px 0 6px;font:900 1.4rem/1 var(--display-font);letter-spacing:-.04em}
    .bracket-title p{max-width:560px;margin:0;color:#64748b;font-size:.78rem;line-height:1.5}
    .bracket-status{display:inline-flex;min-height:44px;align-items:center;gap:9px;padding:0 16px;color:#64748b;border-radius:999px;background:#f1f5f9;font-size:.75rem;font-weight:850;white-space:nowrap}
    .bracket-status.ready{color:#fff;background:#10b981}
    .bracket-setup{display:grid;align-items:center;gap:12px}
    .bracket-setup>div{display:grid;gap:7px}
    .bracket-setup>div span{color:#64748b;font-size:.66rem;font-weight:850;letter-spacing:.1em;text-transform:uppercase}
    .bracket-setup>p{margin:0;color:#64748b;font-size:.72rem;line-height:1.45}
    .bracket-layout{display:grid;gap:18px}
    .qualified-panel{display:grid;align-content:start;gap:8px;padding:16px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 4px 14px rgb(15 23 42/.03)}
    .qualified-panel header{display:flex;align-items:center;gap:10px;margin-bottom:6px}
    .qualified-panel header i{display:grid;width:40px;height:40px;place-items:center;color:#0284c7;border-radius:12px;background:#e0f2fe}
    .qualified-panel h4{margin:0;font:900 1.05rem/1 var(--display-font);letter-spacing:-.03em}
    .qualified-panel small{color:#72869b;font-size:.64rem}
    .qualified-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:9px;min-height:52px;padding:8px 9px;border-radius:12px;background:#f8fafc;cursor:grab}
    .qualified-row.is-placed{opacity:.55}
    .qualified-row.is-held{outline:2px solid var(--color-brand);background:#e0f2fe}
    .qualified-row>b{display:grid;width:28px;height:28px;place-items:center;color:#f97316;border-radius:9px;background:#fff0e6;font-size:.68rem}
    .qualified-row>div{display:grid;min-width:0}
    .qualified-row strong{overflow:hidden;font-size:.75rem;text-overflow:ellipsis;white-space:nowrap}
    .panel-hint{margin:4px 0 0;color:#94a3b8;font-size:.66rem;line-height:1.4}
    .drag-preview{padding:10px 14px;color:#fff;border-radius:12px;background:#0369a1;box-shadow:0 14px 30px rgb(3 105 161/.24);font-size:.72rem;font-weight:850}
    .round-board{display:flex;align-items:flex-start;gap:14px;overflow-x:auto;padding-bottom:8px;scroll-snap-type:x proximity}
    .round-lane{display:grid;gap:10px;min-width:min(84vw,320px);scroll-snap-align:start}
    .round-lane>header{display:grid;gap:2px;padding:0 4px}
    .round-lane>header span{color:#0284c7;font-size:.58rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
    .round-lane>header strong{font:900 1.1rem/1 var(--display-font);letter-spacing:-.035em}
    .bracket-game{display:grid;gap:8px;padding:12px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;box-shadow:0 3px 10px rgb(15 23 42/.025)}
    .bracket-slot{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:8px 11px;border:1px solid #e2e8f0;border-radius:12px;font-size:.72rem;font-weight:700}
    .bracket-slot>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .bracket-slot.is-open{border-style:dashed;border-color:#94a3b8;color:#94a3b8;cursor:pointer}
    .bracket-slot.cdk-drop-list-dragging,.bracket-slot.cdk-drop-list-receiving{border-color:var(--color-brand);background:#e0f2fe}
    .bracket-score{display:flex;align-items:center;justify-content:center;gap:10px}
    .bracket-score em{color:#8ba6b5;font-size:.6rem;font-style:normal;font-weight:900}
    .bracket-game footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding-top:6px;border-top:1px solid #eef2f6}
    .locked{margin-right:auto;color:#94a3b8;font-size:.64rem;font-weight:750}
    .bracket-empty{display:grid;min-width:min(88vw,560px);min-height:230px;place-content:center;justify-items:center;gap:6px;padding:26px;color:#94a3b8;text-align:center;border:1px dashed #cbd5e1;border-radius:18px}
    .bracket-empty i{color:#94a3b8;font-size:2rem}
    .bracket-empty h3{margin:4px;color:var(--color-ink)}
    @media(min-width:760px){
      .bracket-console{padding:30px}
      .bracket-setup{grid-template-columns:auto auto auto 1fr}
      .bracket-setup>p{justify-self:end;text-align:right}
      .bracket-layout{grid-template-columns:300px minmax(0,1fr);gap:22px;align-items:start}
      .qualified-panel{position:sticky;top:16px}
      .round-lane{min-width:330px}
    }
    @media(prefers-reduced-motion:reduce){.cdk-drag-animating{transition:none!important}}
  `,
})
export class TournamentKnockout {
  readonly tournament = input.required<Tournament>();
  readonly canManage = input<boolean>(false);

  protected readonly store = inject(TournamentsStore);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly participants = signal(4);
  protected readonly heldTeamId = signal<string | null>(null);
  private readonly scoreDrafts = signal<Record<string, ScoreDraft>>({});

  protected readonly groupsClosed = computed(() => !!this.tournament().groups_closed_at);
  protected readonly hasGroups = computed(() => (this.tournament().groups ?? []).length > 0);

  protected readonly rounds = computed(() => {
    const games = (this.tournament().games ?? []).filter((game) => game.phase !== 'group');
    const max = Math.max(0, ...games.map((game) => game.round_no));
    return Array.from({ length: max }, (_, index) => ({
      number: index + 1,
      games: games.filter((game) => game.round_no === index + 1).sort((a, b) => a.position - b.position),
    }));
  });

  protected readonly slotIds = computed(() => this.rounds().flatMap((round) => round.games.flatMap((game) => [`slot-${game.id}-1`, `slot-${game.id}-2`])));

  protected readonly placedTeamIds = computed(() => {
    const ids = new Set<string>();
    for (const game of (this.tournament().games ?? []).filter((item) => item.phase !== 'group')) {
      if (game.team1_id) ids.add(game.team1_id);
      if (game.team2_id) ids.add(game.team2_id);
    }
    return ids;
  });

  /**
   * Qualificati: a gironi chiusi ogni giocatore compare col girone e la posizione
   * ottenuta in base ai risultati; senza gironi si usano tutti gli iscritti attivi.
   */
  protected readonly qualified = computed<QualifiedEntry[]>(() => {
    const tournament = this.tournament();
    const groups = [...(tournament.groups ?? [])].sort((a, b) => a.position - b.position);
    if (!groups.length) {
      return tournament.teams
        .filter((team) => team.status !== 'withdrawn')
        .map((team, index) => ({ teamId: team.id, label: teamLabel(team), groupName: 'Iscritti', position: index + 1 }));
    }
    const entries: QualifiedEntry[] = [];
    for (const group of groups) {
      calculateStandings(tournament, group.id).forEach((row, index) => {
        entries.push({
          teamId: row.teamId,
          label: teamLabel(tournament.teams.find((team) => team.id === row.teamId)),
          groupName: group.name,
          position: index + 1,
        });
      });
    }
    return entries.sort((a, b) => a.position - b.position || a.groupName.localeCompare(b.groupName));
  });

  protected teamNameById(id: string | null): string {
    return id ? teamLabel(this.tournament().teams.find((team) => team.id === id)) : 'Slot libero / BYE';
  }

  protected roundTitle(round: number): string {
    const total = this.rounds().length;
    if (round === total) return 'Finale';
    if (round === total - 1) return 'Semifinali';
    return `Turno ${round}`;
  }

  protected scoreOf(game: TournamentGame): ScoreDraft {
    return this.scoreDrafts()[game.id] ?? { first: game.team1_scores?.[0] ?? 0, second: game.team2_scores?.[0] ?? 0 };
  }

  protected setScore(game: TournamentGame, key: keyof ScoreDraft, value: number): void {
    const current = this.scoreOf(game);
    this.scoreDrafts.update((drafts) => ({ ...drafts, [game.id]: { ...current, [key]: value } }));
  }

  /** I risultati del tabellone restano bloccati finché i gironi non sono chiusi. */
  protected canScore(game: TournamentGame): boolean {
    return this.canManage() && !!game.team1_id && !!game.team2_id && (this.groupsClosed() || !this.hasGroups());
  }

  protected validScore(game: TournamentGame): boolean {
    const score = this.scoreOf(game);
    return score.first !== score.second;
  }

  protected async saveScore(game: TournamentGame): Promise<void> {
    if (!this.canScore(game) || !this.validScore(game)) return;
    const score = this.scoreOf(game);
    await this.store.submitResult(this.tournament().id, game.id, [score.first], [score.second]);
  }

  protected hold(teamId: string): void {
    this.heldTeamId.update((current) => (current === teamId ? null : teamId));
  }

  protected placeHeld(game: TournamentGame, slot: number): void {
    const teamId = this.heldTeamId();
    if (!this.canManage() || !teamId || game.status !== 'scheduled') return;
    this.heldTeamId.set(null);
    this.assignSlot(game, slot, teamId);
  }

  protected dropTeam(event: CdkDragDrop<SlotTarget>): void {
    const target = event.container.data;
    if (!this.canManage() || !target?.gameId) return;
    const game = (this.tournament().games ?? []).find((item) => item.id === target.gameId);
    if (!game || game.status !== 'scheduled') return;
    this.assignSlot(game, target.slot, event.item.data as string);
  }

  protected clearSlot(game: TournamentGame, slot: number): void { this.assignSlot(game, slot, null); }

  private assignSlot(game: TournamentGame, slot: number, teamId: string | null): void {
    const team1Id = slot === 1 ? teamId : game.team1_id;
    const team2Id = slot === 2 ? teamId : game.team2_id;
    if (teamId && (slot === 1 ? game.team2_id : game.team1_id) === teamId) return;
    void this.store.saveGame(this.tournament().id, {
      id: game.id, phase: game.phase, groupId: null,
      roundNo: game.round_no, position: game.position, team1Id, team2Id,
    });
  }

  protected addRound(): void {
    const next = this.rounds().length + 1;
    void this.store.addBracketRound(this.tournament().id, next, Math.max(1, Math.ceil(this.participants() / 2)));
  }

  protected addMatch(roundNo: number): void {
    void this.store.addBracketRound(this.tournament().id, roundNo, 1);
  }

  protected generateBracket(): void {
    const seeds = this.seedOrder();
    void this.store.generateBracket(this.tournament().id, Math.max(1, Math.ceil(this.participants() / 2)), seeds);
  }

  /** Ordine di semina: 1ª testa contro l'ultima, 2ª contro la penultima e così via. */
  private seedOrder(): string[] {
    const pool = this.qualified().map((entry) => entry.teamId).slice(0, this.participants());
    const ordered: string[] = [];
    let head = 0;
    let tail = pool.length - 1;
    while (head <= tail) {
      ordered.push(pool[head]);
      if (head !== tail) ordered.push(pool[tail]);
      head += 1;
      tail -= 1;
    }
    return ordered;
  }

  protected confirmClose(): void {
    this.confirmation.confirm({
      header: 'Chiudi i gironi',
      message: 'Le classifiche dei gironi diventano definitive e si sbloccano i risultati del tabellone.',
      icon: 'pi pi-flag-fill', acceptLabel: 'Chiudi i gironi', rejectLabel: 'Annulla',
      rejectButtonProps: { severity: 'secondary', variant: 'text' },
      accept: () => void this.store.closeGroups(this.tournament().id),
    });
  }

  protected confirmReopen(): void {
    this.confirmation.confirm({
      header: 'Riapri i gironi',
      message: 'I risultati del tabellone torneranno bloccati finché i gironi non saranno chiusi di nuovo.',
      icon: 'pi pi-undo', acceptLabel: 'Riapri', rejectLabel: 'Annulla',
      rejectButtonProps: { severity: 'secondary', variant: 'text' },
      accept: () => void this.store.reopenGroups(this.tournament().id),
    });
  }

  protected confirmDeleteGame(game: TournamentGame): void {
    this.confirmation.confirm({
      header: 'Elimina partita', message: 'La partita verrà rimossa dal tabellone.',
      icon: 'pi pi-trash', acceptLabel: 'Elimina', rejectLabel: 'Annulla',
      acceptButtonProps: { severity: 'danger' }, rejectButtonProps: { severity: 'secondary', variant: 'text' },
      accept: () => void this.store.deleteGame(this.tournament().id, game.id),
    });
  }
}
