import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tournament, TournamentGame } from '../models/tournament.model';
import { TournamentsStore } from '../store/tournaments.store';
import { calculateStandings, teamLabel } from '../tournaments.utils';

interface QualifiedEntry { teamId: string; label: string; groupName: string; position: number; }
interface WinnerEntry { gameId: string; teamId: string; label: string; source: string; }
interface SlotTarget { gameId: string; slot: number; }
interface ScoreDraft { first: number; second: number; }
/** Le partite di un turno sono raggruppate a due a due: ogni coppia confluisce nel turno successivo. */
interface RoundColumn { number: number; title: string; pairs: TournamentGame[][]; }

@Component({
  selector: 'app-tournament-knockout',
  imports: [Button, DragDropModule, FormsModule, InputNumber, InputText, Select],
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

      @if (brackets().length > 1 || canManage()) {
        <nav class="bracket-tabs" aria-label="Tabelloni">
          @for (b of brackets(); track b) {
            <button type="button" [class.active]="b === activeBracket()" (click)="activeBracket.set(b)">
              <i class="pi pi-sitemap" aria-hidden="true"></i>{{ bracketLabel(b) }}
            </button>
          }
          @if (canManage()) {
            <span class="bracket-new">
              <input pInputText [ngModel]="newBracketName()" (ngModelChange)="newBracketName.set($event)" placeholder="Nome del nuovo tabellone" aria-label="Nome del nuovo tabellone" />
              <p-button label="Aggiungi tabellone" icon="pi pi-plus" [text]="true" size="small" [loading]="store.saving()" (onClick)="addBracket()" />
            </span>
          }
        </nav>
      }

      @if (canManage()) {
        <div class="bracket-setup">
          <label class="bracket-rename">
            <span>Nome tabellone</span>
            <input pInputText [ngModel]="bracketNameDraft()" (ngModelChange)="bracketNameDraft.set($event)" (blur)="saveBracketName()" placeholder="Es. Tabellone consolazione" />
          </label>
          <p-button label="Genera tabellone" icon="pi pi-sparkles" [loading]="store.saving()" (onClick)="generateBracket()" />
          <p-button label="Aggiungi turno" icon="pi pi-plus" [outlined]="true" severity="secondary" [loading]="store.saving()" (onClick)="addRound()" />
          @if (brackets().length > 1) {
            <p-button label="Elimina tabellone" icon="pi pi-trash" [text]="true" severity="danger" [loading]="store.saving()" (onClick)="confirmDeleteBracket()" />
          }
          <p>Usa i <strong>BYE</strong> o aggiungi partite/turni extra per far giocare di più.</p>
        </div>
      }
    </section>

    <div class="bracket-layout">
      @if (qualified().length || winners().length) {
        <div class="bracket-side">
          @if (qualified().length) {
            <aside class="side-panel" cdkDropList id="bracket-pool" [cdkDropListConnectedTo]="slotIds()" [cdkDropListSortingDisabled]="true">
              <header><i class="pi pi-list-check" aria-hidden="true"></i><div><h4>Qualificati</h4><small>{{ qualified().length }} giocatori</small></div></header>
              <div class="side-scroll">
                @for (entry of qualified(); track entry.teamId) {
                  <div class="side-row" [class.is-placed]="placedTeamIds().has(entry.teamId)" [class.is-held]="heldTeamId() === entry.teamId"
                    cdkDrag [cdkDragData]="entry.teamId" [cdkDragDisabled]="!canManage()">
                    <b>{{ entry.position }}</b>
                    <div><strong>{{ entry.label }}</strong><small>{{ entry.groupName }} · {{ entry.position }}ª posizione</small></div>
                    @if (canManage()) {
                      <p-button [icon]="heldTeamId() === entry.teamId ? 'pi pi-times' : 'pi pi-arrow-right'" [text]="true" size="small" [ariaLabel]="heldTeamId() === entry.teamId ? 'Annulla selezione' : 'Seleziona per posizionare'" (onClick)="hold(entry.teamId)" />
                    }
                    <div class="drag-preview" *cdkDragPreview>{{ entry.label }}</div>
                  </div>
                }
              </div>
            </aside>
          }

          @if (winners().length) {
            <aside class="side-panel winners-panel" cdkDropList id="bracket-winners" [cdkDropListConnectedTo]="slotIds()" [cdkDropListSortingDisabled]="true">
              <header><i class="pi pi-trophy" aria-hidden="true"></i><div><h4>Vincitori</h4><small>Trascinali nel turno successivo</small></div></header>
              <div class="side-scroll">
                @for (entry of winners(); track entry.gameId) {
                  <div class="side-row" [class.is-placed]="placedTeamIds().has(entry.teamId)" [class.is-held]="heldTeamId() === entry.teamId"
                    cdkDrag [cdkDragData]="entry.teamId" [cdkDragDisabled]="!canManage()">
                    <b><i class="pi pi-check" aria-hidden="true"></i></b>
                    <div><strong>{{ entry.label }}</strong><small>{{ entry.source }}</small></div>
                    @if (canManage()) {
                      <p-button [icon]="heldTeamId() === entry.teamId ? 'pi pi-times' : 'pi pi-arrow-right'" [text]="true" size="small" [ariaLabel]="heldTeamId() === entry.teamId ? 'Annulla selezione' : 'Seleziona per posizionare'" (onClick)="hold(entry.teamId)" />
                    }
                    <div class="drag-preview" *cdkDragPreview>{{ entry.label }}</div>
                  </div>
                }
              </div>
            </aside>
          }
        </div>
      }

      <div class="bracket-tree">
        @for (round of rounds(); track round.number) {
          <section class="round-col" [class.is-last]="round.number === rounds().length">
            <header><span>Turno {{ round.number }}</span><strong>{{ round.title }}</strong></header>
            <div class="ties">
              @for (pair of round.pairs; track $index) {
                <div class="pair" [class.is-single]="pair.length === 1">
                  @for (game of pair; track game.id) {
                    <article class="tie">
                      <div class="tie-slot" cdkDropList [id]="'slot-' + game.id + '-1'" [cdkDropListData]="{ gameId: game.id, slot: 1 }"
                        (cdkDropListDropped)="dropTeam($event)" [class.is-open]="canManage() && !game.team1_id"
                        [class.is-winner]="game.winner_team_id && game.winner_team_id === game.team1_id" (click)="placeHeld(game, 1)">
                        <span>{{ teamNameById(game.team1_id) }}</span>
                        <b>{{ game.team1_scores?.[0] ?? '–' }}</b>
                        @if (canManage() && game.team1_id && game.status === 'scheduled') {
                          <button type="button" class="tie-clear" aria-label="Svuota slot" (click)="clearSlot(game, 1); $event.stopPropagation()"><i class="pi pi-times" aria-hidden="true"></i></button>
                        }
                      </div>
                      <div class="tie-slot" cdkDropList [id]="'slot-' + game.id + '-2'" [cdkDropListData]="{ gameId: game.id, slot: 2 }"
                        (cdkDropListDropped)="dropTeam($event)" [class.is-open]="canManage() && !game.team2_id"
                        [class.is-winner]="game.winner_team_id && game.winner_team_id === game.team2_id" (click)="placeHeld(game, 2)">
                        <span>{{ teamNameById(game.team2_id) }}</span>
                        <b>{{ game.team2_scores?.[0] ?? '–' }}</b>
                        @if (canManage() && game.team2_id && game.status === 'scheduled') {
                          <button type="button" class="tie-clear" aria-label="Svuota slot" (click)="clearSlot(game, 2); $event.stopPropagation()"><i class="pi pi-times" aria-hidden="true"></i></button>
                        }
                      </div>

                      @if (canManage()) {
                        <div class="tie-edit">
                          <label>
                            <span>Punteggio</span>
                            <div class="tie-scores">
                              <p-inputnumber [ngModel]="scoreOf(game).first" (ngModelChange)="setScore(game, 'first', $event ?? 0)" [min]="0" [max]="99" [disabled]="!canScore(game)" [inputStyle]="{ width: '3.4rem', textAlign: 'center' }" />
                              <em>vs</em>
                              <p-inputnumber [ngModel]="scoreOf(game).second" (ngModelChange)="setScore(game, 'second', $event ?? 0)" [min]="0" [max]="99" [disabled]="!canScore(game)" [inputStyle]="{ width: '3.4rem', textAlign: 'center' }" />
                            </div>
                          </label>
                          <label>
                            <span>Campo</span>
                            <p-select [ngModel]="game.court_id" (ngModelChange)="setCourt(game, $event)" [options]="courtOptions()" optionLabel="label" optionValue="value" placeholder="Campo da assegnare" [showClear]="true" appendTo="body" fluid />
                          </label>
                          <footer>
                            @if (!groupsClosed() && hasGroups()) { <small class="locked"><i class="pi pi-lock" aria-hidden="true"></i> Risultati bloccati</small> }
                            <p-button icon="pi pi-check" [text]="true" size="small" ariaLabel="Salva risultato" [disabled]="!canScore(game) || !validScore(game)" [loading]="store.saving()" (onClick)="saveScore(game)" />
                            @if (game.status === 'scheduled') {
                              <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" ariaLabel="Elimina partita" (onClick)="confirmDeleteGame(game)" />
                            }
                          </footer>
                        </div>
                      } @else if (game.court_id) {
                        <p class="tie-court"><i class="pi pi-map-marker" aria-hidden="true"></i> {{ courtName(game.court_id) }}</p>
                      }
                    </article>
                  }
                </div>
              }
            </div>
            @if (canManage()) {
              <p-button label="Aggiungi partita" icon="pi pi-plus" [outlined]="true" severity="secondary" [loading]="store.saving()" (onClick)="addMatch(round.number)" />
            }
          </section>
        } @empty {
          <div class="bracket-empty">
            <i class="pi pi-sitemap" aria-hidden="true"></i>
            <h3>Nessun tabellone</h3>
            <p>{{ canManage() ? 'Genera un tabellone dai partecipanti oppure aggiungi i turni manualmente.' : 'L’organizzatore non ha ancora costruito il tabellone.' }}</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host{display:block}
    .bracket-console{display:grid;gap:20px;padding:22px;margin-bottom:20px;border:1px solid #e2e8f0;border-radius:20px;background:#fff;box-shadow:0 4px 14px rgb(15 23 42/.025)}
    .bracket-heading{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:18px;border-bottom:1px solid #e2e8f0}
    .bracket-title{display:flex;align-items:flex-start;gap:14px}
    .bracket-title>i{display:grid;width:52px;height:52px;flex:0 0 52px;place-items:center;color:#64748b;border-radius:16px;background:#f1f5f9;font-size:1.3rem}
    .bracket-title h3{margin:2px 0 6px;font:900 1.4rem/1 var(--display-font);letter-spacing:-.04em}
    .bracket-title p{max-width:560px;margin:0;color:#64748b;font-size:.78rem;line-height:1.5}
    .bracket-status{display:inline-flex;min-height:44px;align-items:center;gap:9px;padding:0 16px;color:#64748b;border-radius:999px;background:#f1f5f9;font-size:.75rem;font-weight:850;white-space:nowrap}
    .bracket-status.ready{color:#fff;background:#10b981}
    .bracket-tabs{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
    .bracket-tabs button{display:inline-flex;min-height:44px;align-items:center;gap:8px;padding:0 15px;color:#64748b;border:1px solid #e2e8f0;border-radius:999px;background:#fff;font:inherit;font-size:.74rem;font-weight:850;cursor:pointer}
    .bracket-tabs button.active{color:#fff;border-color:#0284c7;background:#0284c7}
    .bracket-new{display:inline-flex;align-items:center;gap:6px}
    .bracket-new input{min-width:190px}
    .bracket-rename{display:grid;gap:7px}
    .bracket-rename>span{color:#64748b;font-size:.66rem;font-weight:850;letter-spacing:.1em;text-transform:uppercase}
    .bracket-setup{display:grid;align-items:center;gap:12px}
    .bracket-setup>div{display:grid;gap:7px}
    .bracket-setup>div span{color:#64748b;font-size:.66rem;font-weight:850;letter-spacing:.1em;text-transform:uppercase}
    .bracket-setup>p{margin:0;color:#64748b;font-size:.72rem;line-height:1.45}
    .bracket-layout{display:grid;gap:18px}
    .bracket-side{display:grid;gap:14px;align-content:start}
    .side-panel{display:grid;align-content:start;gap:8px;padding:16px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 4px 14px rgb(15 23 42/.03)}
    .side-panel header{display:flex;align-items:center;gap:10px}
    .side-panel header i{display:grid;width:40px;height:40px;place-items:center;color:#0284c7;border-radius:12px;background:#e0f2fe}
    .side-panel h4{margin:0;font:900 1.05rem/1 var(--display-font);letter-spacing:-.03em}
    .side-panel small{color:#72869b;font-size:.64rem}
    .side-scroll{display:grid;gap:7px;max-height:min(42vh,320px);overflow-y:auto}
    .side-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:9px;min-height:52px;padding:8px 9px;border-radius:12px;background:#f8fafc;cursor:grab}
    .side-row.is-placed{opacity:.55}
    .side-row.is-held{outline:2px solid var(--color-brand);background:#e0f2fe}
    .side-row>b{display:grid;width:28px;height:28px;place-items:center;color:#f97316;border-radius:9px;background:#fff0e6;font-size:.68rem}
    .side-row>div{display:grid;min-width:0}
    .side-row strong{overflow:hidden;font-size:.75rem;text-overflow:ellipsis;white-space:nowrap}
    .winners-panel header i{color:#f97316;background:#fff1e8}
    .winners-panel .side-row>b{color:#10b981;background:#d1fae5}
    .drag-preview{padding:10px 14px;color:#fff;border-radius:12px;background:#0369a1;box-shadow:0 14px 30px rgb(3 105 161/.24);font-size:.72rem;font-weight:850}

    /* ---- albero del tabellone ---- */
    .bracket-tree{display:flex;align-items:stretch;gap:18px;overflow-x:auto;padding-bottom:10px;scroll-snap-type:x proximity}
    .round-col{display:flex;min-width:min(86vw,290px);flex-direction:column;gap:14px;scroll-snap-align:start}
    .round-col>header{display:grid;gap:2px;padding:0 4px}
    .round-col>header span{color:#0284c7;font-size:.58rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
    .round-col>header strong{font:900 1.1rem/1 var(--display-font);letter-spacing:-.035em}
    .ties{display:flex;flex:1;flex-direction:column;justify-content:space-around;gap:16px}
    .pair{position:relative;display:flex;flex-direction:column;justify-content:center;gap:16px}
    .tie{position:relative;display:grid;gap:6px;padding:10px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;box-shadow:0 3px 10px rgb(15 23 42/.03)}
    .tie-slot{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;min-height:44px;padding:8px 11px;border:1px solid #e2e8f0;border-radius:11px;font-size:.73rem;font-weight:750}
    .tie-slot>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .tie-slot>b{display:grid;min-width:30px;height:28px;place-items:center;border-radius:8px;background:#f1f5f9;font-size:.75rem;font-weight:900}
    .tie-slot.is-winner{border-color:#10b981;background:#ecfdf5}
    .tie-slot.is-winner>b{color:#fff;background:#10b981}
    .tie-slot.is-open{border-style:dashed;border-color:#94a3b8;color:#94a3b8;cursor:pointer}
    .tie-slot.cdk-drop-list-receiving{border-color:#0284c7;background:#e0f2fe}
    .tie-clear{display:grid;place-items:center;width:26px;height:26px;color:#94a3b8;border:0;border-radius:8px;background:none;cursor:pointer}
    .tie-edit{display:grid;gap:8px;padding-top:8px;border-top:1px solid #eef2f6}
    .tie-edit label{display:grid;gap:4px}
    .tie-edit label>span{color:#64748b;font-size:.58rem;font-weight:850;letter-spacing:.09em;text-transform:uppercase}
    .tie-scores{display:flex;align-items:center;justify-content:center;gap:10px}
    .tie-scores em{color:#8ba6b5;font-size:.6rem;font-style:normal;font-weight:900}
    .tie-edit footer{display:flex;align-items:center;justify-content:flex-end;gap:6px}
    .locked{margin-right:auto;color:#94a3b8;font-size:.62rem;font-weight:750}
    .tie-court{display:flex;align-items:center;gap:6px;margin:0;color:#64748b;font-size:.66rem}
    .bracket-empty{display:grid;min-width:min(88vw,560px);min-height:230px;place-content:center;justify-items:center;gap:6px;padding:26px;color:#94a3b8;text-align:center;border:1px dashed #cbd5e1;border-radius:18px}
    .bracket-empty i{color:#94a3b8;font-size:2rem}
    .bracket-empty h3{margin:4px;color:var(--color-ink)}
    @media(min-width:760px){
      .bracket-console{padding:30px}
      .bracket-setup{grid-template-columns:auto auto auto 1fr}
      .bracket-layout{grid-template-columns:300px minmax(0,1fr);gap:22px;align-items:start}
      /* i pannelli restano ancorati anche con molte card nei turni */
      .bracket-side{position:sticky;top:16px;max-height:calc(100dvh - 32px);overflow-y:auto}
      .round-col{min-width:300px}
    }
    @media(prefers-reduced-motion:reduce){.cdk-drag-animating{transition:none!important}}
  `,
})
export class TournamentKnockout {
  readonly tournament = input.required<Tournament>();
  readonly canManage = input<boolean>(false);

  protected readonly store = inject(TournamentsStore);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly heldTeamId = signal<string | null>(null);
  protected readonly newBracketName = signal('');
  private readonly scoreDrafts = signal<Record<string, ScoreDraft>>({});

  protected readonly groupsClosed = computed(() => !!this.tournament().groups_closed_at);
  protected readonly hasGroups = computed(() => (this.tournament().groups ?? []).length > 0);

  private readonly knockoutGames = computed(() => (this.tournament().games ?? []).filter((game) => game.phase !== 'group'));

  protected readonly brackets = computed(() => {
    const numbers = [...new Set(this.knockoutGames().map((game) => game.bracket_no ?? 1))].sort((a, b) => a - b);
    return numbers.length ? numbers : [1];
  });

  /** Il tabellone scelto resta valido solo finché esiste; altrimenti torna al primo. */
  protected readonly activeBracket = linkedSignal<number[], number>({
    source: () => this.brackets(),
    computation: (brackets, previous) =>
      previous && brackets.includes(previous.value) ? previous.value : brackets[0],
  });

  private readonly bracketNames = computed(() =>
    new Map((this.tournament().brackets ?? []).map((item) => [item.bracket_no, item.name])));

  protected bracketLabel(bracket: number): string {
    return this.bracketNames().get(bracket) ?? (bracket === 1 ? 'Tabellone principale' : `Tabellone ${bracket}`);
  }

  /** Nome del tabellone attivo, modificabile: si allinea da solo quando cambi tabellone. */
  protected readonly bracketNameDraft = linkedSignal<number, string>({
    source: () => this.activeBracket(),
    computation: (bracket) => this.bracketNames().get(bracket) ?? '',
  });

  protected saveBracketName(): void {
    const bracket = this.activeBracket();
    const name = this.bracketNameDraft().trim();
    if (name === (this.bracketNames().get(bracket) ?? '')) return;
    void this.store.setBracketName(this.tournament().id, bracket, name);
  }

  protected readonly rounds = computed<RoundColumn[]>(() => {
    const games = this.knockoutGames().filter((game) => (game.bracket_no ?? 1) === this.activeBracket());
    const total = Math.max(0, ...games.map((game) => game.round_no));
    return Array.from({ length: total }, (_, index) => {
      const number = index + 1;
      const ordered = games.filter((game) => game.round_no === number).sort((a, b) => a.position - b.position);
      const pairs: TournamentGame[][] = [];
      for (let i = 0; i < ordered.length; i += 2) pairs.push(ordered.slice(i, i + 2));
      return { number, title: this.roundTitleFor(number, total), pairs };
    });
  });

  protected readonly slotIds = computed(() =>
    this.rounds().flatMap((round) => round.pairs.flat().flatMap((game) => [`slot-${game.id}-1`, `slot-${game.id}-2`])));

  protected readonly placedTeamIds = computed(() => {
    const ids = new Set<string>();
    for (const game of this.knockoutGames()) {
      if (game.team1_id) ids.add(game.team1_id);
      if (game.team2_id) ids.add(game.team2_id);
    }
    return ids;
  });

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

  /**
   * Vincitori già decisi, sia dei gironi sia del tabellone: si trascinano nel turno
   * successivo (la semifinale nella finale, il vincitore di un girone nel tabellone).
   */
  protected readonly winners = computed<WinnerEntry[]>(() => {
    const bracketGames = this.knockoutGames().filter((game) => (game.bracket_no ?? 1) === this.activeBracket());
    const total = Math.max(0, ...bracketGames.map((game) => game.round_no));
    const groupNames = new Map((this.tournament().groups ?? []).map((group) => [group.id, group.name]));

    const fromGroups = (this.tournament().games ?? [])
      .filter((game) => game.phase === 'group' && game.status === 'completed' && !!game.winner_team_id)
      .sort((a, b) => a.position - b.position)
      .map((game) => ({
        gameId: game.id,
        teamId: game.winner_team_id!,
        label: this.teamNameById(game.winner_team_id),
        source: `${groupNames.get(game.group_id ?? '') ?? 'Girone'} · partita #${game.position}`,
      }));

    const fromBracket = bracketGames
      .filter((game) => game.status === 'completed' && !!game.winner_team_id)
      .sort((a, b) => a.round_no - b.round_no || a.position - b.position)
      .map((game) => ({
        gameId: game.id,
        teamId: game.winner_team_id!,
        label: this.teamNameById(game.winner_team_id),
        source: `${this.roundTitleFor(game.round_no, total)} · partita #${game.position}`,
      }));

    return [...fromBracket, ...fromGroups];
  });

  protected readonly courtOptions = computed(() =>
    this.tournament().courts.map((link) => ({ value: link.court_id, label: link.court?.name ?? 'Campo' })));

  protected courtName(id: string | null): string {
    return this.tournament().courts.find((link) => link.court_id === id)?.court?.name ?? 'Campo da assegnare';
  }

  protected setCourt(game: TournamentGame, courtId: string | null): void {
    if (!this.canManage() || courtId === game.court_id) return;
    void this.store.setGameCourt(this.tournament().id, game.id, courtId);
  }

  protected teamNameById(id: string | null): string {
    return id ? teamLabel(this.tournament().teams.find((team) => team.id === id)) : 'Slot libero / BYE';
  }

  private roundTitleFor(round: number, total: number): string {
    if (round === total) return 'Finale';
    if (round === total - 1) return 'Semifinali';
    if (round === total - 2) return 'Quarti';
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
    const game = this.knockoutGames().find((item) => item.id === target.gameId);
    if (!game || game.status !== 'scheduled') return;
    this.assignSlot(game, target.slot, event.item.data as string);
  }

  protected clearSlot(game: TournamentGame, slot: number): void { this.assignSlot(game, slot, null); }

  private assignSlot(game: TournamentGame, slot: number, teamId: string | null): void {
    const team1Id = slot === 1 ? teamId : game.team1_id;
    const team2Id = slot === 2 ? teamId : game.team2_id;
    if (teamId && (slot === 1 ? game.team2_id : game.team1_id) === teamId) return;
    void this.store.saveGame(this.tournament().id, {
      id: game.id, phase: game.phase, groupId: null, bracketNo: game.bracket_no ?? 1,
      roundNo: game.round_no, position: game.position, team1Id, team2Id,
    });
  }

  /** Un turno nuovo nasce grande la meta del precedente; il primo parte dai qualificati. */
  private nextRoundSlots(): number {
    const previous = this.rounds().at(-1);
    if (previous) return Math.max(1, Math.ceil(previous.pairs.flat().length / 2));
    return Math.max(1, Math.ceil(this.qualified().length / 2));
  }

  protected addRound(): void {
    void this.store.addBracketRound(this.tournament().id, this.rounds().length + 1, this.nextRoundSlots(), this.activeBracket());
  }

  protected addMatch(roundNo: number): void {
    void this.store.addBracketRound(this.tournament().id, roundNo, 1, this.activeBracket());
  }

  protected async addBracket(): Promise<void> {
    const next = Math.max(...this.brackets()) + 1;
    const slots = Math.max(1, Math.ceil(this.qualified().length / 2));
    if (await this.store.addBracketRound(this.tournament().id, 1, slots, next)) {
      this.activeBracket.set(next);
      const name = this.newBracketName().trim();
      if (name) void this.store.setBracketName(this.tournament().id, next, name);
      this.newBracketName.set('');
    }
  }

  protected generateBracket(): void {
    void this.store.generateBracket(this.tournament().id, Math.max(1, Math.ceil(this.qualified().length / 2)), this.seedOrder(), this.activeBracket());
  }

  /** Ordine di semina: 1ª testa contro l'ultima, 2ª contro la penultima e così via. */
  private seedOrder(): string[] {
    const pool = this.qualified().map((entry) => entry.teamId);
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

  protected confirmDeleteBracket(): void {
    const bracket = this.activeBracket();
    this.confirmation.confirm({
      header: `Elimina ${this.bracketLabel(bracket).toLowerCase()}`,
      message: 'Tutte le partite di questo tabellone verranno rimosse. I tabelloni con risultati non possono essere eliminati.',
      icon: 'pi pi-trash', acceptLabel: 'Elimina', rejectLabel: 'Annulla',
      acceptButtonProps: { severity: 'danger' }, rejectButtonProps: { severity: 'secondary', variant: 'text' },
      accept: () => void this.store.deleteBracket(this.tournament().id, bracket),
    });
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
