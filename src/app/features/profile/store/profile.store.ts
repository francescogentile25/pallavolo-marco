import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { MessageService } from 'primeng/api';
import { AuthStore } from '../../auth/store/auth.store';
import { ProfileState, UpdatePlayerProfileRequest } from '../models/profile.model';
import { ProfileService } from '../services/profile.service';

const initialState: ProfileState = {
  profile: null,
  levelHistory: [],
  reliabilityHistory: [],
  loading: false,
  saving: false,
  error: null,
};

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.toLowerCase().includes('dati profilo non validi')) {
    return 'Controlla i dati inseriti e riprova.';
  }
  return 'Non è stato possibile aggiornare il profilo. Riprova.';
}

export const ProfileStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ profile }) => ({
    fullName: computed(() => {
      const value = profile();
      return value ? `${value.nome} ${value.cognome}` : '';
    }),
  })),
  withMethods(
    (
      store,
      profileService = inject(ProfileService),
      authStore = inject(AuthStore),
      messageService = inject(MessageService),
    ) => ({
      async load(): Promise<void> {
        const userId = authStore.authUser()?.id;
        if (!userId) {
          patchState(store, { error: 'Sessione non disponibile.' });
          return;
        }

        patchState(store, { loading: true, error: null });
        try {
          const [profile, levelHistory, reliabilityHistory] = await Promise.all([
            profileService.getProfile(userId),
            profileService.getLevelHistory(userId),
            profileService.getReliabilityHistory(userId),
          ]);
          patchState(store, {
            profile,
            levelHistory,
            reliabilityHistory,
            loading: false,
          });
        } catch (error) {
          patchState(store, { loading: false, error: errorMessage(error) });
        }
      },

      async setNotifications(enabled: boolean): Promise<void> {
        const current = store.profile();
        if (!current) return;
        try {
          await profileService.setNotifications(enabled);
          const profile = { ...current, in_app_notifications_enabled: enabled };
          patchState(store, { profile });
          authStore.updateProfileSnapshot(profile);
        } catch {
          messageService.add({ severity: 'error', summary: 'Preferenza non salvata', detail: 'Riprova.' });
        }
      },

      async requestNameChange(nome: string, cognome: string): Promise<boolean> {
        try {
          await profileService.requestNameChange(nome, cognome);
          messageService.add({ severity: 'success', summary: 'Richiesta inviata', detail: 'L’amministratore riceverà la tua richiesta.' });
          return true;
        } catch {
          messageService.add({ severity: 'error', summary: 'Invio non riuscito', detail: 'Riprova.' });
          return false;
        }
      },

      async changePassword(password: string): Promise<boolean> {
        try {
          await profileService.changePassword(password);
          messageService.add({ severity: 'success', summary: 'Password aggiornata', detail: 'Usa la nuova password al prossimo accesso.' });
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Aggiornamento non riuscito.';
          messageService.add({ severity: 'error', summary: 'Password non aggiornata', detail: message });
          return false;
        }
      },

      async save(request: UpdatePlayerProfileRequest): Promise<boolean> {
        if (store.saving()) return false;
        patchState(store, { saving: true, error: null });
        try {
          const previousRating = store.profile()?.autovalutazione;
          const profile = await profileService.updateMyProfile(request);
          const levelHistory =
            previousRating === profile.autovalutazione
              ? store.levelHistory()
              : await profileService.getLevelHistory(profile.id);

          patchState(store, { profile, levelHistory, saving: false });
          authStore.updateProfileSnapshot(profile);
          messageService.add({
            severity: 'success',
            summary: 'Profilo aggiornato',
            detail: 'Le modifiche sono state salvate.',
          });
          return true;
        } catch (error) {
          const message = errorMessage(error);
          patchState(store, { saving: false, error: message });
          messageService.add({ severity: 'error', summary: 'Salvataggio non riuscito', detail: message });
          return false;
        }
      },
    }),
  ),
);
