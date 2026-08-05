import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tournament, TournamentGame, TournamentGroup, TournamentTeam } from '../models/tournament.model';
import { TournamentsStore } from '../store/tournaments.store';
import { teamLabel } from '../tournaments.utils';

interface ScoreDraft { first: number; second: number; }

/**
 * Sezione "Gironi": a sinistra la lista dei partecipanti iscritti, a destra la creazione
 * dei gironi (nome, numero di giocatori, numero di partite) e la compilazione degli
 * incontri di ciascun girone.
 */
@Component({
  selector: 'app-tournament-groups',
  imports: [Button, FormsModule, InputNumber, InputText, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="groups-layout">
      <aside class="player-panel">
        <header><i class="pi pi-users" aria-hidden="true"></i><div><h3>Partecipanti</h3><small>{{ participants().length }} iscritti</small></div></header>

        @if (canManage()) {
          <label class="assignment-select" for="group-target">Girone di destinazione
            <p-select inputId="group-target" [ngModel]="selectedGroupId()" (ngModelChange)="selectedGroupId.set($event)" [options]="groupOptions()" optionLabel="label" optionValue="value" placeholder="Da assegnare" fluid />
          </label>
        }

        <div class="player-list">
          @for (entry of participants(); track entry.team.id) {
            <div class="player-row" [class.is-single]="entry.single">
              <span class="avatar">{{ entry.initials }}</span>
              <div>
                <strong>{{ entry.label }}</strong>
                <small>{{ entry.groupName ?? (entry.single ? 'Iscritto singolo' : 'Da assegnare') }}</small>
              </div>
              @if (canManage()) {
                @if (entry.groupName) {
                  <p-button icon="pi pi-times" [text]="true" severity="secondary" size="small" ariaLabel="Rimuovi dal girone" (onClick)="assign(entry.team.id, null)" />
                } @else {
                  <p-button icon="pi pi-arrow-right" [text]="true" size="small" ariaLabel="Assegna al girone" [disabled]="!selectedGroupId()" (onClick)="assign(entry.team.id, selectedGroupId())" />
                }
              }
            </div>
          } @empty {
            <p class="empty-copy">Nessun partecipante iscritto.</p>
          }
        </div>

        @if (canManage()) {
          <div class="add-player">
            <label for="new-player">Aggiungi un giocatore</label>
            <p-select inputId="new-player" [ngModel]="newPlayerId()" (ngModelChange)="newPlayerId.set($event)" [options]="playerOptions()" optionLabel="label" optionValue="value" placeholder="Cerca un giocatore" [filter]="true" filterBy="label" fluid />
            <p-button label="Iscrivi" icon="pi pi-user-plus" [disabled]="!newPlayerId()" [loading]="store.saving()" (onClick)="addPlayer()" />
          </div>
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
            <small class="create-hint">{{ unassigned().length }} giocatori disponibili da assegnare.</small>
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
              <div class="chips">
                @for (team of teamsInGroup(group.id); track team.id) {
                  @if (canManage()) {
                    <button type="button" (click)="assign(team.id, null)">{{ teamName(team) }} <i class="pi pi-times" aria-hidden="true"></i></button>
                  } @else {
                    <span>{{ teamName(team) }}</span>
                  }
                }
                @empty { <p class="empty-copy">Iscrivi prima dei giocatori.</p> }
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
                  @if (canManage() && game.status === 'scheduled') {
                    <p-select [ngModel]="game.team1_id" (ngModelChange)="setSlot(game, 'team1Id', $event)" [options]="slotOptions(group.id, game, 'team1')" optionLabel="label" optionValue="value" placeholder="—" [showClear]="true" appendTo="body" fluid />
                  } @else {
                    <span class="slot">{{ teamNameById(game.team1_id) }}</span>
                  }
                  <div class="score">
                    <p-inputnumber [ngModel]="scoreOf(game).first" (ngModelChange)="setScore(game, 'first', $event ?? 0)" [min]="0" [max]="99" [disabled]="!canScore(game)" [showButtons]="true" buttonLayout="vertical" [inputStyle]="{ width: '2.6rem' }" />
                    <em>vs</em>
                    <p-inputnumber [ngModel]="scoreOf(game).second" (ngModelChange)="setScore(game, 'second', $event ?? 0)" [min]="0" [max]="99" [disabled]="!canScore(game)" [showButtons]="true" buttonLayout="vertical" [inputStyle]="{ width: '2.6rem' }" />
                  </div>
                  @if (canManage() && game.status === 'scheduled') {
                    <p-select [ngModel]="game.team2_id" (ngModelChange)="setSlot(game, 'team2Id', $event)" [options]="slotOptions(group.id, game, 'team2')" optionLabel="label" optionValue="value" placeholder="—" [showClear]="true" appendTo="body" fluid />
                  } @else {
                    <span class="slot">{{ teamNameById(game.team2_id) }}</span>
                  }
                  @if (canManage()) {
                    <div class="match-actions">
                      <p-button icon="pi pi-check" [text]="true" size="small" ariaLabel="Salva risultato" [disabled]="!canScore(game) || !validScore(game)" [loading]="store.saving()" (onClick)="saveScore(game)" />
                      @if (game.status === 'scheduled') {
                        <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" ariaLabel="Elimina partita" (onClick)="confirmDeleteGame(game)" />
                      }
                    </div>
                  }
                </div>
              } @empty {
                <p class="empty-copy">Nessuna partita pianificata.</p>
              }
            </section>
          </article>
        } @empty {
          <div class="groups-empty">
            <i class="pi pi-trophy" aria-hidden="true"></i>
            <h3>Nessun girone creato</h3>
            <p>{{ canManage() ? 'Crea il primo girone e assegna i partecipanti dalla colonna a sinistra.' : 'L’organizzatore non ha ancora creato i gironi.' }}</p>
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    :host{display:block}
    .groups-layout{display:grid;gap:16px}
    .player-panel,.create-group,.group-card{border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 4px 14px rgb(15 23 42/.03)}
    .player-panel{padding:18px}
    .player-panel header{display:flex;align-items:center;gap:10px}
    .player-panel header i{display:grid;width:42px;height:42px;place-items:center;color:#f97316;border-radius:13px;background:#fff1e8}
    .player-panel h3,.create-title h3,.group-card h3{margin:0;font:900 1.2rem/1 var(--display-font);letter-spacing:-.035em}
    .player-panel small,.cap{color:#72869b;font-size:.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    .assignment-select,.add-player label{display:grid;gap:6px;color:#567084;font-size:.65rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}
    .assignment-select{margin:14px 0 12px}
    .player-list{display:grid;gap:7px;max-height:420px;overflow:auto}
    .player-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:9px;min-height:52px;padding:8px 9px;border-radius:12px;background:#f8fafc}
    .player-row.is-single{background:#fff7ed}
    .player-row>div{display:grid;min-width:0}
    .player-row strong{overflow:hidden;font-size:.76rem;text-overflow:ellipsis;white-space:nowrap}
    .player-row small{color:#72869b;font-size:.62rem;font-weight:600;letter-spacing:0;text-transform:none}
    .avatar{display:grid;width:34px;height:34px;place-items:center;color:#f97316;border-radius:50%;background:#fff0e6;font-size:.65rem;font-weight:900}
    .add-player{display:grid;gap:8px;padding-top:14px;margin-top:14px;border-top:1px solid #e5e7eb}
    .groups-main{display:grid;gap:16px}
    .create-group{display:grid;gap:12px;padding:20px}
    .create-title{display:flex;align-items:center;gap:10px}
    .create-title i{display:grid;width:42px;height:42px;place-items:center;color:#f97316;border-radius:13px;background:#fff1e8}
    .create-fields{display:grid;gap:12px;align-items:end}
    .create-fields label{display:grid;gap:6px;color:#64748b;font-size:.65rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}
    .create-fields input{width:100%}
    .create-hint{color:#94a3b8;font-size:.68rem}
    .group-card{overflow:hidden}
    .group-card>header{display:flex;align-items:center;justify-content:space-between;min-height:74px;padding:14px 20px;color:#fff;background:linear-gradient(105deg,#ff7900,#ffb100 72%,#ffd500)}
    .group-card>header>div{display:flex;align-items:center;gap:10px}
    .group-card>header b{display:grid;width:36px;height:36px;place-items:center;border-radius:12px;background:rgb(255 255 255/.22)}
    .group-card section{padding:18px 20px}
    .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
    .chips button,.chips span{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:8px 12px;color:#fff;border:0;border-radius:999px;background:#0795f4;font:inherit;font-size:.72rem;font-weight:800}
    .chips button{cursor:pointer}
    .matches-head{display:flex;align-items:center;gap:8px;padding-top:14px;margin:18px 0 8px;border-top:1px solid #e5e7eb}
    .matches-head span{margin-right:auto;color:#72869b;font-size:.68rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
    .match-row{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px;padding:10px;margin-top:8px;border-radius:12px;background:#f8fafc;font-size:.72rem}
    .match-row>b{display:grid;width:28px;height:28px;place-items:center;color:#0369a1;border-radius:9px;background:#e0f2fe;font-size:.66rem}
    .match-row .slot{overflow:hidden;font-weight:700;text-overflow:ellipsis;white-space:nowrap}
    .score{display:flex;align-items:center;justify-content:center;gap:8px;grid-column:1/-1}
    .score em{color:#72869b;font-style:normal;font-weight:900}
    .match-actions{display:flex;justify-content:flex-end;grid-column:1/-1}
    .empty-copy{margin:6px 0 0;color:#94a3b8;font-size:.72rem}
    .groups-empty{display:grid;min-height:220px;place-content:center;justify-items:center;gap:6px;padding:26px;color:#94a3b8;text-align:center;border:1px dashed #cbd5e1;border-radius:18px}
    .groups-empty i{color:#f97316;font-size:2rem}
    .groups-empty h3{margin:4px;color:var(--color-ink)}
    @media(min-width:760px){
      .groups-layout{grid-template-columns:300px minmax(0,1fr);gap:22px}
      .player-panel{position:sticky;top:16px;align-self:start}
      .create-fields{grid-template-columns:minmax(0,1.6fr) repeat(2,minmax(0,.7fr)) auto}
      .match-row{grid-template-columns:34px minmax(120px,1fr) auto minmax(120px,1fr) auto}
      .score,.match-actions{grid-column:auto}
    }
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
  protected readonly selectedGroupId = signal<string | null>(null);
  protected readonly newPlayerId = signal<string | null>(null);
  private readonly scoreDrafts = signal<Record<string, ScoreDraft>>({});

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
        single: accepted.length === 1,
        groupName: groupId ? names.get(groupId) ?? null : null,
        initials: accepted.map((member) => member.profile?.nome?.[0] ?? '').join('').slice(0, 2).toUpperCase() || 'BV',
      };
    });
  });

  protected readonly groupOptions = computed(() => this.groups().map((group) => ({ label: group.name, value: group.id })));
  protected readonly playerOptions = computed(() => {
    const involved = new Set(this.activeTeams().flatMap((team) => team.members.map((member) => member.profile_id)));
    return this.store.players()
      .filter((player) => !involved.has(player.id))
      .map((player) => ({ value: player.id, label: `${player.nome} ${player.cognome} · L${player.livello}` }));
  });

  protected teamName(team: TournamentTeam): string { return teamLabel(team); }
  protected teamNameById(id: string | null): string { return id ? teamLabel(this.tournament().teams.find((team) => team.id === id)) : '—'; }

  protected teamsInGroup(groupId: string): readonly TournamentTeam[] {
    const links = (this.tournament().group_teams ?? []).filter((link) => link.group_id === groupId).sort((a, b) => a.position - b.position);
    return links.map((link) => this.activeTeams().find((team) => team.id === link.team_id)).filter((team): team is TournamentTeam => !!team);
  }

  protected groupGames(groupId: string): readonly TournamentGame[] {
    return (this.tournament().games ?? []).filter((game) => game.group_id === groupId).sort((a, b) => a.position - b.position);
  }

  /** Nel select di uno slot restano i giocatori del girone non ancora impegnati nell'altro slot. */
  protected slotOptions(groupId: string, game: TournamentGame, slot: 'team1' | 'team2') {
    const opposite = slot === 'team1' ? game.team2_id : game.team1_id;
    return this.teamsInGroup(groupId)
      .filter((team) => team.id !== opposite)
      .map((team) => ({ value: team.id, label: this.teamName(team) }));
  }

  protected scoreOf(game: TournamentGame): ScoreDraft {
    return this.scoreDrafts()[game.id] ?? { first: game.team1_scores?.[0] ?? 0, second: game.team2_scores?.[0] ?? 0 };
  }

  protected setScore(game: TournamentGame, key: keyof ScoreDraft, value: number): void {
    const current = this.scoreOf(game);
    this.scoreDrafts.update((drafts) => ({ ...drafts, [game.id]: { ...current, [key]: value } }));
  }

  protected canScore(game: TournamentGame): boolean { return this.canManage() && !!game.team1_id && !!game.team2_id; }
  protected validScore(game: TournamentGame): boolean {
    const score = this.scoreOf(game);
    return score.first !== score.second;
  }

  protected async saveScore(game: TournamentGame): Promise<void> {
    if (!this.canScore(game) || !this.validScore(game)) return;
    const score = this.scoreOf(game);
    await this.store.submitResult(this.tournament().id, game.id, [score.first], [score.second]);
  }

  protected setSlot(game: TournamentGame, key: 'team1Id' | 'team2Id', value: string | null): void {
    void this.store.saveGame(this.tournament().id, {
      id: game.id,
      phase: 'group',
      groupId: game.group_id,
      roundNo: game.round_no,
      position: game.position,
      team1Id: key === 'team1Id' ? value : game.team1_id,
      team2Id: key === 'team2Id' ? value : game.team2_id,
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
    void this.store.assignTeamToGroup(this.tournament().id, teamId, groupId);
  }

  protected async addPlayer(): Promise<void> {
    const playerId = this.newPlayerId();
    if (playerId && await this.store.addPlayer(this.tournament().id, playerId, this.selectedGroupId())) {
      this.newPlayerId.set(null);
    }
  }

  protected generateGames(groupId: string): void { void this.store.generateGroupGames(this.tournament().id, groupId); }

  protected confirmDeleteGroup(id: string, name: string): void {
    this.confirmation.confirm({
      header: `Elimina ${name}`,
      message: 'Le partite non ancora disputate del girone verranno eliminate. I gironi con risultati non possono essere rimossi.',
      icon: 'pi pi-trash', acceptLabel: 'Elimina girone', rejectLabel: 'Annulla',
      acceptButtonProps: { severity: 'danger' }, rejectButtonProps: { severity: 'secondary', variant: 'text' },
      accept: () => void this.store.deleteGroup(this.tournament().id, id),
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
