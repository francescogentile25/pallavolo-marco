import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Tournament, TournamentGame, TournamentGroup, TournamentTeam } from '../models/tournament.model';
import { TournamentsStore } from '../store/tournaments.store';
import { teamLabel } from '../tournaments.utils';

interface SlotTarget { gameId: string; slot: number; }

/**
 * Sezione "Gironi": a sinistra i partecipanti iscritti, a destra la creazione dei gironi
 * (nome, numero di giocatori, numero di partite). I giocatori si trascinano dalla colonna
 * di sinistra prima dentro un girone, poi dentro una partita di quel girone.
 * Qui non si registrano punteggi: si creano solo le partite. I risultati si inseriscono
 * nella sezione "Risultati gironi".
 */
@Component({
  selector: 'app-tournament-groups',
  imports: [Button, DragDropModule, FormsModule, InputNumber, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="groups-layout">
      <aside class="player-panel">
        <header><i class="pi pi-users" aria-hidden="true"></i><div><h3>Partecipanti</h3><small>{{ participants().length }} iscritti</small></div></header>

        <div class="player-list" cdkDropList id="players-pool" [cdkDropListData]="poolTarget" [cdkDropListConnectedTo]="groupListIds()" [cdkDropListSortingDisabled]="true" (cdkDropListDropped)="dropOnGroup($event)">
          @for (entry of participants(); track entry.team.id) {
            <div
              class="player-row"
              [class.is-assigned]="!!entry.groupName"
              [class.is-held]="heldTeamId() === entry.team.id"
              cdkDrag
              [cdkDragData]="entry.team.id"
              [cdkDragDisabled]="!canManage()"
            >
              <span class="avatar">{{ entry.initials }}</span>
              <div>
                <strong>{{ entry.label }}</strong>
                <small>{{ entry.groupName ?? 'Da assegnare' }}</small>
              </div>
              @if (canManage()) {
                <p-button [icon]="heldTeamId() === entry.team.id ? 'pi pi-check' : 'pi pi-arrows-alt'" [text]="true" size="small" [ariaLabel]="heldTeamId() === entry.team.id ? 'Annulla selezione' : 'Seleziona per spostare'" (onClick)="hold(entry.team.id)" />
                @if (entry.groupName) {
                  <p-button icon="pi pi-times" [text]="true" severity="secondary" size="small" ariaLabel="Togli dal girone" (onClick)="assign(entry.team.id, null)" />
                }
              }
              <div class="drag-preview" *cdkDragPreview>{{ entry.label }}</div>
            </div>
          } @empty {
            <p class="empty-copy">Nessun partecipante iscritto. Aggiungi gli iscritti dalla sezione Partecipanti.</p>
          }
        </div>

        @if (canManage()) {
          <p class="panel-hint">Trascina un partecipante dentro un girone, poi dal girone dentro una partita. Puoi anche spostarlo in un altro girone o riportarlo qui. In alternativa selezionalo e tocca la destinazione.</p>
        }
      </aside>

      <section class="groups-main">
        @if (canManage()) {
          <div class="create-group">
            <div class="create-title"><i class="pi pi-trophy" aria-hidden="true"></i><h3>Crea un Girone</h3></div>
            <div class="create-fields">
              <label for="group-name">Nome girone<input id="group-name" pInputText [ngModel]="groupName()" (ngModelChange)="groupName.set($event)" placeholder="Es. Girone A" /></label>
              <label for="group-capacity">N° giocatori<p-inputnumber inputId="group-capacity" [ngModel]="groupCapacity()" (ngModelChange)="groupCapacity.set($event ?? 4)" [min]="2" [max]="32" [showButtons]="true" fluid /></label>
              <label for="group-matches">N° partite<p-inputnumber inputId="group-matches" [ngModel]="groupMatches()" (ngModelChange)="groupMatches.set($event ?? 0)" [min]="0" [max]="60" [showButtons]="true" fluid /></label>
              <p-button label="Crea" icon="pi pi-plus" [disabled]="!groupName().trim()" [loading]="store.saving()" (onClick)="createGroup()" />
            </div>
            <div class="create-foot">
              <small class="create-hint">{{ unassigned().length }} giocatori disponibili da assegnare.</small>
              @if (groups().length) {
                <p-button label="Elimina tutti i gironi" icon="pi pi-trash" [text]="true" severity="danger" size="small" [loading]="store.saving()" (onClick)="confirmResetGroups()" />
              }
            </div>
          </div>
        }

        @for (group of groups(); track group.id; let index = $index) {
          <article class="group-card">
            <header>
              <div><b>{{ index + 1 }}</b><h3>{{ group.name }}</h3></div>
              @if (canManage()) {
                <p-button icon="pi pi-trash" [text]="true" severity="secondary" ariaLabel="Elimina girone" (onClick)="confirmDeleteGroup(group.id, group.name)" />
              }
            </header>
            <section>
              <p class="cap">Giocatori ({{ teamsInGroup(group.id).length }}{{ group.capacity ? '/' + group.capacity : '' }})</p>
              <div
                class="chips"
                [class.is-target]="canManage() && !!heldTeamId()"
                cdkDropList
                [id]="'group-' + group.id"
                [cdkDropListData]="groupTarget(group.id)"
                [cdkDropListConnectedTo]="groupTargets(group.id)"
                [cdkDropListSortingDisabled]="true"
                (cdkDropListDropped)="dropOnGroup($event)"
                (click)="placeHeldInGroup(group.id)"
              >
                @for (team of teamsInGroup(group.id); track team.id) {
                  <div
                    class="chip"
                    [class.is-held]="heldTeamId() === team.id"
                    cdkDrag
                    [cdkDragData]="team.id"
                    [cdkDragDisabled]="!canManage()"
                    (click)="hold(team.id); $event.stopPropagation()"
                  >
                    <span>{{ teamName(team) }}</span>
                    @if (canManage()) {
                      <button type="button" aria-label="Togli dal girone" (click)="assign(team.id, null); $event.stopPropagation()"><i class="pi pi-times" aria-hidden="true"></i></button>
                    }
                    <div class="drag-preview" *cdkDragPreview>{{ teamName(team) }}</div>
                  </div>
                } @empty {
                  <p class="empty-copy">Iscrivi prima dei giocatori.</p>
                }
              </div>

              <div class="matches-head">
                <span>Partite ({{ groupGames(group.id).length }})</span>
                @if (canManage()) {
                  <p-button label="Genera" [text]="true" size="small" (onClick)="generateGames(group.id)" />
                  <p-button icon="pi pi-plus" [text]="true" size="small" ariaLabel="Aggiungi partita" (onClick)="addSlot(group)" />
                }
              </div>

              @for (game of groupGames(group.id); track game.id; let position = $index) {
                <div class="match-row">
                  <b>#{{ position + 1 }}</b>
                  <div
                    class="match-slot"
                    [class.is-open]="canManage() && !game.team1_id"
                    [class.is-target]="canManage() && !!heldTeamId()"
                    cdkDropList
                    [id]="'gslot-' + game.id + '-1'"
                    [cdkDropListData]="{ gameId: game.id, slot: 1 }"
                    (cdkDropListDropped)="dropOnSlot($event)"
                    (click)="placeHeldInSlot(game, 1)"
                  >
                    <span>{{ teamNameById(game.team1_id) }}</span>
                    @if (canManage() && game.team1_id && game.status === 'scheduled') {
                      <button type="button" aria-label="Svuota slot" (click)="clearSlot(game, 1); $event.stopPropagation()"><i class="pi pi-times" aria-hidden="true"></i></button>
                    }
                  </div>
                  <em>vs</em>
                  <div
                    class="match-slot"
                    [class.is-open]="canManage() && !game.team2_id"
                    [class.is-target]="canManage() && !!heldTeamId()"
                    cdkDropList
                    [id]="'gslot-' + game.id + '-2'"
                    [cdkDropListData]="{ gameId: game.id, slot: 2 }"
                    (cdkDropListDropped)="dropOnSlot($event)"
                    (click)="placeHeldInSlot(game, 2)"
                  >
                    <span>{{ teamNameById(game.team2_id) }}</span>
                    @if (canManage() && game.team2_id && game.status === 'scheduled') {
                      <button type="button" aria-label="Svuota slot" (click)="clearSlot(game, 2); $event.stopPropagation()"><i class="pi pi-times" aria-hidden="true"></i></button>
                    }
                  </div>
                  @if (canManage() && game.status === 'scheduled') {
                    <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" ariaLabel="Elimina partita" (onClick)="confirmDeleteGame(game)" />
                  }
                </div>
              } @empty {
                <p class="empty-copy">Nessuna partita pianificata.</p>
              }

              <p class="score-note"><i class="pi pi-info-circle" aria-hidden="true"></i> I punteggi si inseriscono nella sezione <strong>Risultati gironi</strong>.</p>
            </section>
          </article>
        } @empty {
          <div class="groups-empty">
            <i class="pi pi-trophy" aria-hidden="true"></i>
            <h3>Nessun girone creato</h3>
            <p>{{ canManage() ? 'Crea il primo girone e trascina i partecipanti dalla colonna a sinistra.' : 'L’organizzatore non ha ancora creato i gironi.' }}</p>
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    :host{display:block}
    .groups-layout{display:grid;gap:16px}
    .player-panel,.create-group,.group-card{border:1px solid #d9cdb4;border-radius:var(--radius-lg);background:#fff;box-shadow:0 4px 14px rgb(15 23 42/.03)}
    .player-panel{padding:18px}
    .player-panel header{display:flex;align-items:center;gap:10px;margin-bottom:12px}
    .player-panel header i{display:grid;width:42px;height:42px;place-items:center;color:#ffc72c;border-radius:var(--radius);background:#fff4d6}
    .player-panel h3,.create-title h3,.group-card h3{margin:0;font:900 1.2rem/1 var(--display-font);letter-spacing:-.035em}
    .player-panel small,.cap{color:#5b6a72;font-size:.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    .player-list{display:grid;gap:7px;max-height:460px;overflow:auto}
    .player-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:4px;min-height:52px;padding:8px 9px;border-radius:var(--radius);background:#faf7f0;cursor:grab}
    .player-row.is-assigned{opacity:.55}
    .player-row.is-held{outline:2px solid var(--color-brand);background:#e3e8ff}
    .player-row>div{display:grid;min-width:0}
    .player-row strong{overflow:hidden;font-size:.76rem;text-overflow:ellipsis;white-space:nowrap}
    .player-row small{color:#5b6a72;font-size:.62rem;font-weight:600;letter-spacing:0;text-transform:none}
    .avatar{display:grid;width:34px;height:34px;place-items:center;color:#ffc72c;border-radius:50%;background:#fff4d6;font-size:.65rem;font-weight:900}
    .panel-hint{margin:12px 0 0;color:#8d7f66;font-size:.66rem;line-height:1.45}
    .drag-preview{padding:10px 14px;color:#fff;border-radius:var(--radius);background:#1740b0;box-shadow:0 14px 30px rgb(3 105 161/.24);font-size:.72rem;font-weight:850}
    .groups-main{display:grid;gap:16px}
    .create-group{display:grid;gap:12px;padding:20px}
    .create-title{display:flex;align-items:center;gap:10px}
    .create-title i{display:grid;width:42px;height:42px;place-items:center;color:#ffc72c;border-radius:var(--radius);background:#fff4d6}
    .create-fields{display:grid;gap:12px;align-items:end}
    .create-fields label{display:grid;gap:6px;color:#5b6a72;font-size:.65rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}
    .create-fields input{width:100%}
    .create-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}
    .create-hint{color:#8d7f66;font-size:.68rem}
    .group-card{overflow:hidden}
    .group-card>header{display:flex;align-items:center;justify-content:space-between;min-height:74px;padding:14px 20px;color:#fff;background:linear-gradient(105deg,#ffc72c,#ffc72c 72%,#ffc72c)}
    .group-card>header>div{display:flex;align-items:center;gap:10px}
    .group-card>header b{display:grid;width:36px;height:36px;place-items:center;border-radius:var(--radius);background:rgb(255 255 255/.22)}
    .group-card section{padding:18px 20px}
    .chips{display:flex;flex-wrap:wrap;gap:8px;min-height:56px;padding:8px;margin-top:8px;border:1px dashed transparent;border-radius:var(--radius)}
    .chips.is-target{border-color:#1b4fd8;background:#eef2ff}
    .chips.cdk-drop-list-receiving{border-color:#1b4fd8;background:#e3e8ff}
    .chip{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:8px 12px;color:#fff;border-radius:999px;background:#1b4fd8;font-size:.72rem;font-weight:800;cursor:grab}
    .chip.is-held{outline:2px solid #0b1e25;outline-offset:2px}
    .chip button{display:grid;place-items:center;width:32px;height:32px;margin:-6px -8px -6px 0;color:inherit;border:0;background:none;font-size:.68rem;cursor:pointer}
    .matches-head{display:flex;align-items:center;gap:8px;padding-top:14px;margin:18px 0 8px;border-top:1px solid #e7decb}
    .matches-head span{margin-right:auto;color:#5b6a72;font-size:.68rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
    .match-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px;padding:10px;margin-top:8px;border-radius:var(--radius);background:#faf7f0;font-size:.72rem}
    .match-row>b{display:grid;width:28px;height:28px;place-items:center;color:#1740b0;border-radius:var(--radius);background:#e3e8ff;font-size:.66rem}
    .match-row>em{grid-column:1/-1;color:#5b6a72;font-style:normal;font-weight:900;text-align:center}
    .match-slot{display:flex;align-items:center;justify-content:space-between;gap:8px;grid-column:1/-1;min-height:44px;padding:8px 11px;border:1px solid #d9cdb4;border-radius:var(--radius);background:#fff;font-weight:700}
    .match-slot>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .match-slot.is-open{border-style:dashed;border-color:#8d7f66;color:#8d7f66}
    .match-slot.is-target{border-color:#1b4fd8;background:#eef2ff;cursor:pointer}
    .match-slot.cdk-drop-list-receiving{border-color:#1b4fd8;background:#e3e8ff}
    .match-slot button{display:grid;place-items:center;width:44px;height:44px;margin:-8px -8px -8px 0;color:#8d7f66;border:0;background:none;font-size:.68rem;cursor:pointer}
    .score-note{display:flex;align-items:center;gap:7px;margin:16px 0 0;color:#8d7f66;font-size:.68rem}
    .empty-copy{margin:6px 0 0;color:#8d7f66;font-size:.72rem}
    .groups-empty{display:grid;min-height:220px;place-content:center;justify-items:center;gap:6px;padding:26px;color:#8d7f66;text-align:center;border:1px dashed #d9cdb4;border-radius:var(--radius-lg)}
    .groups-empty i{color:#ffc72c;font-size:2rem}
    .groups-empty h3{margin:4px;color:var(--color-ink)}
    @media(min-width:760px){
      .groups-layout{grid-template-columns:300px minmax(0,1fr);gap:22px}
      .player-panel{position:sticky;top:16px;align-self:start}
      .create-fields{grid-template-columns:minmax(0,1.6fr) repeat(2,minmax(0,.7fr)) auto}
      .match-row{grid-template-columns:34px minmax(120px,1fr) auto minmax(120px,1fr) auto}
      .match-row>em,.match-slot{grid-column:auto}
    }
    @media(prefers-reduced-motion:reduce){.cdk-drag-animating{transition:none!important}}
  `,
})
export class TournamentGroups {
  readonly tournament = input.required<Tournament>();
  readonly canManage = input<boolean>(false);

  protected readonly store = inject(TournamentsStore);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly groupName = signal('');
  protected readonly groupCapacity = signal(4);
  protected readonly groupMatches = signal(3);
  protected readonly heldTeamId = signal<string | null>(null);

  protected readonly groups = computed(() => [...(this.tournament().groups ?? [])].sort((a, b) => a.position - b.position));
  protected readonly activeTeams = computed(() => this.tournament().teams.filter((team) => team.status !== 'withdrawn'));
  private readonly groupIdByTeam = computed(() => new Map((this.tournament().group_teams ?? []).map((link) => [link.team_id, link.group_id])));
  protected readonly unassigned = computed(() => this.activeTeams().filter((team) => !this.groupIdByTeam().has(team.id)));

  protected readonly participants = computed(() => {
    const names = new Map(this.groups().map((group) => [group.id, group.name]));
    return this.activeTeams().map((team) => {
      const accepted = team.members.filter((member) => member.status !== 'rejected');
      const groupId = this.groupIdByTeam().get(team.id) ?? null;
      return {
        team,
        label: teamLabel(team),
        groupName: groupId ? names.get(groupId) ?? null : null,
        initials: accepted.map((member) => member.profile?.nome?.[0] ?? '').join('').slice(0, 2).toUpperCase() || 'BV',
      };
    });
  });

  /** La colonna dei partecipanti alimenta i gironi; ogni girone alimenta i propri slot partita. */
  protected readonly groupListIds = computed(() => this.groups().map((group) => `group-${group.id}`));
  /** Destinazione della colonna partecipanti: nessun girone. */
  protected readonly poolTarget: string | null = null;
  protected groupTarget(groupId: string): string | null { return groupId; }
  protected slotListIds(groupId: string): string[] {
    return this.groupGames(groupId).flatMap((game) => [`gslot-${game.id}-1`, `gslot-${game.id}-2`]);
  }

  /** Da un girone si puo spostare negli altri gironi, nelle sue partite o di nuovo fuori. */
  protected groupTargets(groupId: string): string[] {
    return [
      'players-pool',
      ...this.groupListIds().filter((id) => id !== `group-${groupId}`),
      ...this.slotListIds(groupId),
    ];
  }

  protected teamName(team: TournamentTeam): string { return teamLabel(team); }
  protected teamNameById(id: string | null): string { return id ? teamLabel(this.tournament().teams.find((team) => team.id === id)) : '—'; }

  protected teamsInGroup(groupId: string): readonly TournamentTeam[] {
    const links = (this.tournament().group_teams ?? []).filter((link) => link.group_id === groupId).sort((a, b) => a.position - b.position);
    return links.map((link) => this.activeTeams().find((team) => team.id === link.team_id)).filter((team): team is TournamentTeam => !!team);
  }

  protected groupGames(groupId: string): readonly TournamentGame[] {
    return (this.tournament().games ?? []).filter((game) => game.group_id === groupId).sort((a, b) => a.position - b.position);
  }

  protected hold(teamId: string): void {
    if (!this.canManage()) return;
    this.heldTeamId.update((current) => (current === teamId ? null : teamId));
  }

  /** Vale sia per i gironi sia per la colonna dei partecipanti, che ha data null. */
  protected dropOnGroup(event: CdkDragDrop<string | null>): void {
    if (!this.canManage()) return;
    this.heldTeamId.set(null);
    this.assign(event.item.data as string, event.container.data ?? null);
  }

  protected placeHeldInGroup(groupId: string): void {
    const teamId = this.heldTeamId();
    if (!this.canManage() || !teamId) return;
    this.heldTeamId.set(null);
    this.assign(teamId, groupId);
  }

  protected dropOnSlot(event: CdkDragDrop<SlotTarget>): void {
    const target = event.container.data;
    if (!this.canManage() || !target?.gameId) return;
    const game = (this.tournament().games ?? []).find((item) => item.id === target.gameId);
    if (!game) return;
    this.heldTeamId.set(null);
    this.fillSlot(game, target.slot, event.item.data as string);
  }

  protected placeHeldInSlot(game: TournamentGame, slot: number): void {
    const teamId = this.heldTeamId();
    if (!this.canManage() || !teamId) return;
    this.heldTeamId.set(null);
    this.fillSlot(game, slot, teamId);
  }

  protected clearSlot(game: TournamentGame, slot: number): void { this.saveSlot(game, slot, null); }

  /** Uno slot accetta solo giocatori già assegnati al girone di quella partita. */
  private fillSlot(game: TournamentGame, slot: number, teamId: string): void {
    if (game.status !== 'scheduled') return;
    if (!game.group_id || this.groupIdByTeam().get(teamId) !== game.group_id) return;
    if ((slot === 1 ? game.team2_id : game.team1_id) === teamId) return;
    this.saveSlot(game, slot, teamId);
  }

  private saveSlot(game: TournamentGame, slot: number, teamId: string | null): void {
    void this.store.saveGame(this.tournament().id, {
      id: game.id,
      phase: 'group',
      groupId: game.group_id,
      roundNo: game.round_no,
      position: game.position,
      team1Id: slot === 1 ? teamId : game.team1_id,
      team2Id: slot === 2 ? teamId : game.team2_id,
    });
  }

  protected async createGroup(): Promise<void> {
    const name = this.groupName().trim();
    if (!name) return;
    if (await this.store.saveGroup(this.tournament().id, null, name, this.groupCapacity(), this.groupMatches())) {
      this.groupName.set('');
    }
  }

  protected addSlot(group: TournamentGroup): void {
    const planned = this.groupGames(group.id).length + 1;
    void this.store.saveGroup(this.tournament().id, group.id, group.name, null, planned);
  }

  protected assign(teamId: string, groupId: string | null): void {
    if ((this.groupIdByTeam().get(teamId) ?? null) === groupId) return;
    void this.store.assignTeamToGroup(this.tournament().id, teamId, groupId);
  }

  protected generateGames(groupId: string): void { void this.store.generateGroupGames(this.tournament().id, groupId); }

  protected confirmDeleteGroup(id: string, name: string): void {
    const played = this.groupGames(id).some((game) => game.status !== 'scheduled');
    this.confirmation.confirm({
      header: `Elimina ${name}`,
      message: played
        ? 'Il girone contiene risultati già registrati: verranno eliminati insieme alle partite. L’operazione non è reversibile.'
        : 'Il girone e le sue partite verranno eliminati.',
      icon: 'pi pi-trash', acceptLabel: 'Elimina girone', rejectLabel: 'Annulla',
      acceptButtonProps: { severity: 'danger' }, rejectButtonProps: { severity: 'secondary', variant: 'text' },
      accept: () => void this.store.deleteGroup(this.tournament().id, id, played),
    });
  }

  protected confirmResetGroups(): void {
    this.confirmation.confirm({
      header: 'Elimina tutti i gironi',
      message: 'Tutti i gironi, le loro partite e i risultati registrati verranno eliminati, così puoi ricostruirli da zero. L’operazione non è reversibile.',
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Elimina tutto', rejectLabel: 'Annulla',
      acceptButtonProps: { severity: 'danger' }, rejectButtonProps: { severity: 'secondary', variant: 'text' },
      accept: () => void this.store.resetGroups(this.tournament().id),
    });
  }

  protected confirmDeleteGame(game: TournamentGame): void {
    this.confirmation.confirm({
      header: 'Elimina partita', message: 'La partita verrà rimossa dal girone.',
      icon: 'pi pi-trash', acceptLabel: 'Elimina', rejectLabel: 'Annulla',
      acceptButtonProps: { severity: 'danger' }, rejectButtonProps: { severity: 'secondary', variant: 'text' },
      accept: () => void this.store.deleteGame(this.tournament().id, game.id),
    });
  }
}
