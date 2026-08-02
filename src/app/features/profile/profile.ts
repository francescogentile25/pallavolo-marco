import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { PageActionsService } from '../../core/services/page-actions.service';
import { PreferredSide } from '../auth/models/auth.model';
import { capabilitiesForRole, USER_ROLE_LABELS } from '../auth/auth.utils';
import { ProfileHistoryChart } from './components/profile-history-chart';
import { ProfileStore } from './store/profile.store';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputText, Select, ProfileHistoryChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="profile-page">
      @if (store.loading() && !store.profile()) {
        <div class="loading-state" role="status"><span class="spinner"></span> Caricamento profilo</div>
      } @else if (store.profile(); as profile) {
        <header class="profile-hero">
          <div class="avatar">
            @if (avatarPreview() && !avatarBroken()) {
              <img [src]="avatarPreview()" [alt]="'Avatar di ' + store.fullName()" (error)="avatarBroken.set(true)" />
            } @else { <span aria-hidden="true">{{ initials() }}</span> }
          </div>
          <div class="identity">
            <p class="eyebrow">Il tuo profilo personale</p>
            <h1>{{ store.fullName() }}</h1>
            <p>{{ profile.email }}</p>
          </div>
          <div class="profile-hero-actions">
            <span class="role-badge"><i class="pi pi-verified" aria-hidden="true"></i> {{ roleLabels[profile.ruolo] }}</span>
            <a pButton class="my-matches-button" routerLink="/partite/mie">
              <i class="pi pi-calendar" pButtonIcon aria-hidden="true"></i>
              <span pButtonLabel>Le mie partite</span>
            </a>
            @if (canOrganizeTournaments(profile.ruolo)) {
              <a pButton class="organize-tournament-button" severity="secondary" routerLink="/tornei/organizza">
                <i class="pi pi-trophy" pButtonIcon aria-hidden="true"></i>
                <span pButtonLabel>Organizza torneo</span>
              </a>
            }
          </div>
        </header>

        <section class="metric-grid" aria-label="Indicatori del profilo">
          <article class="metric-card">
            <span class="metric-icon"><i class="pi pi-chart-line" aria-hidden="true"></i></span>
            <div><p>Livello corrente</p><strong>{{ profile.livello.toFixed(1) }}</strong><small>{{ levelLabel(profile.livello) }}</small></div>
          </article>
          <article class="metric-card reliability-card">
            <span class="metric-icon"><i class="pi pi-shield" aria-hidden="true"></i></span>
            <div><p>Affidabilità</p><strong>{{ profile.affidabilita.toFixed(1) }}</strong><small>{{ reliabilityLabel(profile.affidabilita) }}</small></div>
          </article>
        </section>

        <section class="edit-card" aria-labelledby="edit-profile-title">
          <div class="section-heading">
            <div><p class="eyebrow">Dati pubblici</p><h2 id="edit-profile-title">Modifica profilo</h2></div>
            <span>I campi amministrativi sono protetti</span>
          </div>
          <form [formGroup]="profileForm" (ngSubmit)="save()" novalidate>
            <div class="field-grid">
              <div class="field">
                <label for="profile-name">Nome</label>
                <input id="profile-name" pInputText fluid type="text" formControlName="nome" autocomplete="given-name" maxlength="80" [invalid]="showError('nome')" />
                @if (showError('nome')) { <small class="field-error">Inserisci un nome valido.</small> }
              </div>
              <div class="field">
                <label for="profile-surname">Cognome</label>
                <input id="profile-surname" pInputText fluid type="text" formControlName="cognome" autocomplete="family-name" maxlength="80" [invalid]="showError('cognome')" />
                @if (showError('cognome')) { <small class="field-error">Inserisci un cognome valido.</small> }
              </div>
              <div class="field">
                <label for="profile-side">Lato preferito</label>
                <p-select inputId="profile-side" formControlName="lato_preferito" [options]="sideOptions" optionLabel="label" optionValue="value" [invalid]="showError('lato_preferito')" fluid />
              </div>
              <div class="field">
                <label for="profile-rating">Autovalutazione</label>
                <p-select inputId="profile-rating" formControlName="autovalutazione" [options]="ratingOptions" optionLabel="label" optionValue="value" [invalid]="showError('autovalutazione')" fluid />
                <small id="rating-help">È distinta dal livello calcolato tramite le valutazioni.</small>
              </div>
              <div class="field avatar-field">
                <label for="profile-avatar">URL avatar</label>
                <input id="profile-avatar" pInputText fluid type="url" formControlName="avatar_url" inputmode="url" placeholder="https://esempio.it/avatar.jpg" [invalid]="showError('avatar_url')" (input)="updateAvatarPreview()" />
                <small>Opzionale. Usa un indirizzo HTTPS pubblico.</small>
                @if (showError('avatar_url')) { <small class="field-error">Inserisci un URL HTTPS valido.</small> }
              </div>
            </div>
            @if (store.error()) { <p class="form-error" role="alert">{{ store.error() }}</p> }
            <p-button class="save-button" type="submit" label="Salva modifiche" icon="pi pi-check" [loading]="store.saving()" [disabled]="profileForm.pristine" />
          </form>
        </section>

        <section class="history-grid" aria-label="Storico del profilo">
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
    .profile-page { width: min(100%, 1040px); padding: 18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 48px); margin: 0 auto; }
    .profile-hero { position: relative; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 16px; overflow: hidden; padding: 22px; color: white; border-radius: 28px; background: radial-gradient(circle at 90% 0, rgb(25 199 181 / .5), transparent 42%), linear-gradient(145deg, #071d26, #123945); box-shadow: 0 18px 38px rgb(7 29 38 / .18); }
    .avatar { display: grid; width: 76px; height: 76px; place-items: center; overflow: hidden; border: 3px solid rgb(255 255 255 / .75); border-radius: 24px; background: var(--color-tournament); font-size: 1.45rem; font-weight: 900; }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .identity { min-width: 0; }
    .eyebrow { margin: 0 0 6px; color: var(--color-brand); font-size: .68rem; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
    .profile-hero .eyebrow { color: #84efe3; }
    h1 { overflow: hidden; margin: 0 0 4px; font: 900 clamp(1.7rem, 8vw, 3.6rem)/1 var(--display-font); letter-spacing: -.045em; text-overflow: ellipsis; }
    .identity > p:last-child { overflow: hidden; margin: 0; color: rgb(255 255 255 / .7); font-size: .82rem; text-overflow: ellipsis; }
    .profile-hero-actions { display: flex; grid-column: 1 / -1; flex-wrap: wrap; align-items: center; gap: 8px; justify-self: start; }
    .role-badge { padding: 6px 9px; border-radius: 9px; background: rgb(255 255 255 / .12); font-size: .7rem; font-weight: 800; text-transform: capitalize; }
    .metric-grid, .history-grid { display: grid; gap: 12px; margin-top: 14px; }
    .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .metric-card { display: flex; min-width: 0; align-items: center; gap: 12px; padding: 16px 14px; border: 1px solid var(--color-border); border-radius: 21px; background: var(--color-surface); }
    .metric-icon { display: none; width: 44px; height: 44px; flex: 0 0 44px; place-items: center; border-radius: 14px; background: var(--color-brand-soft); color: var(--color-brand-strong); }
    .metric-card p, .metric-card small { display: block; margin: 0; color: var(--color-ink-muted); font-size: .67rem; }
    .metric-card strong { display: block; margin: 2px 0; font-size: 1.6rem; line-height: 1; }
    .reliability-card .metric-icon { color: var(--color-success); background: var(--color-success-soft); }
    .edit-card { padding: 20px; margin-top: 14px; border: 1px solid var(--color-border); border-radius: 25px; background: var(--color-surface); box-shadow: 0 10px 28px rgb(7 29 38 / .05); }
    .section-heading { display: flex; align-items: start; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
    .section-heading h2 { margin: 0; font: 900 1.55rem/1 var(--display-font); letter-spacing: -.03em; }
    .section-heading > span { max-width: 150px; color: var(--color-ink-muted); font-size: .68rem; text-align: right; }
    .field-grid { display: grid; gap: 16px; }
    .field { display: grid; align-content: start; gap: 7px; }
    .field label { font-size: .78rem; font-weight: 800; }
    .field input, .field p-select { width: 100%; min-height: 48px; }
    .field small { color: var(--color-ink-muted); font-size: .68rem; line-height: 1.4; }
    .field .field-error, .form-error { color: var(--color-danger); }
    .form-error { margin: 16px 0 0; font-size: .78rem; }
    .save-button { display: inline-block; margin-top: 20px; }
    .spinner { width: 18px; height: 18px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }
    .loading-state, .error-state { display: grid; min-height: 60dvh; place-content: center; justify-items: center; gap: 12px; color: var(--color-ink-muted); text-align: center; }
    .error-state i { color: var(--color-danger); font-size: 2rem; }
    .error-state h1, .error-state p { margin: 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (min-width: 520px) { .metric-icon { display: grid; } .field-grid { grid-template-columns: repeat(2, 1fr); } .avatar-field { grid-column: 1 / -1; } }
    @media (min-width: 768px) { .profile-page { padding: 34px 28px 120px; } .profile-hero { grid-template-columns: auto 1fr auto; padding: 30px; } .profile-hero-actions { grid-column: auto; justify-self: end; } .history-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
  `,
})
export class Profile implements OnInit, OnDestroy {
  protected readonly store = inject(ProfileStore);
  protected readonly roleLabels = USER_ROLE_LABELS;
  protected readonly canOrganizeTournaments = (role: Parameters<typeof capabilitiesForRole>[0]): boolean => capabilitiesForRole(role).organizeTournaments;
  private readonly pageActions = inject(PageActionsService);
  protected readonly avatarPreview = signal<string | null>(null);
  protected readonly avatarBroken = signal(false);
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
      1: 'Principiante iniziale',
      2: 'Principiante',
      3: 'Intermedio iniziale',
      4: 'Intermedio',
      5: 'Intermedio avanzato',
      6: 'Avanzato',
      7: 'Pro player',
    };
    return labels[value] ?? 'Non definito';
  }
  protected reliabilityLabel(value: number): string { if (value >= 6) return 'Eccellente'; if (value >= 4.5) return 'Affidabile'; if (value >= 3) return 'Da consolidare'; return 'Attenzione'; }
}
