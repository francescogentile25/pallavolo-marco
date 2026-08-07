import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PageAction } from '../../core/models/page-action.model';
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
import { Reveal } from '../../shared/motion/reveal.directive';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, ButtonModule, Dialog, InputText, Select, ToggleSwitch, Tooltip, ProfileHistoryChart, Reveal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="profile-page">
      @if (store.loading() && !store.profile()) {
        <div class="loading-state" role="status"><span class="spinner"></span> Caricamento profilo</div>
      } @else if (store.profile(); as profile) {
        <header class="hero">
          <label class="hero-avatar" [class.is-busy]="uploadingAvatar()">
            <input class="file-input" type="file" accept="image/*" (change)="onAvatarSelected($event)" [disabled]="uploadingAvatar()" />
            <span class="sr-only">Cambia foto profilo</span>
            @if (avatarPreview() && !avatarBroken()) {
              <img [src]="avatarPreview()" [alt]="'Avatar di ' + store.fullName()" (error)="avatarBroken.set(true)" />
            } @else { <span aria-hidden="true">{{ initials() }}</span> }
            <span class="hero-avatar-edit" aria-hidden="true">
              <i class="pi" [class.pi-camera]="!uploadingAvatar()" [class.pi-spinner]="uploadingAvatar()" [class.pi-spin]="uploadingAvatar()"></i>
            </span>
          </label>
          <div class="hero-id">
            <p class="eyebrow">Il tuo profilo</p>
            <h1>{{ profile.nome }} {{ profile.cognome }}</h1>
            <p class="hero-email">{{ profile.email }}</p>
            <span class="role-badge"><i class="pi pi-verified" aria-hidden="true"></i> {{ roleLabels[profile.ruolo] }}</span>
          </div>
          <nav class="quick-links" aria-label="Scorciatoie">
            <a routerLink="/partite/mie"><i class="pi pi-calendar" aria-hidden="true"></i> Le mie partite</a>
            <a routerLink="/campi"><i class="pi pi-map-marker" aria-hidden="true"></i> I miei campi</a>
            <a routerLink="/amici"><i class="pi pi-user-plus" aria-hidden="true"></i> Amici</a>
            @if (canOrganizeTournaments(profile.ruolo)) {
              <a routerLink="/tornei/organizza"><i class="pi pi-trophy" aria-hidden="true"></i> Organizza torneo</a>
            }
          </nav>
        </header>

        <div class="mosaic" appReveal="stagger">
          <article class="tile tile-metric">
            <div class="tile-top">
              <span class="tile-icon"><i class="pi pi-chart-line" aria-hidden="true"></i></span>
              <i class="pi pi-info-circle info" tabindex="0"
                 pTooltip="Il livello corrente è calcolato dalle valutazioni ricevute dagli altri giocatori a fine partita. Non è modificabile direttamente."
                 tooltipPosition="top" aria-label="Cos'è il livello corrente"></i>
            </div>
            <p class="tile-label">Livello corrente</p>
            <strong class="tile-value">{{ profile.livello.toFixed(1) }}</strong>
            <small>{{ levelLabel(profile.livello) }}</small>
          </article>

          <article class="tile tile-metric tile-reliability">
            <div class="tile-top">
              <span class="tile-icon"><i class="pi pi-shield" aria-hidden="true"></i></span>
              <i class="pi pi-info-circle info" tabindex="0"
                 pTooltip="L'affidabilità riflette presenze e puntualità: le assenze segnalate la riducono."
                 tooltipPosition="top" aria-label="Cos'è l'affidabilità"></i>
            </div>
            <p class="tile-label">Affidabilità</p>
            <strong class="tile-value">{{ profile.affidabilita.toFixed(1) }}</strong>
            <small>{{ reliabilityLabel(profile.affidabilita) }}</small>
          </article>

          <article class="tile tile-podium">
            <p class="tile-label">Albo d'oro</p>
            @if (totalPodiums() > 0) {
              <div class="podiums">
                @for (place of podiumPlaces(); track place.label) {
                  <div [class]="'podium place-' + place.position">
                    <i class="pi pi-trophy" aria-hidden="true"></i>
                    <strong>{{ place.count }}</strong>
                    <span>{{ place.label }}</span>
                  </div>
                }
              </div>
            } @else {
              <p class="tile-empty">Nessun podio per ora. I piazzamenti compaiono quando l'organizzatore chiude un torneo che hai vinto o in cui sei arrivato secondo o terzo.</p>
            }
          </article>

          <div class="tile tile-chart"><app-profile-history-chart title="Andamento livello" eyebrow="Valutazioni" [points]="levelPoints()" /></div>
          <div class="tile tile-chart"><app-profile-history-chart title="Andamento affidabilità" eyebrow="Presenze" [points]="reliabilityPoints()" /></div>
        </div>

        <section class="settings" aria-label="Impostazioni del profilo">
          <details class="panel" open>
            <summary><span><i class="pi pi-user-edit" aria-hidden="true"></i> Modifica profilo</span><i class="pi pi-chevron-down chev" aria-hidden="true"></i></summary>
            <div class="panel-body">
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
                </div>
                @if (store.error()) { <p class="form-error" role="alert">{{ store.error() }}</p> }
                <p class="save-hint">{{ formDirty() ? 'Hai modifiche non salvate: usa il pulsante Salva in basso.' : 'Le modifiche si salvano dal pulsante che compare in basso.' }}</p>
              </form>
            </div>
          </details>

          <details class="panel">
            <summary><span><i class="pi pi-bell" aria-hidden="true"></i> Notifiche</span><i class="pi pi-chevron-down chev" aria-hidden="true"></i></summary>
            <div class="panel-body">
              <div class="pref-row">
                <div class="pref-copy"><strong>Notifiche in-app</strong><small>Avvisi su iscrizioni, inviti, risultati e amicizie. Se disattivi, non verranno create.</small></div>
                <p-toggleswitch [ngModel]="profile.in_app_notifications_enabled" (ngModelChange)="store.setNotifications($event)" ariaLabel="Notifiche in-app" />
              </div>
            </div>
          </details>

          <details class="panel">
            <summary><span><i class="pi pi-key" aria-hidden="true"></i> Password</span><i class="pi pi-chevron-down chev" aria-hidden="true"></i></summary>
            <div class="panel-body">
              <div class="grid">
                <div class="field"><label for="pw-new">Nuova password</label><input id="pw-new" pInputText type="password" autocomplete="new-password" [ngModel]="pwNew()" (ngModelChange)="pwNew.set($event)" /></div>
                <div class="field"><label for="pw-conf">Conferma password</label><input id="pw-conf" pInputText type="password" autocomplete="new-password" [ngModel]="pwConfirm()" (ngModelChange)="pwConfirm.set($event)" /></div>
              </div>
              @if (pwError()) { <p class="form-error" role="alert">{{ pwError() }}</p> }
              <p class="save-hint">{{ pwValid() ? 'Password pronta: usa il pulsante Aggiorna password in basso.' : 'Inserisci e conferma la nuova password, poi salvala dal pulsante in basso.' }}</p>
            </div>
          </details>
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
      } @else {
        <div class="error-state" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i><h1>Profilo non disponibile</h1><p>{{ store.error() }}</p><p-button label="Riprova" icon="pi pi-refresh" (onClick)="store.load()" /></div>
      }
    </main>
  `,
  styles: `
    :host { display: block; background: var(--color-canvas); }
    .profile-page { width: min(100%, 1120px); padding: 18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 48px); margin: 0 auto; }

    .hero { display: grid; gap: 16px; padding: 22px; color: white; border-radius: var(--radius-lg); background: var(--color-ocean); }
    .hero-avatar { position: relative; display: grid; width: 84px; height: 84px; place-items: center; overflow: hidden; color: var(--color-ocean); border-radius: 50%; background: var(--color-tournament); font: 900 1.6rem var(--display-font); cursor: pointer; }
    .hero-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .hero-avatar-edit { position: absolute; inset: auto 0 0 0; display: grid; place-items: center; padding: 5px 0 6px; color: white; background: rgb(19 36 48 / .72); font-size: .72rem; }
    .hero-avatar:hover .hero-avatar-edit, .hero-avatar.is-busy .hero-avatar-edit { background: rgb(19 36 48 / .88); }
    .hero-avatar:has(.file-input:focus-visible) { outline: 3px solid var(--color-tournament); outline-offset: 3px; }
    .eyebrow { margin: 0 0 4px; color: var(--color-tournament); font-size: .66rem; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    .hero h1 { margin: 0; font: 800 clamp(1.9rem, 6vw, 2.8rem)/1 var(--display-font); font-stretch: 118%; letter-spacing: -.03em; }
    .hero-email { margin: 6px 0 10px; color: rgb(255 255 255 / .72); font-size: .82rem; }
    .role-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: var(--radius-pill); background: rgb(255 255 255 / .14); font-size: .7rem; font-weight: 800; }
    .quick-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .quick-links a { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; gap: 8px; padding: 0 12px; color: white; border: 1px solid rgb(255 255 255 / .22); border-radius: var(--radius-pill); background: rgb(255 255 255 / .08); font-size: .76rem; font-weight: 750; text-decoration: none; }
    .quick-links a:hover { background: rgb(255 255 255 / .18); }

    .mosaic { display: grid; gap: 12px; margin-top: 14px; }
    .tile { padding: 18px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); }
    .tile-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .tile-icon { display: grid; width: 42px; height: 42px; place-items: center; color: var(--color-brand-strong); border-radius: var(--radius); background: var(--color-brand-soft); }
    .tile-reliability .tile-icon { color: var(--color-success); background: var(--color-success-soft); }
    .info { color: var(--color-ink-muted); cursor: help; }
    .tile-label { margin: 0; color: var(--color-ink-muted); font-size: .68rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .tile-value { display: block; margin: 4px 0 2px; font: 800 2.2rem/1 var(--display-font); font-stretch: 118%; }
    .tile small { color: var(--color-ink-muted); font-size: .7rem; }

    .tile-podium { display: grid; align-content: start; gap: 12px; }
    .podiums { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .podium { display: grid; justify-items: center; gap: 2px; padding: 14px 8px; border: 1px solid var(--color-border); border-radius: var(--radius); text-align: center; }
    .podium i { font-size: 1.05rem; }
    .podium strong { font: 800 1.5rem/1 var(--display-font); }
    .podium span { color: var(--color-ink-muted); font-size: .62rem; font-weight: 700; }
    .podium.place-1 { border-color: var(--color-tournament); background: var(--color-tournament-soft); }
    .podium.place-1 i { color: var(--color-tournament); }
    .podium.place-2 i { color: var(--color-ink-muted); }
    .podium.place-3 { background: var(--color-surface-muted); }
    .podium.place-3 i { color: #a8712a; }
    .tile-empty { margin: 0; color: var(--color-ink-muted); font-size: .78rem; line-height: 1.5; }
    .tile-chart { padding: 0; border: 0; background: transparent; }

    .settings { display: grid; gap: 10px; margin-top: 14px; }
    .panel { overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); }
    .panel summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 60px; padding: 0 18px; font: 800 1rem var(--display-font); font-stretch: 112%; cursor: pointer; list-style: none; }
    .panel summary::-webkit-details-marker { display: none; }
    .panel summary > span { display: inline-flex; align-items: center; gap: 10px; }
    .panel summary > span > i { color: var(--color-brand); }
    .chev { color: var(--color-ink-muted); transition: transform var(--duration-fast) var(--ease-out); }
    .panel[open] .chev { transform: rotate(180deg); }
    .panel summary:focus-visible { outline: 3px solid var(--color-focus); outline-offset: -3px; }
    .panel-body { padding: 4px 18px 20px; border-top: 1px solid var(--color-border); }

    .grid { display: grid; gap: 14px; padding-top: 16px; }
    .field { display: grid; gap: 6px; }
    .field label { font-size: .8rem; font-weight: 800; }
    .field small { color: var(--color-ink-muted); font-size: .7rem; }
    .field .err { color: var(--color-danger); }
    .wide { grid-column: 1 / -1; }
    .lock-note { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; color: var(--color-ink-muted); border-radius: var(--radius); background: var(--color-surface-muted); font-size: .76rem; }
    .link-btn { color: var(--color-brand-strong); border: 0; background: none; font: inherit; font-weight: 800; text-decoration: underline; cursor: pointer; }
    .save-hint { margin: 16px 0 0; color: var(--color-ink-muted); font-size: .76rem; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .file-input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
    .file-input:disabled { cursor: wait; }
    .pref-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 16px; }
    .pref-copy { display: grid; gap: 3px; }
    .pref-copy small { color: var(--color-ink-muted); font-size: .74rem; }
    .form-error { margin: 14px 0 0; padding: 11px 13px; color: var(--color-danger); border-radius: var(--radius); background: var(--color-danger-soft); font-size: .78rem; }
    .save { margin-top: 16px; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

    .loading-state, .error-state { display: grid; min-height: 60dvh; place-content: center; justify-items: center; gap: 12px; color: var(--color-ink-muted); text-align: center; }
    .error-state i { color: var(--color-danger); font-size: 2rem; }
    .spinner { width: 22px; height: 22px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (min-width: 760px) {
      .profile-page { padding: 30px 24px 120px; }
      .hero { grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; padding: 30px; }
      .quick-links { grid-template-columns: repeat(2, minmax(150px, 1fr)); align-self: center; }
      .mosaic { grid-template-columns: repeat(12, minmax(0, 1fr)); }
      .tile-metric { grid-column: span 3; }
      .tile-podium { grid-column: span 6; }
      .tile-chart { grid-column: span 6; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (prefers-reduced-motion: reduce) { .chev { transition: none; } .spinner { animation: none; } }
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
  protected readonly quickLinkCount = (role: Parameters<typeof capabilitiesForRole>[0]): number => this.canOrganizeTournaments(role) ? 4 : 3;
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
  /** Il form reattivo non e un signal: questo tiene traccia di quando ha modifiche da salvare. */
  protected readonly formDirty = signal(false);
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
  protected readonly podiumPlaces = computed(() => {
    const podiums = this.store.podiums();
    return [
      { position: 1, label: 'Primi posti', count: podiums.first_places },
      { position: 2, label: 'Secondi posti', count: podiums.second_places },
      { position: 3, label: 'Terzi posti', count: podiums.third_places },
    ];
  });
  protected readonly totalPodiums = computed(() => this.podiumPlaces().reduce((sum, place) => sum + place.count, 0));
  protected readonly reliabilityPoints = computed(() => this.store.reliabilityHistory().map((item) => ({ id: item.id, value: Number(item.affidabilita), createdAt: item.created_at })));

  constructor() {
    effect(() => {
      const profile = this.store.profile();
      if (!profile || this.profileForm.dirty) return;
      this.profileForm.reset({ nome: profile.nome, cognome: profile.cognome, lato_preferito: profile.lato_preferito, avatar_url: profile.avatar_url ?? '', autovalutazione: profile.autovalutazione });
      this.avatarPreview.set(profile.avatar_url);
      this.avatarBroken.set(false);
      this.formDirty.set(false);
    });

    this.profileForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.formDirty.set(this.profileForm.dirty));

    // La barra in basso mostra solo quello che c'e davvero da salvare.
    effect(() => {
      const actions: PageAction[] = [];
      if (this.formDirty()) {
        actions.push({ id: 'save-profile', label: 'Salva modifiche', shortLabel: 'Salva', icon: 'pi-check', primary: true, click: () => void this.save() });
      }
      if (this.pwValid()) {
        actions.push({ id: 'save-password', label: 'Aggiorna password', shortLabel: 'Password', icon: 'pi-key', click: () => void this.changePassword() });
      }
      this.pageActions.set(actions);
    });
  }

  ngOnInit(): void {
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
    if (saved) { this.profileForm.markAsPristine(); this.formDirty.set(false); }
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
      this.formDirty.set(true);
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
