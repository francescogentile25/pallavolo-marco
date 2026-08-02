import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { MessageService } from 'primeng/api';
import { AuthStore } from '../../auth/store/auth.store';
import { CreateCourtRequest, CreateMatchRequest, MatchesState, UpdateMatchRequest } from '../models/match.model';
import { matchErrorMessage } from '../matches.utils';
import { MatchesService } from '../services/matches.service';

const initialState: MatchesState = {
  matches: [],
  myMatches: [],
  selected: null,
  courts: [],
  invitablePlayers: [],
  loading: false,
  saving: false,
  actionMatchId: null,
  feedbackProfileId: null,
  error: null,
};

export const MatchesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(
    (
      store,
      service = inject(MatchesService),
      authStore = inject(AuthStore),
      messages = inject(MessageService),
    ) => {
      const fail = (error: unknown): string => {
        const message = matchErrorMessage(error);
        patchState(store, { loading: false, saving: false, actionMatchId: null, feedbackProfileId: null, error: message });
        messages.add({ severity: 'error', summary: 'Operazione non riuscita', detail: message });
        return message;
      };

      const refreshSelected = async (matchId: string): Promise<void> => {
        const selected = await service.getMatch(matchId);
        patchState(store, { selected });
      };

      return {
        async loadMatches(silent = false): Promise<void> {
          if (!silent) patchState(store, { loading: true, error: null });
          try {
            const matches = await service.getMatches();
            patchState(store, { matches, loading: false, error: null });
          } catch (error) {
            fail(error);
          }
        },

        async loadMyMatches(silent = false): Promise<void> {
          const userId = authStore.authUser()?.id;
          if (!userId) return;
          if (!silent) patchState(store, { loading: true, error: null });
          try {
            const myMatches = await service.getMyMatches(userId);
            patchState(store, { myMatches, loading: false, error: null });
          } catch (error) {
            fail(error);
          }
        },

        async loadMatch(matchId: string, silent = false): Promise<void> {
          if (!silent) patchState(store, { loading: true, selected: null, error: null });
          try {
            await refreshSelected(matchId);
            patchState(store, { loading: false, error: null });
          } catch (error) {
            fail(error);
          }
        },

        async loadCourts(): Promise<void> {
          try {
            const courts = await service.getCourts();
            patchState(store, { courts, error: null });
          } catch (error) {
            fail(error);
          }
        },

        async loadInvitablePlayers(): Promise<void> {
          try {
            const invitablePlayers = await service.getInvitablePlayers();
            patchState(store, { invitablePlayers, error: null });
          } catch (error) {
            fail(error);
          }
        },

        async createCourt(request: CreateCourtRequest): Promise<string | null> {
          patchState(store, { saving: true, error: null });
          try {
            const court = await service.createCourt(request);
            const courts = await service.getCourts();
            patchState(store, { courts, saving: false });
            messages.add({ severity: 'success', summary: 'Campo aggiunto', detail: `${court.name} è pronto per essere selezionato.` });
            return court.id;
          } catch (error) {
            fail(error);
            return null;
          }
        },

        async createMatch(request: CreateMatchRequest): Promise<string | null> {
          patchState(store, { saving: true, error: null });
          try {
            const match = await service.createMatch(request);
            patchState(store, { saving: false, selected: match });
            const invitedCount = request.invitedPlayerIds.length;
            messages.add({
              severity: 'success',
              summary: 'Partita pubblicata',
              detail: invitedCount
                ? `${invitedCount} ${invitedCount === 1 ? 'giocatore invitato è già partecipante' : 'giocatori invitati sono già partecipanti'}.`
                : 'Gli altri giocatori ora possono iscriversi.',
            });
            return match.id;
          } catch (error) {
            fail(error);
            return null;
          }
        },

        async updateMatch(request: UpdateMatchRequest): Promise<string | null> {
          patchState(store, { saving: true, error: null });
          try {
            const match = await service.updateMatch(request);
            patchState(store, { saving: false, selected: match });
            messages.add({ severity: 'success', summary: 'Partita aggiornata', detail: 'Le modifiche sono state salvate.' });
            return match.id;
          } catch (error) {
            fail(error);
            return null;
          }
        },

        async join(matchId: string): Promise<boolean> {
          patchState(store, { actionMatchId: matchId, error: null });
          try {
            await service.join(matchId);
            await refreshSelected(matchId);
            patchState(store, { actionMatchId: null });
            messages.add({ severity: 'success', summary: 'Sei dei nostri!', detail: 'Iscrizione confermata.' });
            return true;
          } catch (error) {
            fail(error);
            return false;
          }
        },

        async withdraw(matchId: string): Promise<boolean> {
          patchState(store, { actionMatchId: matchId, error: null });
          try {
            await service.withdraw(matchId);
            await refreshSelected(matchId);
            patchState(store, { actionMatchId: null });
            messages.add({ severity: 'info', summary: 'Ritiro registrato', detail: 'Il posto è di nuovo disponibile.' });
            return true;
          } catch (error) {
            fail(error);
            return false;
          }
        },

        async cancel(matchId: string): Promise<boolean> {
          patchState(store, { actionMatchId: matchId, error: null });
          try {
            await service.cancel(matchId);
            await refreshSelected(matchId);
            patchState(store, { actionMatchId: null });
            messages.add({ severity: 'info', summary: 'Partita annullata', detail: 'I partecipanti vedranno subito il nuovo stato.' });
            return true;
          } catch (error) {
            fail(error);
            return false;
          }
        },

        async close(matchId: string): Promise<boolean> {
          patchState(store, { actionMatchId: matchId, error: null });
          try {
            await service.close(matchId);
            await refreshSelected(matchId);
            patchState(store, { actionMatchId: null });
            messages.add({ severity: 'success', summary: 'Partita conclusa', detail: 'Ora i partecipanti possono lasciare le valutazioni.' });
            return true;
          } catch (error) {
            fail(error);
            return false;
          }
        },

        async rate(matchId: string, profileId: string, score: number): Promise<boolean> {
          patchState(store, { feedbackProfileId: profileId, error: null });
          try {
            await service.rate(matchId, profileId, score);
            await refreshSelected(matchId);
            patchState(store, { feedbackProfileId: null });
            messages.add({ severity: 'success', summary: 'Valutazione inviata', detail: 'Il voto è stato registrato.' });
            return true;
          } catch (error) {
            fail(error);
            return false;
          }
        },

        async reportNoShow(matchId: string, profileId: string, reason: string): Promise<boolean> {
          patchState(store, { feedbackProfileId: profileId, error: null });
          try {
            await service.reportNoShow(matchId, profileId, reason);
            await refreshSelected(matchId);
            patchState(store, { feedbackProfileId: null });
            messages.add({ severity: 'info', summary: 'No-show registrato', detail: 'Lo storico di affidabilità è stato aggiornato.' });
            return true;
          } catch (error) {
            fail(error);
            return false;
          }
        },

        clearSelected(): void {
          patchState(store, { selected: null, error: null });
        },
      };
    },
  ),
);
