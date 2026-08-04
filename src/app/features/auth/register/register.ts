import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, email, form, minLength, required, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { RegisterRequest } from '../models/auth.model';
import { AuthStore } from '../store/auth.store';

@Component({
  selector: 'app-register',
  imports: [FormField, RouterLink, ButtonModule, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-page">
      <aside class="auth-brand" aria-hidden="true">
        <div class="brand-lockup">
          <span class="brand-mark"><i class="pi pi-users"></i></span>
          <h1>Entra nella community</h1>
          <p>Crea il profilo che userai per partite, tornei e valutazioni.</p>
        </div>
      </aside>

      <main class="auth-panel">
        <a class="mobile-brand" routerLink="/" aria-label="Beach Volley Hub">
          <img src="assets/img/logo.png" alt="Beach Volley Hub" />
        </a>

        <section class="auth-card" aria-labelledby="register-title">
          <img class="auth-logo" src="assets/img/logo.png" alt="Beach Volley Hub" />
          <p class="eyebrow">Primo accesso</p>
          <h2 id="register-title">Registrati</h2>
          <p class="auth-intro">Bastano pochi dati per creare il tuo account.</p>

          @if (registrationComplete()) {
            <p class="auth-success" role="status">
              Controlla la tua email e conferma l’indirizzo, poi torna alla pagina di accesso.
            </p>
          } @else {
            <form class="auth-form" (submit)="onSubmit($event)" novalidate>
              <div class="form-row">
                <div class="field">
                  <label for="register-name">Nome</label>
                  <input id="register-name" pInputText fluid autocomplete="given-name" [formField]="registerForm.nome" />
                  @if (showError(registerForm.nome())) {
                    @for (error of registerForm.nome().errors(); track $index) {
                      <p class="field-error">{{ error.message }}</p>
                    }
                  }
                </div>
                <div class="field">
                  <label for="register-surname">Cognome</label>
                  <input id="register-surname" pInputText fluid autocomplete="family-name" [formField]="registerForm.cognome" />
                  @if (showError(registerForm.cognome())) {
                    @for (error of registerForm.cognome().errors(); track $index) {
                      <p class="field-error">{{ error.message }}</p>
                    }
                  }
                </div>
              </div>

              <div class="field">
                <label for="register-email">Email</label>
                <input id="register-email" pInputText fluid type="email" autocomplete="email" [formField]="registerForm.email" />
                @if (showError(registerForm.email())) {
                  @for (error of registerForm.email().errors(); track $index) {
                    <p class="field-error">{{ error.message }}</p>
                  }
                }
              </div>

              <div class="form-row">
                <div class="field">
                  <label for="register-password">Password</label>
                  <input id="register-password" pInputText fluid type="password" autocomplete="new-password" [formField]="registerForm.password" />
                  @if (showError(registerForm.password())) {
                    @for (error of registerForm.password().errors(); track $index) {
                      <p class="field-error">{{ error.message }}</p>
                    }
                  }
                </div>
                <div class="field">
                  <label for="register-confirm">Conferma password</label>
                  <input id="register-confirm" pInputText fluid type="password" autocomplete="new-password" [formField]="registerForm.confirmPassword" />
                  @if (showError(registerForm.confirmPassword())) {
                    @for (error of registerForm.confirmPassword().errors(); track $index) {
                      <p class="field-error">{{ error.message }}</p>
                    }
                  }
                </div>
              </div>

              <p class="auth-note">
                Dopo la registrazione il profilo resta in attesa di attivazione da parte dell’amministratore.
              </p>

              @if (authStore.error()) {
                <p class="auth-error" role="alert">{{ authStore.error() }}</p>
              }

              <button pButton class="submit-button" type="submit" [disabled]="authStore.loading()">
                @if (authStore.loading()) {
                  <span class="spinner" aria-hidden="true"></span>
                  Creazione account
                } @else {
                  Crea account <i class="pi pi-user-plus" aria-hidden="true"></i>
                }
              </button>
            </form>
          }

          <p class="auth-switch">
            Hai già un account? <a routerLink="/login">Accedi</a>
          </p>
        </section>
      </main>
    </div>
  `,
  styleUrl: '../auth-page.scss',
})
export class Register {
  protected readonly authStore = inject(AuthStore);
  protected readonly registrationComplete = signal(false);

  private readonly model = signal<RegisterRequest>({
    nome: '',
    cognome: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  protected readonly registerForm = form(this.model, (path) => {
    required(path.nome, { message: 'Inserisci il nome.' });
    required(path.cognome, { message: 'Inserisci il cognome.' });
    required(path.email, { message: 'Inserisci l’email.' });
    email(path.email, { message: 'Inserisci un indirizzo email valido.' });
    required(path.password, { message: 'Inserisci la password.' });
    minLength(path.password, 6, { message: 'Usa almeno 6 caratteri.' });
    required(path.confirmPassword, { message: 'Conferma la password.' });
    validate(path.confirmPassword, ({ value, valueOf }) =>
      value() === valueOf(path.password)
        ? null
        : { kind: 'passwordMismatch', message: 'Le password non coincidono.' },
    );
  });

  protected showError(field: { touched(): boolean; valid(): boolean }): boolean {
    return field.touched() && !field.valid();
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.authStore.clearError();
    this.registerForm.nome().markAsTouched();
    this.registerForm.cognome().markAsTouched();
    this.registerForm.email().markAsTouched();
    this.registerForm.password().markAsTouched();
    this.registerForm.confirmPassword().markAsTouched();

    if (!this.registerForm().valid()) {
      return;
    }

    const result = await this.authStore.register(this.model());
    if (result.success) {
      this.registrationComplete.set(true);
    }
  }
}
