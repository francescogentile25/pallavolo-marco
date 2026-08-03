import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { MessageService } from 'primeng/api';
import { AdminUsersState, AdminUserUpdateRequest } from '../models/admin-user.model';
import { AdminUsersService } from '../services/admin-users.service';

const initialState: AdminUsersState = {
  users: [],
  audit: [],
  loading: false,
  updatingId: null,
  error: null,
};

function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.toLowerCase().includes('non puoi modificare')) return message;
  if (message.toLowerCase().includes('amministratori')) return 'Non hai i permessi necessari.';
  return 'Operazione non riuscita. Riprova.';
}

export const AdminUsersStore = signalStore(
  withState(initialState),
  withMethods(
    (
      store,
      service = inject(AdminUsersService),
      messageService = inject(MessageService),
    ) => ({
      async load(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const [users, audit] = await Promise.all([service.getUsers(), service.getAudit()]);
          patchState(store, { users, audit, loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: readableError(error) });
        }
      },

      async updateAccess(request: AdminUserUpdateRequest): Promise<boolean> {
        if (store.updatingId()) return false;
        patchState(store, { updatingId: request.profileId, error: null });
        try {
          const updated = await service.updateAccess(request);
          const users = store.users().map((user) => (user.id === updated.id ? updated : user));
          const audit = await service.getAudit();
          patchState(store, { users, audit, updatingId: null });
          messageService.add({
            severity: 'success',
            summary: 'Utente aggiornato',
            detail: `${updated.nome} ${updated.cognome}: accesso e ruolo salvati.`,
          });
          return true;
        } catch (error) {
          const message = readableError(error);
          patchState(store, { updatingId: null, error: message });
          messageService.add({ severity: 'error', summary: 'Modifica non riuscita', detail: message });
          return false;
        }
      },

      async createUser(payload: { email: string; nome: string; cognome: string; password: string }): Promise<boolean> {
        patchState(store, { error: null });
        try {
          await service.createUser(payload);
          const users = await service.getUsers();
          patchState(store, { users });
          messageService.add({ severity: 'success', summary: 'Utente creato', detail: `${payload.nome} ${payload.cognome} può accedere.` });
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Creazione non riuscita.';
          patchState(store, { error: message });
          messageService.add({ severity: 'error', summary: 'Creazione non riuscita', detail: message });
          return false;
        }
      },

      async updateName(profileId: string, nome: string, cognome: string): Promise<boolean> {
        if (store.updatingId()) return false;
        patchState(store, { updatingId: profileId, error: null });
        try {
          const updated = await service.updateName(profileId, nome, cognome);
          const users = store.users().map((user) => (user.id === updated.id ? updated : user));
          patchState(store, { users, updatingId: null });
          messageService.add({ severity: 'success', summary: 'Nome aggiornato', detail: `${updated.nome} ${updated.cognome}` });
          return true;
        } catch (error) {
          const message = readableError(error);
          patchState(store, { updatingId: null, error: message });
          messageService.add({ severity: 'error', summary: 'Modifica non riuscita', detail: message });
          return false;
        }
      },
    }),
  ),
);
