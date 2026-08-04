import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import {
  Tournament,
  TournamentGame,
  TournamentGameDraft,
  TournamentRules,
  TournamentTeam,
} from '../models/tournament.model';
import { TournamentsStore } from '../store/tournaments.store';
import { teamLabel } from '../tournaments.utils';

type StudioView = 'groups' | 'bracket' | 'rules';

@Component({
  selector: 'app-tournament-studio',
  imports: [Button, Checkbox, CommonModule, Dialog, DragDropModule, FormsModule, InputNumber, InputText, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="studio-shell">
      <header class="studio-heading">
        <div>
          <p>Console organizzatore</p>
          <h2>Costruisci il torneo mentre prende vita</h2>
          <span>Sposta le coppie, aggiungi incontri e cambia le regole. I risultati giocati restano protetti.</span>
        </div>
        <div class="live-mark"><i class="pi pi-wave-pulse"></i><span>Bozza viva</span></div>
      </header>

      <nav class="studio-tabs" aria-label="Sezioni del tournament builder">
        @for (item of studioViews; track item.value) {
          <button type="button" [class.active]="view() === item.value" (click)="view.set(item.value)">
            <i [class]="item.icon"></i>{{ item.label }}
          </button>
        }
      </nav>

      @if (view() === 'groups') {
        <div class="toolbar">
          <div><strong>Composizione gironi</strong><span>Trascina una coppia nella corsia desiderata.</span></div>
          <p-button label="Nuovo girone" icon="pi pi-plus" (onClick)="openGroup()" />
        </div>
        <div class="group-board">
          <article class="team-lane unassigned">
            <header><div><span class="lane-index">00</span><h3>Da assegnare</h3></div><b>{{ unassignedTeams().length }}</b></header>
            <div cdkDropList id="unassigned-teams" [cdkDropListData]="null" [cdkDropListConnectedTo]="dropListIds()" class="drop-zone" (cdkDropListDropped)="dropTeam($event)">
              @for (team of unassignedTeams(); track team.id) { <ng-container [ngTemplateOutlet]="teamCard" [ngTemplateOutletContext]="{ team: team }" /> }
              @empty { <div class="drop-empty"><i class="pi pi-check-circle"></i>Tutte le coppie sono assegnate</div> }
            </div>
          </article>

          @for (group of groups(); track group.id; let index = $index) {
            <article class="team-lane">
              <header>
                <div><span class="lane-index">{{ (index + 1).toString().padStart(2, '0') }}</span><h3>{{ group.name }}</h3></div>
                <div class="lane-actions">
                  <p-button icon="pi pi-sparkles" [text]="true" severity="secondary" ariaLabel="Genera partite mancanti" (onClick)="generateGames(group.id)" />
                  <p-button icon="pi pi-pencil" [text]="true" severity="secondary" ariaLabel="Rinomina girone" (onClick)="openGroup(group.id, group.name)" />
                  <p-button icon="pi pi-trash" [text]="true" severity="danger" ariaLabel="Elimina girone" (onClick)="confirmDeleteGroup(group.id, group.name)" />
                </div>
              </header>
              <div cdkDropList [id]="'group-' + group.id" [cdkDropListData]="group.id" [cdkDropListConnectedTo]="dropListIds()" class="drop-zone" (cdkDropListDropped)="dropTeam($event)">
                @for (team of teamsInGroup(group.id); track team.id) { <ng-container [ngTemplateOutlet]="teamCard" [ngTemplateOutletContext]="{ team: team }" /> }
                @empty { <div class="drop-empty"><i class="pi pi-arrow-down"></i>Trascina qui le coppie</div> }
              </div>
              <footer><span>{{ groupGames(group.id).length }} partite</span><p-button label="Aggiungi partita" icon="pi pi-plus" [text]="true" size="small" (onClick)="openGame(null, group.id)" /></footer>
            </article>
          }
        </div>

        <ng-template #teamCard let-team="team">
          <div class="team-chip" cdkDrag [cdkDragData]="team.id">
            <span class="drag-handle" cdkDragHandle aria-hidden="true"><i class="pi pi-bars"></i></span>
            <span class="team-avatar">{{ initials(team) }}</span>
            <div><strong>{{ teamName(team) }}</strong><small>{{ team.status === 'confirmed' ? 'Confermata' : 'In attesa' }}</small></div>
            <p-select [ngModel]="groupIdForTeam(team.id)" (ngModelChange)="moveTeam(team.id, $event)" [options]="groupOptions()" optionLabel="label" optionValue="value" placeholder="Sposta" ariaLabel="Sposta coppia in un girone" appendTo="body" />
            <div class="drag-preview" *cdkDragPreview>{{ teamName(team) }}</div>
          </div>
        </ng-template>
      }

      @if (view() === 'bracket') {
        <div class="toolbar">
          <div><strong>Calendario libero</strong><span>Ogni corsia è un turno. Nessun accoppiamento è obbligatorio.</span></div>
          <p-button label="Aggiungi turno" icon="pi pi-plus" (onClick)="openGame(null, null, nextRound())" />
        </div>
        <div class="round-board">
          @for (round of knockoutRounds(); track round.number) {
            <section class="round-lane">
              <header><span>Turno {{ round.number }}</span><strong>{{ roundTitle(round.number) }}</strong></header>
              @for (game of round.games; track game.id) {
                <article class="studio-game">
                  <div><span>{{ teamNameById(game.team1_id) }}</span><b>{{ game.team1_scores?.join(' · ') ?? '–' }}</b></div>
                  <em>VS</em>
                  <div><span>{{ teamNameById(game.team2_id) }}</span><b>{{ game.team2_scores?.join(' · ') ?? '–' }}</b></div>
                  @if (game.status === 'scheduled') { <footer><p-button icon="pi pi-pencil" [text]="true" ariaLabel="Modifica partita" (onClick)="openGame(game)" /><p-button icon="pi pi-trash" [text]="true" severity="danger" ariaLabel="Elimina partita" (onClick)="confirmDeleteGame(game)" /></footer> }
                </article>
              }
              <p-button label="Aggiungi sfida" icon="pi pi-plus" [text]="true" (onClick)="openGame(null, null, round.number)" />
            </section>
          } @empty {
            <div class="studio-empty"><i class="pi pi-sitemap"></i><h3>Il tabellone parte da te</h3><p>Aggiungi il primo turno e scegli liberamente gli accoppiamenti.</p><p-button label="Crea il primo turno" icon="pi pi-plus" (onClick)="openGame(null, null, 1)" /></div>
          }
        </div>
      }

      @if (view() === 'rules') {
        <div class="rules-layout">
          <section class="rule-card">
            <div class="toolbar"><div><strong>Regole attive</strong><span>Puoi cambiarle anche a torneo iniziato; non riscrivono risultati passati.</span></div></div>
            <div class="rule-grid">
              <label>Formula<p-select [ngModel]="rules().format" (ngModelChange)="updateRule('format', $event)" [options]="formatOptions" optionLabel="label" optionValue="value" fluid /></label>
              <label>Coppie massime<p-inputnumber [ngModel]="rules().maxTeams" (ngModelChange)="updateRule('maxTeams', $event ?? 2)" [min]="2" [max]="64" [showButtons]="true" fluid /></label>
              <label>Set nei gironi<p-select [ngModel]="rules().groupBestOf" (ngModelChange)="updateRule('groupBestOf', $event)" [options]="bestOfOptions" optionLabel="label" optionValue="value" fluid /></label>
              <label>Set nella fase finale<p-select [ngModel]="rules().knockoutBestOf" (ngModelChange)="updateRule('knockoutBestOf', $event)" [options]="bestOfOptions" optionLabel="label" optionValue="value" fluid /></label>
              <label>Punti set gironi<p-inputnumber [ngModel]="rules().groupSetPoints" (ngModelChange)="updateRule('groupSetPoints', $event ?? 21)" [min]="1" [max]="99" fluid /></label>
              <label>Punti set finali<p-inputnumber [ngModel]="rules().knockoutSetPoints" (ngModelChange)="updateRule('knockoutSetPoints', $event ?? 21)" [min]="1" [max]="99" fluid /></label>
              <label>Riposo minimo<p-inputnumber [ngModel]="rules().minimumRestMinutes" (ngModelChange)="updateRule('minimumRestMinutes', $event ?? 0)" suffix=" min" [min]="0" [max]="240" fluid /></label>
              <label>Punti vittoria<p-inputnumber [ngModel]="rules().standingsWinPoints" (ngModelChange)="updateRule('standingsWinPoints', $event ?? 1)" [min]="1" [max]="10" fluid /></label>
            </div>
            <div class="no-draw"><i class="pi pi-shield"></i><div><strong>Nessun pareggio</strong><span>Ogni set e ogni partita devono avere un vincitore.</span></div></div>
            <div class="checks"><p-checkbox inputId="studio-win-two" [ngModel]="rules().winByTwo" (ngModelChange)="updateRule('winByTwo', $event)" [binary]="true" /><label for="studio-win-two">Vittoria con due punti di scarto</label><p-checkbox inputId="studio-confirm" [ngModel]="rules().resultConfirmationRequired" (ngModelChange)="updateRule('resultConfirmationRequired', $event)" [binary]="true" /><label for="studio-confirm">Conferma risultato richiesta</label></div>
            <footer class="rule-actions"><p-button label="Applica le regole" icon="pi pi-check" [loading]="store.saving()" (onClick)="saveRules()" /></footer>
          </section>
        </div>
      }
    </section>

    <p-dialog [header]="editingGroupId() ? 'Rinomina girone' : 'Nuovo girone'" styleClass="app-form-dialog" [visible]="groupDialog()" (visibleChange)="groupDialog.set($event)" [modal]="true" [draggable]="false" [resizable]="false" appendTo="body">
      <div class="dialog-field"><label for="studio-group-name">Nome</label><input id="studio-group-name" pInputText [ngModel]="groupName()" (ngModelChange)="groupName.set($event)" placeholder="Es. Girone Onda" /></div>
      <ng-template #footer><p-button label="Annulla" [text]="true" severity="secondary" (onClick)="groupDialog.set(false)" /><p-button label="Salva girone" icon="pi pi-check" [disabled]="!groupName().trim()" [loading]="store.saving()" (onClick)="saveGroup()" /></ng-template>
    </p-dialog>

    <p-dialog header="Configura partita" styleClass="app-form-dialog" [visible]="gameDialog()" (visibleChange)="gameDialog.set($event)" [modal]="true" [draggable]="false" [resizable]="false" appendTo="body">
      <div class="game-form">
        <div class="dialog-field"><label for="studio-game-phase">Fase</label><p-select inputId="studio-game-phase" [ngModel]="gameDraft().phase" (ngModelChange)="updateGame('phase', $event)" [options]="phaseOptions" optionLabel="label" optionValue="value" fluid /></div>
        @if (gameDraft().phase === 'group') { <div class="dialog-field"><label for="studio-game-group">Girone</label><p-select inputId="studio-game-group" [ngModel]="gameDraft().groupId" (ngModelChange)="updateGame('groupId', $event)" [options]="groupOptions().slice(1)" optionLabel="label" optionValue="value" fluid /></div> }
        <div class="dialog-field"><label for="studio-game-round">Turno</label><p-inputnumber inputId="studio-game-round" [ngModel]="gameDraft().roundNo" (ngModelChange)="updateGame('roundNo', $event ?? 1)" [min]="1" fluid /></div>
        <div class="dialog-field"><label for="studio-team-one">Prima coppia</label><p-select inputId="studio-team-one" [ngModel]="gameDraft().team1Id" (ngModelChange)="updateGame('team1Id', $event)" [options]="teamOptions()" optionLabel="label" optionValue="value" placeholder="Slot libero" [showClear]="true" [filter]="true" fluid /></div>
        <div class="versus-mark">VS</div>
        <div class="dialog-field"><label for="studio-team-two">Seconda coppia</label><p-select inputId="studio-team-two" [ngModel]="gameDraft().team2Id" (ngModelChange)="updateGame('team2Id', $event)" [options]="teamOptions()" optionLabel="label" optionValue="value" placeholder="Slot libero / BYE" [showClear]="true" [filter]="true" fluid /></div>
      </div>
      <ng-template #footer><p-button label="Annulla" [text]="true" severity="secondary" (onClick)="gameDialog.set(false)" /><p-button label="Salva partita" icon="pi pi-check" [disabled]="!validGame()" [loading]="store.saving()" (onClick)="saveGame()" /></ng-template>
    </p-dialog>

  `,
  styles: `
    :host{display:block}.studio-shell{overflow:hidden;border:1px solid var(--color-border);border-radius:26px;background:var(--color-surface);box-shadow:0 18px 50px rgb(8 48 73/.07)}.studio-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:26px;color:white;background:linear-gradient(125deg,#082f49,#075985 56%,#0284c7)}.studio-heading p{margin:0 0 5px;color:#7dd3fc;font-size:.66rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.studio-heading h2{max-width:660px;margin:0;font:850 clamp(1.7rem,5vw,2.65rem)/.98 var(--display-font);letter-spacing:-.045em}.studio-heading span{display:block;max-width:650px;margin-top:10px;color:rgb(255 255 255/.72);font-size:.78rem;line-height:1.5}.live-mark{display:none;align-items:center;gap:8px;padding:9px 12px;border:1px solid rgb(255 255 255/.16);border-radius:999px;background:rgb(255 255 255/.1);font-size:.68rem;font-weight:850}.live-mark span{margin:0;color:white}.studio-tabs{display:flex;gap:3px;overflow-x:auto;padding:8px;border-bottom:1px solid var(--color-border);background:#f4fbff}.studio-tabs button{display:flex;min-height:44px;align-items:center;gap:8px;padding:0 15px;color:var(--color-ink-muted);border:0;border-radius:12px;background:transparent;font:inherit;font-size:.75rem;font-weight:850;white-space:nowrap;cursor:pointer}.studio-tabs button.active{color:#075985;background:white;box-shadow:0 3px 12px rgb(8 48 73/.08)}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:18px 18px 12px}.toolbar>div{display:grid;gap:3px}.toolbar strong{font-size:.9rem}.toolbar span{color:var(--color-ink-muted);font-size:.68rem}.group-board,.round-board{display:flex;align-items:stretch;gap:13px;overflow-x:auto;padding:8px 18px 24px;scroll-snap-type:x proximity}.team-lane,.round-lane{min-width:min(84vw,320px);overflow:hidden;border:1px solid #d8e8f0;border-radius:18px;background:#f7fcff;scroll-snap-align:start}.team-lane>header{display:flex;align-items:center;justify-content:space-between;padding:13px 14px;border-bottom:1px solid #d8e8f0;background:white}.team-lane>header>div:first-child{display:flex;align-items:center;gap:9px}.team-lane h3{margin:0;font-size:.82rem}.team-lane header>b{display:grid;min-width:26px;height:26px;place-items:center;color:#0369a1;border-radius:9px;background:#e0f2fe;font-size:.68rem}.lane-index{color:#0284c7;font:900 .63rem var(--display-font)}.lane-actions{display:flex}.unassigned{background:#f8fafc}.drop-zone{display:grid;min-height:160px;align-content:start;gap:8px;padding:10px}.team-chip{display:grid;grid-template-columns:22px 34px minmax(0,1fr) 78px;align-items:center;gap:8px;padding:9px;border:1px solid #d8e8f0;border-radius:14px;background:white;box-shadow:0 3px 10px rgb(8 48 73/.04)}.drag-handle{display:grid;min-height:36px;place-items:center;color:#8ba6b5;cursor:grab}.team-avatar{display:grid;width:34px;height:34px;place-items:center;color:white;border-radius:11px;background:#0284c7;font-size:.6rem;font-weight:900}.team-chip>div{display:grid;min-width:0}.team-chip strong{overflow:hidden;font-size:.68rem;text-overflow:ellipsis;white-space:nowrap}.team-chip small{color:var(--color-ink-muted);font-size:.58rem}.team-chip .p-select{min-width:0;font-size:.62rem}.drag-preview{padding:12px 16px;color:white;border-radius:12px;background:#0369a1;box-shadow:0 14px 30px rgb(3 105 161/.24);font-size:.72rem;font-weight:850}.drop-empty{display:grid;min-height:125px;place-content:center;justify-items:center;gap:8px;color:#78909c;font-size:.66rem;text-align:center;border:1px dashed #c8dce6;border-radius:13px}.drop-empty i{color:#0ea5e9;font-size:1.2rem}.team-lane>footer{display:flex;align-items:center;justify-content:space-between;padding:7px 11px;border-top:1px solid #d8e8f0;background:white}.team-lane>footer span{color:var(--color-ink-muted);font-size:.62rem}.cdk-drag-placeholder{opacity:.25}.cdk-drop-list-dragging{background:#eaf8ff}.round-board{align-items:flex-start}.round-lane{display:grid;gap:10px;padding:12px;background:#f7fcff}.round-lane>header{display:grid;gap:2px;padding:2px}.round-lane>header span{color:#0284c7;font-size:.58rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.round-lane>header strong{font-size:.9rem}.studio-game{display:grid;gap:7px;padding:11px;border:1px solid #d8e8f0;border-radius:14px;background:white}.studio-game>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;font-size:.68rem}.studio-game>div span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.studio-game em{color:#8ba6b5;font-size:.56rem;font-style:normal;text-align:center}.studio-game footer{display:flex;justify-content:flex-end;border-top:1px solid #e5eff4}.studio-empty{display:grid;min-width:min(88vw,620px);min-height:270px;place-content:center;justify-items:center;padding:28px;color:var(--color-ink-muted);text-align:center;border:1px dashed #c8dce6;border-radius:18px}.studio-empty i{color:#0284c7;font-size:2rem}.studio-empty h3,.studio-empty p{margin:5px}.rules-layout{display:grid;padding:18px}.rule-card{padding:16px;border:1px solid #d8e8f0;border-radius:19px;background:#fbfeff}.rule-card>.toolbar{padding:0 0 16px}.rule-grid{display:grid;gap:12px}.rule-grid label{display:grid;gap:7px;color:var(--color-ink);font-size:.68rem;font-weight:850}.no-draw{display:flex;align-items:center;gap:11px;padding:13px;margin-top:14px;color:#075985;border-radius:14px;background:#e0f2fe}.no-draw>i{font-size:1.2rem}.no-draw div{display:grid;gap:2px}.no-draw span{font-size:.65rem}.checks{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:9px;padding:16px 2px;font-size:.68rem}.rule-actions{display:flex;justify-content:flex-end;padding-top:14px;border-top:1px solid #d8e8f0}.game-form{display:grid;gap:12px}.versus-mark{color:#0284c7;font-size:.65rem;font-weight:900;text-align:center}
    @media(min-width:760px){.studio-heading{padding:34px}.live-mark{display:flex}.studio-tabs{padding-inline:20px}.group-board,.round-board{padding-inline:24px}.team-lane,.round-lane{min-width:310px}.rules-layout{padding:24px}.rule-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.game-form{grid-template-columns:1fr 1fr}.versus-mark{grid-column:1/-1}}
    @media(prefers-reduced-motion:reduce){.cdk-drag-animating{transition:none!important}}
  `,
})
export class TournamentStudio implements OnInit {
  readonly tournament = input.required<Tournament>();
  protected readonly store = inject(TournamentsStore);
  private readonly confirmation = inject(ConfirmationService);
  protected readonly view = signal<StudioView>('groups');
  protected readonly groupDialog = signal(false);
  protected readonly editingGroupId = signal<string | null>(null);
  protected readonly groupName = signal('');
  protected readonly gameDialog = signal(false);
  protected readonly rules = signal<TournamentRules>(this.emptyRules());
  protected readonly gameDraft = signal<TournamentGameDraft>({ phase: 'group', groupId: null, roundNo: 1, position: 1, team1Id: null, team2Id: null });
  protected readonly studioViews = [{ value: 'groups' as const, label: 'Gironi', icon: 'pi pi-users' }, { value: 'bracket' as const, label: 'Tabellone', icon: 'pi pi-sitemap' }, { value: 'rules' as const, label: 'Regole', icon: 'pi pi-sliders-h' }];
  protected readonly formatOptions = [{ label: 'Solo gironi', value: 'groups' }, { label: 'Solo eliminazione', value: 'knockout' }, { label: 'Gironi + fase finale', value: 'mixed' }];
  protected readonly bestOfOptions = [{ label: 'Un set', value: 1 }, { label: 'Al meglio di 3', value: 3 }, { label: 'Al meglio di 5', value: 5 }];
  protected readonly phaseOptions = [{ label: 'Girone', value: 'group' }, { label: 'Eliminazione diretta', value: 'knockout' }, { label: 'Piazzamento / terzo posto', value: 'third_place' }];
  protected readonly groups = computed(() => [...(this.tournament().groups ?? [])].sort((a, b) => a.position - b.position));
  protected readonly activeTeams = computed(() => this.tournament().teams.filter(team => team.status !== 'withdrawn'));
  protected readonly assignedTeamIds = computed(() => new Set((this.tournament().group_teams ?? []).map(link => link.team_id)));
  protected readonly unassignedTeams = computed(() => this.activeTeams().filter(team => !this.assignedTeamIds().has(team.id)));
  protected readonly groupOptions = computed(() => [{ label: 'Da assegnare', value: null }, ...this.groups().map(group => ({ label: group.name, value: group.id }))]);
  protected readonly teamOptions = computed(() => this.activeTeams().map(team => ({ label: this.teamName(team), value: team.id })));
  protected readonly dropListIds = computed(() => ['unassigned-teams', ...this.groups().map(group => `group-${group.id}`)]);
  protected readonly knockoutRounds = computed(() => {
    const games = (this.tournament().games ?? []).filter(game => game.phase !== 'group');
    const max = Math.max(0, ...games.map(game => game.round_no));
    return Array.from({ length: max }, (_, index) => ({ number: index + 1, games: games.filter(game => game.round_no === index + 1).sort((a, b) => a.position - b.position) }));
  });
  protected readonly validGame = computed(() => this.gameDraft().team1Id !== this.gameDraft().team2Id && (this.gameDraft().phase !== 'group' || !!this.gameDraft().groupId));

  ngOnInit(): void { this.rules.set(this.rulesFromTournament(this.tournament())); }
  protected teamsInGroup(groupId: string): readonly TournamentTeam[] { const ids = new Set((this.tournament().group_teams ?? []).filter(link => link.group_id === groupId).sort((a, b) => a.position - b.position).map(link => link.team_id)); return this.activeTeams().filter(team => ids.has(team.id)); }
  protected groupGames(groupId: string): readonly TournamentGame[] { return (this.tournament().games ?? []).filter(game => game.group_id === groupId); }
  protected groupIdForTeam(teamId: string): string | null { return this.tournament().group_teams?.find(link => link.team_id === teamId)?.group_id ?? null; }
  protected teamName(team: TournamentTeam): string { return teamLabel(team); }
  protected teamNameById(id: string | null): string { return id ? this.teamName(this.tournament().teams.find(team => team.id === id)!) : 'Slot libero / BYE'; }
  protected initials(team: TournamentTeam): string { return team.members.filter(member => member.status === 'accepted').map(member => member.profile?.nome?.[0] ?? '').join('').slice(0, 2).toUpperCase() || 'BV'; }
  protected dropTeam(event: CdkDragDrop<any>): void { void this.moveTeam(event.item.data as string, event.container.data as string | null); }
  protected async moveTeam(teamId: string, groupId: string | null): Promise<void> { if (groupId === this.groupIdForTeam(teamId)) return; await this.store.assignTeamToGroup(this.tournament().id, teamId, groupId); }
  protected openGroup(id: string | null = null, name = ''): void { this.editingGroupId.set(id); this.groupName.set(name); this.groupDialog.set(true); }
  protected async saveGroup(): Promise<void> { if (await this.store.saveGroup(this.tournament().id, this.editingGroupId(), this.groupName().trim())) this.groupDialog.set(false); }
  protected confirmDeleteGroup(id: string, name: string): void { this.confirmation.confirm({ header: `Elimina ${name}`, message: 'Le partite non ancora disputate del girone verranno eliminate. I gironi con risultati non possono essere rimossi.', icon: 'pi pi-trash', acceptLabel: 'Elimina girone', rejectLabel: 'Annulla', acceptButtonProps: { severity: 'danger' }, accept: () => void this.store.deleteGroup(this.tournament().id, id) }); }
  protected generateGames(groupId: string): void { void this.store.generateGroupGames(this.tournament().id, groupId); }
  protected nextRound(): number { return this.knockoutRounds().length + 1; }
  protected roundTitle(round: number): string { const total = this.knockoutRounds().length; return round === total ? 'Finale' : round === total - 1 ? 'Semifinali' : `Turno ${round}`; }
  protected openGame(game: TournamentGame | null = null, groupId: string | null = null, roundNo = 1): void { const phase = game?.phase ?? (groupId ? 'group' : 'knockout'); const games = this.tournament().games ?? []; const position = game?.position ?? Math.max(0, ...games.filter(item => item.phase === phase && item.round_no === roundNo).map(item => item.position)) + 1; this.gameDraft.set({ id: game?.id, phase, groupId: game?.group_id ?? groupId, roundNo: game?.round_no ?? roundNo, position, team1Id: game?.team1_id ?? null, team2Id: game?.team2_id ?? null }); this.gameDialog.set(true); }
  protected updateGame<K extends keyof TournamentGameDraft>(key: K, value: TournamentGameDraft[K]): void { this.gameDraft.update(game => ({ ...game, [key]: value })); }
  protected async saveGame(): Promise<void> { if (await this.store.saveGame(this.tournament().id, this.gameDraft())) this.gameDialog.set(false); }
  protected confirmDeleteGame(game: TournamentGame): void { this.confirmation.confirm({ header: 'Elimina partita', message: 'La partita verrà rimossa dal calendario.', icon: 'pi pi-trash', acceptLabel: 'Elimina', rejectLabel: 'Annulla', acceptButtonProps: { severity: 'danger' }, accept: () => void this.store.deleteGame(this.tournament().id, game.id) }); }
  protected updateRule<K extends keyof TournamentRules>(key: K, value: TournamentRules[K]): void { this.rules.update(rules => ({ ...rules, [key]: value })); }
  protected saveRules(): void { void this.store.updateRules(this.tournament().id, this.rules()); }
  private rulesFromTournament(item: Tournament): TournamentRules { return { registrationMode: item.registration_mode, format: item.format, maxTeams: item.max_teams, guaranteedMatches: item.guaranteed_matches, groupSize: item.group_size, qualifiersPerGroup: item.qualifiers_per_group, groupBestOf: item.group_best_of, groupSetPoints: item.group_set_points, knockoutBestOf: item.knockout_best_of, knockoutSetPoints: item.knockout_set_points, tiebreakPoints: item.tiebreak_points, winByTwo: item.win_by_two, thirdPlace: item.third_place, standingsWinPoints: item.standings_win_points, standingsLossPoints: item.standings_loss_points, minimumRestMinutes: item.minimum_rest_minutes, resultConfirmationRequired: item.result_confirmation_required }; }
  private emptyRules(): TournamentRules { return { registrationMode: 'hybrid', format: 'mixed', maxTeams: 64, guaranteedMatches: 0, groupSize: 4, qualifiersPerGroup: 2, groupBestOf: 1, groupSetPoints: 21, knockoutBestOf: 3, knockoutSetPoints: 21, tiebreakPoints: 15, winByTwo: true, thirdPlace: false, standingsWinPoints: 2, standingsLossPoints: 0, minimumRestMinutes: 0, resultConfirmationRequired: false }; }
}
