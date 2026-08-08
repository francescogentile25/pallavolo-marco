import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormField, form, email as emailRule, pattern, maxLength } from '@angular/forms/signals';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Tournament } from '../models/tournament.model';
import { TournamentsStore } from '../store/tournaments.store';

const MAX_BYTES = 2 * 1024 * 1024;

/** Logo della societa organizzante: caricabile e sostituibile dallo Studio in qualsiasi momento. */
@Component({
  selector: 'app-tournament-logo',
  imports: [Button, FormField, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="logo-card">
      <span class="preview">
        @if (tournament().organizer_logo_url) {
          <img [src]="tournament().organizer_logo_url" alt="Logo attuale della societa organizzatrice" />
        } @else {
          <i class="pi pi-image" aria-hidden="true"></i>
        }
      </span>
      <div class="copy">
        <strong>{{ tournament().organizer_logo_url ? 'Logo attivo' : 'Nessun logo caricato' }}</strong>
        <span>Compare nella testata del torneo. PNG, JPG, WebP o SVG fino a 2 MB.</span>
        @if (error()) { <small role="alert">{{ error() }}</small> }
      </div>
      <div class="controls">
        <label class="upload">
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" (change)="pick($event)" [disabled]="busy()" />
          <i class="pi pi-upload" aria-hidden="true"></i>{{ busy() ? 'Caricamento…' : (tournament().organizer_logo_url ? 'Cambia logo' : 'Carica logo') }}
        </label>
        @if (tournament().organizer_logo_url) {
          <p-button label="Rimuovi" severity="secondary" [text]="true" size="small" icon="pi pi-times" [disabled]="busy()" (onClick)="remove()" />
        }
      </div>
    </div>

    <form class="contacts" (submit)="saveContacts($event)" novalidate>
      <p class="contacts-head"><strong>Contatti della società</strong><span>Compaiono nella scheda del torneo: servono a chi vuole informazioni.</span></p>
      <div class="field">
        <label for="organizer-email">Email</label>
        <input id="organizer-email" pInputText fluid type="email" autocomplete="email" placeholder="info@societa.it"
               [formField]="contactsForm.email" [attr.aria-invalid]="showError(contactsForm.email())" />
        @if (showError(contactsForm.email())) {
          @for (error of contactsForm.email().errors(); track $index) { <p class="field-error">{{ error.message }}</p> }
        }
      </div>
      <div class="field">
        <label for="organizer-phone">Telefono</label>
        <input id="organizer-phone" pInputText fluid type="tel" autocomplete="tel" placeholder="+39 333 1234567"
               [formField]="contactsForm.phone" [attr.aria-invalid]="showError(contactsForm.phone())" />
        @if (showError(contactsForm.phone())) {
          @for (error of contactsForm.phone().errors(); track $index) { <p class="field-error">{{ error.message }}</p> }
        }
      </div>
      <p-button type="submit" size="small" label="Salva contatti" icon="pi pi-check" [disabled]="!contactsChanged()" [loading]="store.saving()" />
    </form>
  `,
  styles: `
    :host{display:block}
    .logo-card{display:grid;grid-template-columns:auto 1fr;gap:14px;padding:18px;border:1px solid #d9cdb4;border-radius:var(--radius-lg);background:#faf7f0}
    .preview{display:grid;width:72px;height:72px;place-items:center;overflow:hidden;padding:6px;color:var(--color-ink-muted);border:1px solid #d9cdb4;border-radius:var(--radius);background:#fff}
    .preview img{width:100%;height:100%;object-fit:contain}
    .copy{display:grid;align-content:center;gap:3px}
    .copy strong{font-size:.82rem}
    .copy span{color:var(--color-ink-muted);font-size:.66rem}
    .copy small{color:var(--color-danger);font-size:.66rem;font-weight:750}
    .controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px;grid-column:1/-1}
    .upload{position:relative;display:inline-flex;min-height:44px;align-items:center;gap:8px;padding:0 16px;border:1px solid #d9cdb4;border-radius:var(--radius-pill);background:#fff;font-size:.76rem;font-weight:800;cursor:pointer}
    .upload:focus-within{outline:2px solid var(--color-focus);outline-offset:2px}
    .upload input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
    .contacts{display:grid;gap:12px;margin-top:14px;padding:18px;border:1px solid #d9cdb4;border-radius:var(--radius-lg);background:#faf7f0}
    .contacts-head{display:grid;gap:3px;margin:0}
    .contacts-head strong{font-size:.82rem}
    .contacts-head span{color:var(--color-ink-muted);font-size:.66rem}
    .contacts .field{display:grid;gap:5px}
    .contacts label{color:var(--color-ink-muted);font-size:.68rem;font-weight:800}
    .field-error{margin:0;color:var(--color-danger);font-size:.66rem;font-weight:750}
    .contacts p-button{justify-self:start}
    @media(min-width:760px){.logo-card{grid-template-columns:auto 1fr auto}.controls{grid-column:auto}.contacts{grid-template-columns:repeat(2,minmax(0,1fr))}.contacts-head,.contacts p-button{grid-column:1/-1}}
  `,
})
export class TournamentLogoEditor {
  readonly tournament = input.required<Tournament>();
  protected readonly store = inject(TournamentsStore);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly contacts = signal({ email: '', phone: '' });
  protected readonly contactsForm = form(this.contacts, (path) => {
    emailRule(path.email, { message: 'Inserisci un indirizzo email valido.' });
    maxLength(path.phone, 25, { message: 'Il numero è troppo lungo.' });
    pattern(path.phone, /^[0-9+()./ -]{6,25}$/, { message: 'Usa cifre, spazi e i simboli + ( ) - . /' });
  });

  /** Salvo solo quando c'e davvero qualcosa di diverso da quello che sta nel torneo. */
  protected readonly contactsChanged = computed(() => {
    const draft = this.contacts();
    const item = this.tournament();
    return draft.email.trim() !== (item.organizer_email ?? '')
      || draft.phone.trim() !== (item.organizer_phone ?? '');
  });

  constructor() {
    // I campi seguono il torneo, anche quando arriva aggiornato dal realtime.
    effect(() => {
      const item = this.tournament();
      untracked(() => this.contacts.set({ email: item.organizer_email ?? '', phone: item.organizer_phone ?? '' }));
    });
  }

  protected showError(field: { touched: () => boolean; errors: () => readonly unknown[] }): boolean {
    return field.touched() && field.errors().length > 0;
  }

  protected async saveContacts(event: Event): Promise<void> {
    event.preventDefault();
    this.contactsForm.email().markAsTouched();
    this.contactsForm.phone().markAsTouched();
    if (!this.contactsForm().valid()) return;
    const { email, phone } = this.contacts();
    await this.store.setContacts(this.tournament().id, email.trim() || null, phone.trim() || null);
  }

  /** Il file sale nello storage e l'indirizzo viene salvato solo se l'upload riesce. */
  protected async pick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > MAX_BYTES) {
      this.error.set('Il logo deve essere un’immagine di massimo 2 MB.');
      return;
    }
    this.error.set(null);
    this.busy.set(true);
    const url = await this.store.uploadLogo(file);
    if (url) await this.store.setLogo(this.tournament().id, url);
    this.busy.set(false);
  }

  protected async remove(): Promise<void> {
    this.busy.set(true);
    await this.store.setLogo(this.tournament().id, null);
    this.busy.set(false);
  }
}
