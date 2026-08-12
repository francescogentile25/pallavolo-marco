import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, email, form, minLength, required } from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { LoginRequest } from '../models/auth.model';
import { AuthBackdrop } from '../components/auth-backdrop';
import { AuthStore } from '../store/auth.store';
import { GoogleAuthButton } from '../components/google-auth-button';

@Component({
  selector: 'app-login',
  imports: [AuthBackdrop, FormField, RouterLink, ButtonModule, InputText, GoogleAuthButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-backdrop />
    <div class="auth-page">
      <aside class="auth-brand" aria-hidden="true">
        <div class="brand-lockup">
          <p>Trova la partita giusta, entra in campo e costruisci la tua community.</p>
        </div>
      </aside>

      <main class="auth-panel">
        <a class="mobile-brand" routerLink="/" aria-label="Beach Volley Hub">
          <img src="assets/img/logo-banner.svg" alt="Beach Volley Hub" />
        </a>

        <section class="auth-card" aria-labelledby="login-title">
          <img class="auth-logo" src="assets/img/logo-banner.svg" alt="Beach Volley Hub" />
          <p class="eyebrow">Bentornato in campo</p>
          <h2 id="login-title">Accedi</h2>
          <p class="auth-intro">Usa email e password per continuare.</p>

          @if (registrationPending) {
            <p class="auth-success" role="status">Registrazione completata. Ora attendi l’attivazione da parte dell’amministratore.</p>
          }

          <app-google-auth-button [loading]="authStore.loading()" (pressed)="loginWithGoogle()" />
          <div class="auth-divider"><span>oppure</span></div>

          <form class="auth-form" (submit)="onSubmit($event)" novalidate>
            <div class="field">
              <label for="login-email">Email</label>
              <input
                id="login-email"
                pInputText
                fluid
                type="email"
                autocomplete="email"
                placeholder="nome@email.com"
                [formField]="loginForm.email"
                [attr.aria-invalid]="showError(loginForm.email())"
              />
              @if (showError(loginForm.email())) {
                @for (error of loginForm.email().errors(); track $index) {
                  <p class="field-error">{{ error.message }}</p>
                }
              }
            </div>

            <div class="field">
              <label for="login-password">Password</label>
              <input
                id="login-password"
                pInputText
                fluid
                type="password"
                autocomplete="current-password"
                placeholder="La tua password"
                [formField]="loginForm.password"
                [attr.aria-invalid]="showError(loginForm.password())"
              />
              @if (showError(loginForm.password())) {
                @for (error of loginForm.password().errors(); track $index) {
                  <p class="field-error">{{ error.message }}</p>
                }
              }
            </div>

            @if (authStore.error()) {
              <p class="auth-error" role="alert">{{ authStore.error() }}</p>
            }

            <button pButton class="submit-button" type="submit" [disabled]="authStore.loading()">
              @if (authStore.loading()) {
                <span class="spinner" aria-hidden="true"></span>
                Accesso in corso
              } @else {
                Entra <i class="pi pi-arrow-right" aria-hidden="true"></i>
              }
            </button>
          </form>

          <p class="auth-switch">
            Non hai un account? <a routerLink="/registrazione">Registrati</a>
          </p>
        </section>
      </main>
    </div>
  `,
  styleUrl: '../auth-page.scss',
})
export class Login {
  protected readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  protected readonly registrationPending = this.route.snapshot.queryParamMap.get('registration') === 'pending';

  private readonly model = signal<LoginRequest>({ email: '', password: '' });
  protected readonly loginForm = form(this.model, (path) => {
    required(path.email, { message: 'Inserisci l’email.' });
    email(path.email, { message: 'Inserisci un indirizzo email valido.' });
    required(path.password, { message: 'Inserisci la password.' });
    minLength(path.password, 6, { message: 'La password deve contenere almeno 6 caratteri.' });
  });

  protected showError(field: { touched(): boolean; valid(): boolean }): boolean {
    return field.touched() && !field.valid();
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.authStore.clearError();
    this.loginForm.email().markAsTouched();
    this.loginForm.password().markAsTouched();

    if (!this.loginForm().valid()) {
      return;
    }

    const requestedUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
    await this.authStore.login(this.model(), requestedUrl);
  }

  protected async loginWithGoogle(): Promise<void> {
    const requestedUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
    await this.authStore.loginWithGoogle(requestedUrl);
  }
}
