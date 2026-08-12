import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { PlaceRef } from '../../../shared/places/place.model';
import { PlaceSelect } from '../../../shared/places/place-select';
import { AuthBackdrop } from '../components/auth-backdrop';
import { CompleteRegistrationRequest } from '../models/auth.model';
import { AuthStore } from '../store/auth.store';

@Component({
  selector: 'app-complete-registration',
  imports: [AuthBackdrop, FormField, ButtonModule, InputText, PlaceSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-backdrop />
    <div class="auth-page">
      <aside class="auth-brand" aria-hidden="true">
        <div class="brand-lockup"><p>Un ultimo passo prima di entrare nella community.</p></div>
      </aside>
      <main class="auth-panel">
        <section class="auth-card" aria-labelledby="complete-title">
          <img class="auth-logo" src="assets/img/logo-banner.svg" alt="Beach Volley Hub" />
          <p class="eyebrow">Profilo Google</p>
          <h2 id="complete-title">Completa la registrazione</h2>
          <p class="auth-intro">Conferma il tuo nome e scegli la città usata per meteo, partite e tornei vicini.</p>

          <form class="auth-form" (submit)="onSubmit($event)" novalidate>
            <div class="form-row">
              <div class="field">
                <label for="complete-name">Nome</label>
                <input id="complete-name" pInputText fluid autocomplete="given-name" [formField]="completeForm.nome" />
                @if (showError(completeForm.nome())) { <p class="field-error">Inserisci il nome.</p> }
              </div>
              <div class="field">
                <label for="complete-surname">Cognome</label>
                <input id="complete-surname" pInputText fluid autocomplete="family-name" [formField]="completeForm.cognome" />
                @if (showError(completeForm.cognome())) { <p class="field-error">Inserisci il cognome.</p> }
              </div>
            </div>

            <div class="field">
              <label for="complete-city">Città</label>
              <app-place-select inputId="complete-city" placeholder="Cerca il tuo comune" [showClear]="false"
                [invalid]="showError(completeForm.city())" (placeChange)="chooseCity($event)" />
              @if (showError(completeForm.city())) { <p class="field-error">Scegli la città dall’elenco.</p> }
            </div>

            <p class="auth-note">Dopo questo passaggio il profilo resterà in attesa dell’attivazione da parte dell’amministratore.</p>
            @if (authStore.error()) { <p class="auth-error" role="alert">{{ authStore.error() }}</p> }
            <button pButton class="submit-button" type="submit" [disabled]="authStore.loading()">
              @if (authStore.loading()) { <span class="spinner" aria-hidden="true"></span> Salvataggio }
              @else { Completa registrazione <i class="pi pi-check" aria-hidden="true"></i> }
            </button>
          </form>
        </section>
      </main>
    </div>
  `,
  styleUrl: '../auth-page.scss',
})
export class CompleteRegistration {
  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly googleData = this.authStore.authUser()?.user_metadata ?? {};
  protected readonly model = signal<CompleteRegistrationRequest>({
    nome: String(this.googleData['given_name'] ?? this.authStore.profile()?.nome ?? ''),
    cognome: String(this.googleData['family_name'] ?? this.authStore.profile()?.cognome ?? ''),
    city: '', cityLatitude: null, cityLongitude: null, cityPlaceId: null,
  });
  protected readonly completeForm = form(this.model, path => {
    required(path.nome, { message: 'Inserisci il nome.' });
    required(path.cognome, { message: 'Inserisci il cognome.' });
    required(path.city, { message: 'Scegli la città dall’elenco.' });
  });

  protected showError(field: { touched(): boolean; valid(): boolean }): boolean {
    return field.touched() && !field.valid();
  }

  protected chooseCity(place: PlaceRef | null): void {
    this.model.update(current => ({
      ...current,
      city: place?.name ?? '',
      cityLatitude: place?.latitude ?? null,
      cityLongitude: place?.longitude ?? null,
      cityPlaceId: place?.placeId ?? null,
    }));
    this.completeForm.city().markAsTouched();
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.authStore.clearError();
    this.completeForm.nome().markAsTouched();
    this.completeForm.cognome().markAsTouched();
    this.completeForm.city().markAsTouched();
    if (!this.completeForm().valid()) return;
    if (await this.authStore.completeRegistration(this.model())) {
      await this.router.navigate(['/login'], { queryParams: { registration: 'pending' } });
    }
  }
}
