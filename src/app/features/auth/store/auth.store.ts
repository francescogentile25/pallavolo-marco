import { computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { signalStore, withComputed, withHooks, withMethods, withState, patchState } from '@ngrx/signals';
import { Subscription, User } from '@supabase/supabase-js';
import { MessageService } from 'primeng/api';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthState, CompleteRegistrationRequest, LoginRequest, RegisterRequest, UserProfile } from '../models/auth.model';
import { capabilitiesForRole, USER_ROLE_LABELS } from '../auth.utils';
import { AuthService } from '../services/auth.service';

const initialState: AuthState = {
  authUser: null,
  profile: null,
  isAuthenticated: false,
  loading: true,
  initialized: false,
  needsOnboarding: false,
  error: null,
};

const OAUTH_RETURN_URL_KEY = 'bvh:oauth-return-url';
const OAUTH_OUTCOME_KEY = 'bvh:oauth-outcome';

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
  withComputed(({ profile }) => {
    const capabilities = computed(() => capabilitiesForRole(profile()?.ruolo));
    return {
    userName: computed(() => {
      const currentProfile = profile();
      return currentProfile ? currentProfile.nome + ' ' + currentProfile.cognome : 'Utente';
    }),
    isAdmin: computed(() => profile()?.ruolo === 'admin'),
    isOrganizer: computed(() => profile()?.ruolo === 'organizzatore'),
    canOrganizeTournaments: computed(() => capabilities().organizeTournaments),
    canAdministerApplication: computed(() => capabilities().administerApplication),
    roleLabel: computed(() => profile() ? USER_ROLE_LABELS[profile()!.ruolo] : ''),
    capabilities,
  };}),
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
          needsOnboarding: false,
          error: null,
        });
      };

      const loadProfile = async (authUser: User): Promise<UserProfile | null> => {
        patchState(store, { loading: true, error: null });

        try {
          const profile = await authService.getProfile(authUser.id);

          if (!profile.attivo && !profile.registration_completed_at) {
            patchState(store, {
              authUser,
              profile,
              isAuthenticated: false,
              loading: false,
              initialized: true,
              needsOnboarding: true,
              error: null,
            });
            return profile;
          }

          if (!profile.attivo) {
            try { sessionStorage.setItem(OAUTH_OUTCOME_KEY, 'pending'); } catch { /* storage non disponibile */ }
            await authService.logout();
            patchState(store, {
              authUser: null,
              profile: null,
              isAuthenticated: false,
              loading: false,
              initialized: true,
              needsOnboarding: false,
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
            needsOnboarding: false,
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
            needsOnboarding: false,
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

          if (store.needsOnboarding()) {
            await router.navigateByUrl('/completa-registrazione');
            return true;
          }

          await router.navigateByUrl(returnUrl.startsWith('/') ? returnUrl : '/');
          return true;
        },

        async loginWithGoogle(returnUrl = '/'): Promise<boolean> {
          patchState(store, { loading: true, error: null });
          const safeReturnUrl = returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/';
          try {
            sessionStorage.setItem(OAUTH_RETURN_URL_KEY, safeReturnUrl);
          } catch { /* session storage non disponibile */ }

          const { error } = await authService.signInWithGoogle(`${window.location.origin}/auth/callback`);
          if (error) {
            patchState(store, { loading: false, error: readableAuthError(error.message) });
            return false;
          }
          return true;
        },

        oauthReturnUrl(): string {
          try {
            const value = sessionStorage.getItem(OAUTH_RETURN_URL_KEY) ?? '/';
            sessionStorage.removeItem(OAUTH_RETURN_URL_KEY);
            return value.startsWith('/') && !value.startsWith('//') ? value : '/';
          } catch {
            return '/';
          }
        },

        oauthOutcome(): string | null {
          try {
            const value = sessionStorage.getItem(OAUTH_OUTCOME_KEY);
            sessionStorage.removeItem(OAUTH_OUTCOME_KEY);
            return value;
          } catch {
            return null;
          }
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

        async completeRegistration(request: CompleteRegistrationRequest): Promise<boolean> {
          patchState(store, { loading: true, error: null });
          try {
            await authService.completeRegistration(request);
            await authService.logout();
            clearSession();
            return true;
          } catch (error) {
            patchState(store, {
              loading: false,
              error: readableAuthError(error instanceof Error ? error.message : 'Completamento non riuscito.'),
            });
            return false;
          }
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

        setError(message: string): void {
          patchState(store, { loading: false, error: message });
        },

        updateProfileSnapshot(profile: UserProfile): void {
          if (profile.id === store.authUser()?.id) {
            patchState(store, { profile });
          }
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
