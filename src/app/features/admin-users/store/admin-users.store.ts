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
    }),
  ),
);
