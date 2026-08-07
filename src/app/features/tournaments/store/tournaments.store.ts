import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { MessageService } from 'primeng/api';
import { CreateTournamentRequest, TournamentGameDraft, TournamentRules, TournamentState } from '../models/tournament.model';
import { TournamentsService } from '../services/tournaments.service';
import { tournamentErrorMessage } from '../tournaments.utils';

const initialState: TournamentState = { tournaments: [], selected: null, courts: [], players: [], loading: false, saving: false, error: null };

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
      async loadOptions(): Promise<void> { try { const [courts, players] = await Promise.all([service.getCourts(), service.getPlayers()]); patchState(store, { courts, players }); } catch (error) { fail(error); } },
      async create(request: CreateTournamentRequest): Promise<string | null> { patchState(store, { saving: true, error: null }); try { const tournament = await service.create(request); if (request.visibility === 'private') await service.setVisibility(tournament.id, 'private'); patchState(store, { selected: tournament, saving: false }); messages.add({ severity: 'success', summary: 'Bozza creata', detail: 'Controlla il riepilogo e pubblica il torneo.' }); return tournament.id; } catch (error) { fail(error); return null; } },
      publish: (id: string) => act(id, () => service.publish(id), 'Torneo pubblicato', 'Le iscrizioni sono aperte.'),
      joinSingle: (id: string) => act(id, () => service.joinSingle(id), 'Iscrizione registrata', 'Sei iscritto senza compagno: l’organizzatore ti abbinerà.'),
      proposeTeam: (id: string, partnerId: string) => act(id, () => service.proposeTeam(id, partnerId), 'Invito inviato', 'La coppia sarà confermata dopo l’accettazione.'),
      respondInvite: (id: string, teamId: string, accept: boolean) => act(id, () => service.respondInvite(teamId, accept), accept ? 'Coppia confermata' : 'Invito rifiutato', accept ? 'La tua partecipazione è aggiornata.' : 'Non fai più parte della coppia proposta.'),
      inviteTeam: (id: string, first: string, second: string) => act(id, () => service.inviteTeam(id, first, second), 'Inviti inviati', 'La coppia sarà confermata dopo entrambe le accettazioni.'),
      addPlayer: (id: string, playerId: string, groupId: string | null) => act(id, () => service.addPlayer(id, playerId, groupId), 'Giocatore aggiunto', groupId ? 'Il giocatore è stato assegnato al girone scelto.' : 'Il giocatore è pronto per il tabellone o un girone.'),
      withdraw: (id: string) => act(id, () => service.withdraw(id), 'Ritiro registrato', 'La tua iscrizione è stata rimossa.'),
      closeRegistrations: (id: string) => act(id, () => service.closeRegistrations(id), 'Iscrizioni chiuse', 'Continua a rifinire struttura e calendario nel Tournament studio.'),
      advanceGroups: (id: string) => act(id, () => service.advanceGroups(id), 'Tabellone generato', 'Le migliori coppie dei gironi sono nella fase finale.'),
      submitResult: (id: string, gameId: string, first: readonly number[], second: readonly number[]) => act(id, () => service.submitResult(gameId, first, second), 'Risultato salvato', 'Classifica e tabellone sono aggiornati.'),
      proposeResult: (id: string, gameId: string, first: readonly number[], second: readonly number[]) => act(id, () => service.proposeResult(gameId, first, second), 'Risultato proposto', 'L’organizzatore lo riceverà e dovrà validarlo.'),
      reviewResult: (id: string, gameId: string, accept: boolean) => act(id, () => service.reviewResult(gameId, accept), accept ? 'Risultato validato' : 'Proposta rifiutata', accept ? 'Il punteggio è ora effettivo.' : 'Chi lo ha proposto è stato avvisato.'),
      confirmResult: (id: string, gameId: string) => act(id, () => service.confirmResult(gameId), 'Risultato confermato', 'La conferma della tua coppia è registrata.'),
      rescheduleGame: (id: string, gameId: string, scheduledAt: string, courtId: string) => act(id, () => service.rescheduleGame(gameId, scheduledAt, courtId), 'Calendario aggiornato', 'Orario e campo dell’incontro sono stati salvati.'),
      cancel: (id: string) => act(id, () => service.cancel(id), 'Torneo annullato', 'Lo stato è visibile a tutti gli iscritti.'),
      archive: (id: string) => act(id, () => service.archive(id), 'Torneo archiviato', 'Resta consultabile tramite il suo collegamento diretto.'),
      updateRules: (id: string, rules: TournamentRules) => act(id, () => service.updateRules(id, rules), 'Regole aggiornate', 'Le nuove regole valgono per le prossime partite.'),
      saveGroup: (id: string, groupId: string | null, name: string, capacity: number | null = null, plannedMatches: number | null = null) => act(id, () => service.saveGroup(id, groupId, name, capacity, plannedMatches), groupId ? 'Girone aggiornato' : 'Girone creato', 'La struttura del torneo è aggiornata.'),
      pairSingleTeams: (id: string, first: string, second: string) => act(id, () => service.pairSingleTeams(id, first, second), 'Coppia formata', 'I due iscritti singoli ora giocano insieme.'),
      removeTeam: (id: string, teamId: string) => act(id, () => service.removeTeam(id, teamId), 'Iscrizione rimossa', 'La coppia non fa più parte del torneo.'),
      splitTeam: (id: string, teamId: string) => act(id, () => service.splitTeam(id, teamId), 'Coppia smembrata', 'I due giocatori sono ora iscritti singoli, pronti per nuovi compagni.'),
      setGameCourt: (id: string, gameId: string, courtId: string | null) => act(id, () => service.setGameCourt(gameId, courtId), 'Campo aggiornato', courtId ? 'Il campo dell’incontro è stato assegnato.' : 'Il campo dell’incontro è stato rimosso.'),
      closeGroups: (id: string) => act(id, () => service.closeGroups(id), 'Gironi chiusi', 'Ora puoi registrare i risultati del tabellone.'),
      reopenGroups: (id: string) => act(id, () => service.reopenGroups(id), 'Gironi riaperti', 'I risultati del tabellone restano bloccati.'),
      addBracketRound: (id: string, roundNo: number, slots: number, bracketNo = 1) => act(id, () => service.addBracketRound(id, roundNo, slots, bracketNo), 'Turno aggiunto', 'Trascina i giocatori negli slot liberi.'),
      deleteBracket: (id: string, bracketNo: number) => act(id, () => service.deleteBracket(id, bracketNo), 'Tabellone eliminato', 'Le partite di quel tabellone sono state rimosse.'),
      /** Crea il primo turno e vi distribuisce le teste di serie già ordinate. */
      generateBracket: (id: string, slots: number, seeds: readonly string[], bracketNo = 1) => act(id, async () => {
        await service.addBracketRound(id, 1, slots, bracketNo);
        if (!seeds.length) return;
        const refreshed = await service.getTournament(id);
        const openGames = (refreshed.games ?? [])
          .filter(game => game.phase !== 'group' && game.bracket_no === bracketNo && game.round_no === 1 && game.status === 'scheduled' && !game.team1_id && !game.team2_id)
          .sort((a, b) => a.position - b.position);
        for (const [index, game] of openGames.entries()) {
          const team1Id = seeds[index * 2] ?? null;
          const team2Id = seeds[index * 2 + 1] ?? null;
          if (!team1Id && !team2Id) break;
          await service.saveGame(id, { id: game.id, phase: game.phase, groupId: null, bracketNo, roundNo: game.round_no, position: game.position, team1Id, team2Id });
        }
      }, 'Tabellone generato', 'Puoi ancora spostare i giocatori negli slot.'),
      deleteGroup: (id: string, groupId: string, force = false) => act(id, () => service.deleteGroup(id, groupId, force), 'Girone eliminato', 'Il girone e le sue partite sono stati rimossi.'),
      resetGroups: (id: string) => act(id, () => service.resetGroups(id), 'Gironi azzerati', 'Puoi ricostruirli da zero.'),
      setBracketName: (id: string, bracketNo: number, name: string) => act(id, () => service.setBracketName(id, bracketNo, name), 'Nome aggiornato', 'Il tabellone e stato rinominato.'),
      reopenTournament: (id: string) => act(id, () => service.reopenTournament(id), 'Torneo riaperto', 'Puoi di nuovo modificare partite e tabelloni.'),
      assignTeamToGroup: (id: string, teamId: string, groupId: string | null) => act(id, () => service.assignTeamToGroup(id, teamId, groupId), 'Assegnazione aggiornata', 'La coppia è stata spostata.'),
      saveGame: (id: string, game: TournamentGameDraft) => act(id, () => service.saveGame(id, game), game.id ? 'Partita aggiornata' : 'Partita aggiunta', 'Il calendario è aggiornato.'),
      deleteGame: (id: string, gameId: string, force = false) => act(id, () => service.deleteGame(id, gameId, force), 'Partita eliminata', 'Il calendario è aggiornato.'),
      setPodium: (id: string, first: string | null, second: string | null, third: string | null) => act(id, () => service.setPodium(id, first, second, third), 'Podio aggiornato', 'Le posizioni finali sono state salvate.'),
      finishTournament: (id: string) => act(id, () => service.finishTournament(id), 'Torneo concluso', 'Il podio è registrato nelle statistiche dei giocatori.'),
      generateGroupGames: (id: string, groupId: string) => act(id, () => service.generateGroupGames(id, groupId), 'Partite suggerite', 'Sono stati aggiunti solo gli incontri mancanti.'),
      clear(): void { patchState(store, { selected: null, error: null }); },
    };
  }),
);
