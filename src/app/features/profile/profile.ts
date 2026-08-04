import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { PageActionsService } from '../../core/services/page-actions.service';
import { PreferredSide } from '../auth/models/auth.model';
import { capabilitiesForRole, USER_ROLE_LABELS } from '../auth/auth.utils';
import { ProfileHistoryChart } from './components/profile-history-chart';
import { ProfileStore } from './store/profile.store';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, ButtonModule, Dialog, InputText, Select, ToggleSwitch, Tooltip, ProfileHistoryChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="profile-page">
      @if (store.loading() && !store.profile()) {
        <div class="loading-state" role="status"><span class="spinner"></span> Caricamento profilo</div>
      } @else if (store.profile(); as profile) {
        <header class="hero">
          <span class="hero-avatar" aria-hidden="true">
            @if (avatarPreview() && !avatarBroken()) {
              <img [src]="avatarPreview()" [alt]="'Avatar di ' + store.fullName()" (error)="avatarBroken.set(true)" />
            } @else { {{ initials() }} }
          </span>
          <div class="hero-id">
            <p class="eyebrow">Il tuo profilo</p>
            <h1>{{ profile.nome }} {{ profile.cognome }}</h1>
            <p class="hero-email">{{ profile.email }}</p>
            <span class="role-badge"><i class="pi pi-verified" aria-hidden="true"></i> {{ roleLabels[profile.ruolo] }}</span>
          </div>
        </header>

        <nav class="quick-links" aria-label="Scorciatoie">
          <a routerLink="/partite/mie"><i class="pi pi-calendar" aria-hidden="true"></i> Le mie partite</a>
          <a routerLink="/campi"><i class="pi pi-map-marker" aria-hidden="true"></i> I miei campi</a>
          <a routerLink="/amici"><i class="pi pi-user-plus" aria-hidden="true"></i> Amici</a>
          @if (canOrganizeTournaments(profile.ruolo)) {
            <a routerLink="/tornei/organizza"><i class="pi pi-trophy" aria-hidden="true"></i> Organizza torneo</a>
          }
        </nav>

        <section class="metrics" aria-label="Indicatori">
          <article class="metric">
            <div class="metric-head">
              <span class="metric-icon"><i class="pi pi-chart-line" aria-hidden="true"></i></span>
              <i class="pi pi-info-circle info" tabindex="0"
                 pTooltip="Il livello corrente è calcolato dalle valutazioni ricevute dagli altri giocatori a fine partita. Non è modificabile direttamente."
                 tooltipPosition="top" aria-label="Cos'è il livello corrente"></i>
            </div>
            <p>Livello corrente</p>
            <strong>{{ profile.livello.toFixed(1) }}</strong>
            <small>{{ levelLabel(profile.livello) }}</small>
          </article>
          <article class="metric reliability">
            <div class="metric-head">
              <span class="metric-icon"><i class="pi pi-shield" aria-hidden="true"></i></span>
              <i class="pi pi-info-circle info" tabindex="0"
                 pTooltip="L'affidabilità riflette presenze e puntualità: le assenze segnalate (no-show) la riducono. Aiuta gli altri a sapere se sei un compagno affidabile."
                 tooltipPosition="top" aria-label="Cos'è l'affidabilità"></i>
            </div>
            <p>Affidabilità</p>
            <strong>{{ profile.affidabilita.toFixed(1) }}</strong>
            <small>{{ reliabilityLabel(profile.affidabilita) }}</small>
          </article>
        </section>

        <section class="card" aria-labelledby="edit-title">
          <div class="card-head"><div><p class="eyebrow">Dati pubblici</p><h2 id="edit-title">Modifica profilo</h2></div></div>
          <form [formGroup]="profileForm" (ngSubmit)="save()" novalidate>
            <div class="grid">
              <div class="field">
                <label for="profile-name">Nome</label>
                <input id="profile-name" pInputText fluid type="text" formControlName="nome" autocomplete="given-name" maxlength="80" [readonly]="!isAdmin()" [invalid]="showError('nome')" />
                @if (showError('nome')) { <small class="err">Inserisci un nome valido.</small> }
              </div>
              <div class="field">
                <label for="profile-surname">Cognome</label>
                <input id="profile-surname" pInputText fluid type="text" formControlName="cognome" autocomplete="family-name" maxlength="80" [readonly]="!isAdmin()" [invalid]="showError('cognome')" />
                @if (showError('cognome')) { <small class="err">Inserisci un cognome valido.</small> }
              </div>
              @if (!isAdmin()) {
                <div class="lock-note wide">
                  <span><i class="pi pi-lock" aria-hidden="true"></i> Nome e cognome sono gestiti dall'amministratore.</span>
                  <button type="button" class="link-btn" (click)="openNameRequest()">Richiedi modifica</button>
                </div>
              }
              <div class="field">
                <label for="profile-side">Lato preferito</label>
                <p-select inputId="profile-side" formControlName="lato_preferito" [options]="sideOptions" optionLabel="label" optionValue="value" [invalid]="showError('lato_preferito')" fluid />
              </div>
              <div class="field">
                <label for="profile-rating">Autovalutazione</label>
                <p-select inputId="profile-rating" formControlName="autovalutazione" [options]="ratingOptions" optionLabel="label" optionValue="value" [invalid]="showError('autovalutazione')" fluid />
                <small>È distinta dal livello calcolato tramite le valutazioni.</small>
              </div>
              <div class="field wide">
                <label>Foto profilo</label>
                <div class="avatar-upload">
                  <span class="up-preview" aria-hidden="true">
                    @if (avatarPreview() && !avatarBroken()) { <img [src]="avatarPreview()" alt="" (error)="avatarBroken.set(true)" /> } @else { {{ initials() }} }
                  </span>
                  <label class="up-btn">
                    <input type="file" accept="image/*" (change)="onAvatarSelected($event)" hidden [disabled]="uploadingAvatar()" />
                    <i class="pi pi-upload" aria-hidden="true"></i> {{ uploadingAvatar() ? 'Caricamento…' : 'Carica foto' }}
                  </label>
                </div>
                <small>Immagine quadrata consigliata, max 5 MB. Salva per applicare.</small>
              </div>
            </div>
            @if (store.error()) { <p class="form-error" role="alert">{{ store.error() }}</p> }
            <p-button class="save" type="submit" label="Salva modifiche" icon="pi pi-check" [loading]="store.saving()" [disabled]="profileForm.pristine" />
          </form>
        </section>

        <section class="card" aria-labelledby="pref-title">
          <div class="card-head"><div><p class="eyebrow">Preferenze</p><h2 id="pref-title">Notifiche</h2></div></div>
          <div class="pref-row">
            <div class="pref-copy"><strong>Notifiche in-app</strong><small>Avvisi su iscrizioni, inviti, risultati e amicizie. Se disattivi, non verranno create.</small></div>
            <p-toggleswitch [ngModel]="profile.in_app_notifications_enabled" (ngModelChange)="store.setNotifications($event)" ariaLabel="Notifiche in-app" />
          </div>
        </section>

        <section class="card" aria-labelledby="sec-title">
          <div class="card-head"><div><p class="eyebrow">Sicurezza</p><h2 id="sec-title">Password</h2></div></div>
          <div class="grid">
            <div class="field"><label for="pw-new">Nuova password</label><input id="pw-new" pInputText type="password" autocomplete="new-password" [ngModel]="pwNew()" (ngModelChange)="pwNew.set($event)" /></div>
            <div class="field"><label for="pw-conf">Conferma password</label><input id="pw-conf" pInputText type="password" autocomplete="new-password" [ngModel]="pwConfirm()" (ngModelChange)="pwConfirm.set($event)" /></div>
          </div>
          @if (pwError()) { <p class="form-error" role="alert">{{ pwError() }}</p> }
          <p-button class="save" type="button" label="Aggiorna password" icon="pi pi-key" [loading]="pwSaving()" [disabled]="!pwValid()" (onClick)="changePassword()" />
        </section>

        <p-dialog [visible]="nameReqOpen()" (visibleChange)="nameReqOpen.set($event)" [modal]="true" [draggable]="false" header="Richiedi modifica nome" [style]="{ width: '420px', maxWidth: '96vw' }">
          <div class="grid">
            <div class="field"><label for="nr-nome">Nome desiderato</label><input id="nr-nome" pInputText [ngModel]="nameReqForm().nome" (ngModelChange)="setNameReq('nome', $event)" maxlength="80" /></div>
            <div class="field"><label for="nr-cognome">Cognome desiderato</label><input id="nr-cognome" pInputText [ngModel]="nameReqForm().cognome" (ngModelChange)="setNameReq('cognome', $event)" maxlength="80" /></div>
          </div>
          <div class="dialog-actions">
            <p-button severity="secondary" [outlined]="true" label="Annulla" (onClick)="nameReqOpen.set(false)" />
            <p-button label="Invia richiesta" icon="pi pi-send" [loading]="nameReqSaving()" [disabled]="!nameReqValid()" (onClick)="sendNameRequest()" />
          </div>
        </p-dialog>

        <section class="history" aria-label="Storico del profilo">
          <app-profile-history-chart title="Andamento livello" eyebrow="Valutazioni" [points]="levelPoints()" />
          <app-profile-history-chart title="Andamento affidabilità" eyebrow="Presenze" [points]="reliabilityPoints()" />
        </section>
      } @else {
        <div class="error-state" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i><h1>Profilo non disponibile</h1><p>{{ store.error() }}</p><p-button label="Riprova" icon="pi pi-refresh" (onClick)="store.load()" /></div>
      }
    </main>
  `,
  styles: `
    :host { display: block; }
    .profile-page { width: min(100%, 1040px); padding: 18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 48px); margin: 0 auto; display: grid; gap: 14px; }
    .hero { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 18px; padding: 24px 22px; color: white; border-radius: 26px; background: radial-gradient(circle at 88% 0, rgb(25 199 181 / .5), transparent 45%), linear-gradient(145deg, #071d26, #123945); box-shadow: 0 18px 38px rgb(7 29 38 / .18); }
    .hero-avatar { display: grid; width: 84px; height: 84px; place-items: center; overflow: hidden; border: 3px solid rgb(255 255 255 / .7); border-radius: 26px; background: var(--color-tournament); font-size: 1.6rem; font-weight: 900; }
    .hero-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .hero-id { min-width: 0; }
    .eyebrow { margin: 0 0 6px; color: var(--color-brand); font-size: .68rem; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
    .hero .eyebrow { color: #84efe3; }
    .hero h1 { margin: 0 0 6px; font: 900 clamp(1.6rem, 6vw, 2.6rem)/1.02 var(--display-font); letter-spacing: -.03em; overflow-wrap: anywhere; }
    .hero-email { margin: 0 0 10px; color: rgb(255 255 255 / .72); font-size: .82rem; overflow-wrap: anywhere; }
    .role-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 999px; background: rgb(255 255 255 / .14); font-size: .7rem; font-weight: 800; text-transform: capitalize; }
    .quick-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .quick-links a { display: inline-flex; align-items: center; gap: 8px; padding: 12px 14px; color: var(--color-ink); border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); font-size: .8rem; font-weight: 750; text-decoration: none; }
    .quick-links a:hover { border-color: var(--color-brand); color: var(--color-brand-strong); }
    .quick-links i { color: var(--color-brand-strong); }
    .metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .metric { padding: 16px; border: 1px solid var(--color-border); border-radius: 20px; background: var(--color-surface); }
    .metric-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .metric-icon { display: grid; width: 42px; height: 42px; place-items: center; color: var(--color-brand-strong); border-radius: 13px; background: var(--color-brand-soft); }
    .metric.reliability .metric-icon { color: var(--color-success); background: var(--color-success-soft); }
    .info { color: var(--color-ink-muted); cursor: help; font-size: 1rem; }
    .info:hover, .info:focus-visible { color: var(--color-brand-strong); }
    .metric p { margin: 0; color: var(--color-ink-muted); font-size: .68rem; font-weight: 700; }
    .metric strong { display: block; margin: 3px 0; font-size: 1.9rem; line-height: 1; }
    .metric small { color: var(--color-ink-muted); font-size: .68rem; }
    .card { padding: 20px; border: 1px solid var(--color-border); border-radius: 22px; background: var(--color-surface); }
    .card-head { margin-bottom: 18px; }
    .card-head h2 { margin: 0; font: 900 1.4rem/1 var(--display-font); letter-spacing: -.03em; }
    .grid { display: grid; gap: 15px; }
    .field { display: grid; align-content: start; gap: 7px; min-width: 0; }
    .field label { font-size: .76rem; font-weight: 800; }
    .field input, .field p-select { width: 100%; min-height: 48px; }
    .field input[readonly] { color: var(--color-ink-muted); background: var(--color-surface-muted); cursor: not-allowed; }
    .field small { color: var(--color-ink-muted); font-size: .68rem; line-height: 1.4; }
    .err { color: var(--color-danger); }
    .lock-note { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin: 0; padding: 10px 12px; color: var(--color-ink-muted); border-radius: 12px; background: var(--color-surface-muted); font-size: .72rem; }
    .lock-note i { color: var(--color-brand-strong); }
    .link-btn { padding: 0; color: var(--color-brand-strong); border: 0; background: none; font: inherit; font-size: .72rem; font-weight: 800; cursor: pointer; text-decoration: underline; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
    .avatar-upload { display: flex; align-items: center; gap: 14px; }
    .up-preview { display: grid; width: 60px; height: 60px; flex: 0 0 60px; place-items: center; overflow: hidden; border-radius: 18px; color: white; background: var(--color-brand-strong); font-size: 1.1rem; font-weight: 900; }
    .up-preview img { width: 100%; height: 100%; object-fit: cover; }
    .up-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; color: var(--color-brand-strong); border: 1px solid var(--color-brand); border-radius: 12px; background: var(--color-surface); font-size: .8rem; font-weight: 750; cursor: pointer; }
    .up-btn:hover { background: var(--color-brand-soft); }
    .form-error { margin: 16px 0 0; color: var(--color-danger); font-size: .78rem; }
    .save { display: inline-block; margin-top: 18px; }
    .pref-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .pref-copy { display: grid; gap: 3px; min-width: 0; }
    .pref-copy strong { font-size: .86rem; }
    .pref-copy small { color: var(--color-ink-muted); font-size: .72rem; line-height: 1.45; }
    .history { display: grid; gap: 12px; }
    .wide { grid-column: 1 / -1; }
    .spinner { width: 18px; height: 18px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }
    .loading-state, .error-state { display: grid; min-height: 60dvh; place-content: center; justify-items: center; gap: 12px; color: var(--color-ink-muted); text-align: center; }
    .error-state i { color: var(--color-danger); font-size: 2rem; }
    .error-state h1, .error-state p { margin: 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
    @media (min-width: 768px) {
      .profile-page { padding: 34px 28px 120px; gap: 16px; }
      .hero { grid-template-columns: auto 1fr; padding: 32px; }
      .quick-links { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .grid { grid-template-columns: repeat(2, 1fr); }
      .history { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `,
})
export class Profile implements OnInit, OnDestroy {
  protected readonly store = inject(ProfileStore);
  protected readonly roleLabels = USER_ROLE_LABELS;
  protected readonly canOrganizeTournaments = (role: Parameters<typeof capabilitiesForRole>[0]): boolean => capabilitiesForRole(role).organizeTournaments;
  private readonly pageActions = inject(PageActionsService);
  protected readonly avatarPreview = signal<string | null>(null);
  protected readonly avatarBroken = signal(false);
  protected readonly isAdmin = computed(() => this.store.profile()?.ruolo === 'admin');
  protected readonly pwNew = signal('');
  protected readonly pwConfirm = signal('');
  protected readonly pwSaving = signal(false);
  protected readonly pwError = computed(() => {
    const a = this.pwNew();
    const b = this.pwConfirm();
    if (!a && !b) return null;
    if (a.length < 6) return 'La password deve avere almeno 6 caratteri.';
    if (b && a !== b) return 'Le password non coincidono.';
    return null;
  });
  protected readonly nameReqOpen = signal(false);
  protected readonly nameReqForm = signal<{ nome: string; cognome: string }>({ nome: '', cognome: '' });
  protected readonly nameReqSaving = signal(false);
  protected readonly uploadingAvatar = signal(false);
  protected readonly sideOptions: { label: string; value: PreferredSide }[] = [
    { label: 'Indifferente', value: 'indifferente' },
    { label: 'Sinistra', value: 'sinistra' },
    { label: 'Destra', value: 'destra' },
  ];
  protected readonly ratingOptions = [1, 2, 3, 4, 5, 6, 7].map((value) => ({
    value,
    label: `${value} · ${this.selfRatingLabel(value)}`,
  }));
  protected readonly profileForm = new FormGroup({
    nome: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    cognome: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    lato_preferito: new FormControl<PreferredSide>('indifferente', { nonNullable: true, validators: Validators.required }),
    avatar_url: new FormControl('', { nonNullable: true, validators: Validators.pattern(/^$|^https:\/\/.+/i) }),
    autovalutazione: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(7)] }),
  });
  protected readonly initials = computed(() => { const p = this.store.profile(); return p ? `${p.nome.charAt(0)}${p.cognome.charAt(0)}`.toUpperCase() : 'BV'; });
  protected readonly levelPoints = computed(() => this.store.levelHistory().map((item) => ({ id: item.id, value: Number(item.livello_calcolato), createdAt: item.created_at })));
  protected readonly reliabilityPoints = computed(() => this.store.reliabilityHistory().map((item) => ({ id: item.id, value: Number(item.affidabilita), createdAt: item.created_at })));

  constructor() {
    effect(() => {
      const profile = this.store.profile();
      if (!profile || this.profileForm.dirty) return;
      this.profileForm.reset({ nome: profile.nome, cognome: profile.cognome, lato_preferito: profile.lato_preferito, avatar_url: profile.avatar_url ?? '', autovalutazione: profile.autovalutazione });
      this.avatarPreview.set(profile.avatar_url);
      this.avatarBroken.set(false);
    });
  }

  ngOnInit(): void {
    this.pageActions.set([{ id: 'save-profile', label: 'Salva profilo', shortLabel: 'Salva', icon: 'pi-check', primary: true, click: () => void this.save() }]);
    void this.store.load();
  }
  ngOnDestroy(): void { this.pageActions.clear(); }
  protected updateAvatarPreview(): void { this.avatarPreview.set(this.profileForm.controls.avatar_url.value.trim() || null); this.avatarBroken.set(false); }
  protected showError(name: keyof typeof this.profileForm.controls): boolean { const control = this.profileForm.controls[name]; return control.touched && control.invalid; }
  protected async save(): Promise<void> {
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid || this.store.saving()) return;
    const value = this.profileForm.getRawValue();
    const saved = await this.store.save({ ...value, nome: value.nome.trim(), cognome: value.cognome.trim(), avatar_url: value.avatar_url.trim() || null });
    if (saved) this.profileForm.markAsPristine();
  }
  protected levelLabel(value: number): string { if (value <= 2) return 'Principiante'; if (value <= 4) return 'Intermedio'; if (value === 5) return 'Intermedio avanzato'; if (value === 6) return 'Avanzato'; return 'Pro player'; }
  protected selfRatingLabel(value: number): string {
    const labels: Record<number, string> = {
      1: 'Principiante iniziale', 2: 'Principiante', 3: 'Intermedio iniziale', 4: 'Intermedio',
      5: 'Intermedio avanzato', 6: 'Avanzato', 7: 'Pro player',
    };
    return labels[value] ?? 'Non definito';
  }
  protected reliabilityLabel(value: number): string { if (value >= 6) return 'Eccellente'; if (value >= 4.5) return 'Affidabile'; if (value >= 3) return 'Da consolidare'; return 'Attenzione'; }

  protected async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return;
    this.uploadingAvatar.set(true);
    const url = await this.store.uploadAvatar(file);
    this.uploadingAvatar.set(false);
    if (url) {
      this.profileForm.controls.avatar_url.setValue(url);
      this.profileForm.controls.avatar_url.markAsDirty();
      this.profileForm.markAsDirty();
      this.avatarPreview.set(url);
      this.avatarBroken.set(false);
    }
  }

  protected pwValid(): boolean { const a = this.pwNew(); return a.length >= 6 && a === this.pwConfirm(); }
  protected async changePassword(): Promise<void> {
    if (!this.pwValid() || this.pwSaving()) return;
    this.pwSaving.set(true);
    const ok = await this.store.changePassword(this.pwNew());
    this.pwSaving.set(false);
    if (ok) { this.pwNew.set(''); this.pwConfirm.set(''); }
  }
  protected openNameRequest(): void { const p = this.store.profile(); this.nameReqForm.set({ nome: p?.nome ?? '', cognome: p?.cognome ?? '' }); this.nameReqOpen.set(true); }
  protected setNameReq<K extends 'nome' | 'cognome'>(key: K, value: string): void { this.nameReqForm.update((f) => ({ ...f, [key]: value })); }
  protected nameReqValid(): boolean { const f = this.nameReqForm(); return !!f.nome.trim() && !!f.cognome.trim(); }
  protected async sendNameRequest(): Promise<void> {
    if (!this.nameReqValid() || this.nameReqSaving()) return;
    this.nameReqSaving.set(true);
    const f = this.nameReqForm();
    const ok = await this.store.requestNameChange(f.nome.trim(), f.cognome.trim());
    this.nameReqSaving.set(false);
    if (ok) this.nameReqOpen.set(false);
  }
}
