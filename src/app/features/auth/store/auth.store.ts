import { computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { signalStore, withComputed, withHooks, withMethods, withState, patchState } from '@ngrx/signals';
import { Subscription, User } from '@supabase/supabase-js';
import { MessageService } from 'primeng/api';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthState, LoginRequest, RegisterRequest, UserProfile } from '../models/auth.model';
import { AuthService } from '../services/auth.service';

const initialState: AuthState = {
  authUser: null,
  profile: null,
  isAuthenticated: false,
  loading: true,
  initialized: false,
  error: null,
};

let authSubscription: Subscription | undefined;

function readableAuthError(message: string): string {
  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'Email o password non corretti.';
  }
  if (message.toLowerCase().includes('email not confirmed')) {
    return 'Conferma il tuo indirizzo email prima di accedere.';
  }
  return message;
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ profile }) => ({
    userName: computed(() => {
      const currentProfile = profile();
      return currentProfile ? currentProfile.nome + ' ' + currentProfile.cognome : 'Giocatore';
    }),
    isAdmin: computed(() => profile()?.ruolo === 'admin'),
  })),
  withMethods(
    (
      store,
      authService = inject(AuthService),
      router = inject(Router),
      messageService = inject(MessageService),
    ) => {
      const clearSession = (): void => {
        patchState(store, {
          authUser: null,
          profile: null,
          isAuthenticated: false,
          loading: false,
          initialized: true,
          error: null,
        });
      };

      const loadProfile = async (authUser: User): Promise<UserProfile | null> => {
        patchState(store, { loading: true, error: null });

        try {
          const profile = await authService.getProfile(authUser.id);

          if (!profile.attivo) {
            await authService.logout();
            patchState(store, {
              authUser: null,
              profile: null,
              isAuthenticated: false,
              loading: false,
              initialized: true,
              error: 'Il profilo è in attesa di attivazione.',
            });
            return null;
          }

          patchState(store, {
            authUser,
            profile,
            isAuthenticated: true,
            loading: false,
            initialized: true,
            error: null,
          });
          return profile;
        } catch {
          patchState(store, {
            authUser: null,
            profile: null,
            isAuthenticated: false,
            loading: false,
            initialized: true,
            error: 'Profilo non disponibile. Contatta l’amministratore.',
          });
          return null;
        }
      };

      return {
        async initialize(): Promise<void> {
          const { data, error } = await authService.getSession();
          if (error || !data.session?.user) {
            clearSession();
            return;
          }
          await loadProfile(data.session.user);
        },

        async handleAuthUser(authUser: User | null): Promise<void> {
          if (!authUser) {
            clearSession();
            return;
          }
          if (store.authUser()?.id === authUser.id && store.profile()) {
            patchState(store, { loading: false, initialized: true });
            return;
          }
          await loadProfile(authUser);
        },

        async login(request: LoginRequest, returnUrl = '/'): Promise<boolean> {
          patchState(store, { loading: true, error: null });
          const { data, error } = await authService.login(request);

          if (error || !data.user) {
            patchState(store, {
              loading: false,
              isAuthenticated: false,
              error: readableAuthError(error?.message ?? 'Accesso non riuscito.'),
            });
            return false;
          }

          const profile = await loadProfile(data.user);
          if (!profile) {
            return false;
          }

          await router.navigateByUrl(returnUrl.startsWith('/') ? returnUrl : '/');
          return true;
        },

        async register(
          request: RegisterRequest,
        ): Promise<{ success: boolean; emailConfirmationRequired: boolean }> {
          patchState(store, { loading: true, error: null });
          const { data, error } = await authService.register(request);

          if (error) {
            patchState(store, { loading: false, error: readableAuthError(error.message) });
            return { success: false, emailConfirmationRequired: false };
          }

          if (data.session) {
            await authService.logout();
          }

          patchState(store, { loading: false, error: null });
          return { success: true, emailConfirmationRequired: !data.session };
        },

        async logout(): Promise<void> {
          patchState(store, { loading: true });
          await authService.logout();
          clearSession();
          messageService.add({
            severity: 'success',
            summary: 'Disconnesso',
            detail: 'Hai effettuato il logout.',
          });
          await router.navigateByUrl('/login');
        },

        clearError(): void {
          patchState(store, { error: null });
        },
      };
    },
  ),
  withHooks({
    onInit(store) {
      const supabase = inject(SupabaseService);
      void store.initialize();

      authSubscription = supabase.client.auth.onAuthStateChange((_event, session) => {
        void store.handleAuthUser(session?.user ?? null);
      }).data.subscription;
    },
    onDestroy() {
      authSubscription?.unsubscribe();
      authSubscription = undefined;
    },
  }),
);
