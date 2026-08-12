import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthBackdrop } from '../components/auth-backdrop';
import { AuthStore } from '../store/auth.store';

@Component({
  selector: 'app-oauth-callback',
  imports: [AuthBackdrop],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-backdrop />
    <main class="callback-page">
      <section class="callback-card" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        <h1>Accesso con Google</h1>
        <p>Stiamo preparando il tuo profilo.</p>
      </section>
    </main>
  `,
  styles: `
    :host{display:block;min-height:100dvh}.callback-page{position:relative;z-index:1;display:grid;min-height:100dvh;padding:24px;place-items:center}.callback-card{width:min(100%,420px);padding:34px;color:white;border:1px solid rgb(255 255 255/.26);border-radius:26px;background:rgb(255 255 255/.12);box-shadow:0 28px 70px rgb(3 16 22/.45);text-align:center;backdrop-filter:blur(20px)}.spinner{display:block;width:34px;height:34px;margin:0 auto 18px;border:3px solid rgb(255 255 255/.3);border-top-color:white;border-radius:50%;animation:spin .8s linear infinite}h1{margin:0;font:900 2rem/1 var(--display-font)}p{margin:10px 0 0;color:rgb(255 255 255/.78)}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.spinner{animation:none}}
  `,
})
export class OauthCallback {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private routed = false;
  private readonly oauthError = this.readOauthError();

  constructor() {
    effect(() => {
      if (!this.authStore.initialized() || this.authStore.loading() || this.routed) return;
      this.routed = true;
      if (this.authStore.needsOnboarding()) {
        void this.router.navigateByUrl('/completa-registrazione');
      } else if (this.authStore.isAuthenticated()) {
        void this.router.navigateByUrl(this.authStore.oauthReturnUrl());
      } else {
        if (this.oauthError) this.authStore.setError(this.oauthError);
        const pending = this.authStore.oauthOutcome() === 'pending';
        void this.router.navigate(['/login'], {
          queryParams: pending ? { registration: 'pending' } : undefined,
        });
      }
    });
  }

  private readOauthError(): string | null {
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const description = query.get('error_description') ?? fragment.get('error_description');
    return description ? `Accesso Google non riuscito: ${description}` : null;
  }
}
