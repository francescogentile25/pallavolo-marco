import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { MessageService } from 'primeng/api';
import { CreateTournamentRequest, TournamentGameDraft, TournamentPresetRules, TournamentState } from '../models/tournament.model';
import { TournamentsService } from '../services/tournaments.service';
import { tournamentErrorMessage } from '../tournaments.utils';

const initialState: TournamentState = { tournaments: [], selected: null, courts: [], players: [], presets: [], loading: false, saving: false, error: null };

export const TournamentsStore = signalStore(
  { providedIn: 'root' }, withState(initialState),
  withMethods((store, service = inject(TournamentsService), messages = inject(MessageService)) => {
    const fail = (error: unknown): false => { const message = tournamentErrorMessage(error); patchState(store, { loading: false, saving: false, error: message }); messages.add({ severity: 'error', summary: 'Operazione non riuscita', detail: message }); return false; };
    const refresh = async (id: string) => patchState(store, { selected: await service.getTournament(id) });
    const act = async (id: string, operation: () => Promise<void>, summary: string, detail: string): Promise<boolean> => {
      patchState(store, { saving: true, error: null }); try { await operation(); await refresh(id); patchState(store, { saving: false }); messages.add({ severity: 'success', summary, detail }); return true; } catch (error) { return fail(error); }
    };
    return {
      async loadList(silent = false): Promise<void> { if (!silent) patchState(store, { loading: true, error: null }); try { patchState(store, { tournaments: await service.getTournaments(), loading: false }); } catch (error) { fail(error); } },
      async load(id: string, silent = false): Promise<void> { if (!silent) patchState(store, { loading: true, error: null }); try { await refresh(id); patchState(store, { loading: false }); } catch (error) { fail(error); } },
      async loadOptions(): Promise<void> { try { const [courts, players, presets] = await Promise.all([service.getCourts(), service.getPlayers(), service.getPersonalPresets()]); patchState(store, { courts, players, presets }); } catch (error) { fail(error); } },
      async loadPresets(): Promise<void> { try { patchState(store, { presets: await service.getPersonalPresets() }); } catch (error) { fail(error); } },
      async savePreset(name: string, description: string | null, rules: TournamentPresetRules): Promise<boolean> { patchState(store, { saving: true, error: null }); try { await service.createPersonalPreset(name, description, rules); patchState(store, { presets: await service.getPersonalPresets(), saving: false }); messages.add({ severity: 'success', summary: 'Preset salvato', detail: 'Lo trovi nella tua raccolta personale.' }); return true; } catch (error) { return fail(error); } },
      async favoritePreset(id: string, favorite: boolean): Promise<boolean> { patchState(store, { saving: true }); try { await service.setPresetFavorite(id, favorite); patchState(store, { presets: await service.getPersonalPresets(), saving: false }); return true; } catch (error) { return fail(error); } },
      async deletePreset(id: string): Promise<boolean> { patchState(store, { saving: true }); try { await service.deletePersonalPreset(id); patchState(store, { presets: await service.getPersonalPresets(), saving: false }); messages.add({ severity: 'success', summary: 'Preset eliminato', detail: 'La raccolta personale è aggiornata.' }); return true; } catch (error) { return fail(error); } },
      async create(request: CreateTournamentRequest): Promise<string | null> { patchState(store, { saving: true, error: null }); try { const tournament = await service.create(request); if (request.visibility === 'private') await service.setVisibility(tournament.id, 'private'); patchState(store, { selected: tournament, saving: false }); messages.add({ severity: 'success', summary: 'Bozza creata', detail: 'Controlla il riepilogo e pubblica il torneo.' }); return tournament.id; } catch (error) { fail(error); return null; } },
      publish: (id: string) => act(id, () => service.publish(id), 'Torneo pubblicato', 'Le iscrizioni sono aperte.'),
      joinFree: (id: string) => act(id, () => service.joinFree(id), 'Iscrizione registrata', 'Sei nell’elenco dei giocatori liberi.'),
      proposeTeam: (id: string, partnerId: string) => act(id, () => service.proposeTeam(id, partnerId), 'Invito inviato', 'La coppia sarà confermata dopo l’accettazione.'),
      respondInvite: (id: string, teamId: string, accept: boolean) => act(id, () => service.respondInvite(teamId, accept), accept ? 'Coppia confermata' : 'Invito rifiutato', accept ? 'La tua partecipazione è aggiornata.' : 'Non fai più parte della coppia proposta.'),
      pairFreePlayers: (id: string, first: string, second: string) => act(id, () => service.pairFreePlayers(id, first, second), 'Coppia proposta', 'Entrambi i giocatori devono accettare.'),
      inviteTeam: (id: string, first: string, second: string) => act(id, () => service.inviteTeam(id, first, second), 'Inviti inviati', 'La coppia sarà confermata dopo entrambe le accettazioni.'),
      withdraw: (id: string) => act(id, () => service.withdraw(id), 'Ritiro registrato', 'La tua iscrizione è stata rimossa.'),
      closeRegistrations: (id: string) => act(id, () => service.closeRegistrations(id), 'Iscrizioni chiuse', 'Continua a rifinire struttura e calendario nel Tournament studio.'),
      advanceGroups: (id: string) => act(id, () => service.advanceGroups(id), 'Tabellone generato', 'Le migliori coppie dei gironi sono nella fase finale.'),
      submitResult: (id: string, gameId: string, first: readonly number[], second: readonly number[]) => act(id, () => service.submitResult(gameId, first, second), 'Risultato salvato', 'Classifica e tabellone sono aggiornati.'),
      confirmResult: (id: string, gameId: string) => act(id, () => service.confirmResult(gameId), 'Risultato confermato', 'La conferma della tua coppia è registrata.'),
      rescheduleGame: (id: string, gameId: string, scheduledAt: string, courtId: string) => act(id, () => service.rescheduleGame(gameId, scheduledAt, courtId), 'Calendario aggiornato', 'Orario e campo dell’incontro sono stati salvati.'),
      cancel: (id: string) => act(id, () => service.cancel(id), 'Torneo annullato', 'Lo stato è visibile a tutti gli iscritti.'),
      archive: (id: string) => act(id, () => service.archive(id), 'Torneo archiviato', 'Resta consultabile tramite il suo collegamento diretto.'),
      updateRules: (id: string, rules: TournamentPresetRules) => act(id, () => service.updateRules(id, rules), 'Regole aggiornate', 'Le nuove regole valgono per le prossime partite.'),
      saveGroup: (id: string, groupId: string | null, name: string) => act(id, () => service.saveGroup(id, groupId, name), groupId ? 'Girone rinominato' : 'Girone creato', 'La struttura del torneo è aggiornata.'),
      deleteGroup: (id: string, groupId: string) => act(id, () => service.deleteGroup(id, groupId), 'Girone eliminato', 'Le partite non disputate collegate sono state rimosse.'),
      assignTeamToGroup: (id: string, teamId: string, groupId: string | null) => act(id, () => service.assignTeamToGroup(id, teamId, groupId), 'Assegnazione aggiornata', 'La coppia è stata spostata.'),
      saveGame: (id: string, game: TournamentGameDraft) => act(id, () => service.saveGame(id, game), game.id ? 'Partita aggiornata' : 'Partita aggiunta', 'Il calendario è aggiornato.'),
      deleteGame: (id: string, gameId: string) => act(id, () => service.deleteGame(id, gameId), 'Partita eliminata', 'Il calendario è aggiornato.'),
      generateGroupGames: (id: string, groupId: string) => act(id, () => service.generateGroupGames(id, groupId), 'Partite suggerite', 'Sono stati aggiunti solo gli incontri mancanti.'),
      clear(): void { patchState(store, { selected: null, error: null }); },
    };
  }),
);
