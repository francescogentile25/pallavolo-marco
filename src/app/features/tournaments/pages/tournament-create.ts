import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { PageActionsService } from '../../../core/services/page-actions.service';
import { PlaceSelect } from '../../../shared/places/place-select';
import { PlaceRef } from '../../../shared/places/place.model';
import { MatchGender } from '../../matches/models/match.model';
import { CreateTournamentRequest } from '../models/tournament.model';
import { TournamentsStore } from '../store/tournaments.store';

interface TournamentDraft {
  title: string;
  description: string;
  venueId: string;
  courtIds: string[];
  gender: MatchGender;
  minLevel: number;
  maxLevel: number;
  registrationDeadline: Date;
  startsAt: Date;
  endsAt: Date;
  costEuros: number;
  city: string;
  cityPlace: PlaceRef | null;
  logoUrl: string | null;
  visibility: 'public' | 'private';
}

@Component({
  selector: 'app-tournament-create',
  imports: [Button, CurrencyPipe, DatePicker, FormsModule, InputNumber, InputText, PlaceSelect, Select, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <header class="create-hero">
        <div>
          <p class="eyebrow">Console organizzatore</p>
          <h1>Crea la bozza.<br><span>Costruisci in campo.</span></h1>
          <p class="intro">Inserisci solo ciò che serve per partire. Gironi, tabellone, accoppiamenti e regole si configurano liberamente nello Studio.</p>
        </div>
        <ol aria-label="Avanzamento creazione">
          @for (item of steps; track item.number) {
            <li [class.active]="step() >= item.number" [attr.aria-current]="step() === item.number ? 'step' : null">
              <span>{{ item.number }}</span><small>{{ item.label }}</small>
            </li>
          }
        </ol>
      </header>

      <form (submit)="submit($event)" novalidate>
        @if (step() === 1) {
          <section>
            <div class="heading"><div><p>Passo 1 di 3</p><h2>Il torneo</h2></div><i class="pi pi-flag"></i></div>
            <div class="grid">
              <div class="field wide"><label for="title">Nome del torneo <b>*</b></label><input id="title" pInputText [ngModel]="draft().title" (ngModelChange)="update('title', $event)" name="title" [class.p-invalid]="attempted() && !draft().title.trim()" placeholder="Es. Sunset Cup" /></div>
              <div class="field wide"><label for="description">Descrizione</label><textarea id="description" pTextarea [ngModel]="draft().description" (ngModelChange)="update('description', $event)" name="description" rows="4" placeholder="Atmosfera, informazioni utili e indicazioni per i partecipanti"></textarea></div>
              <div class="field wide"><label>Visibilità</label><div class="segmented" role="group" aria-label="Visibilità torneo"><button type="button" [class.selected]="draft().visibility === 'public'" (click)="update('visibility', 'public')">Pubblico</button><button type="button" [class.selected]="draft().visibility === 'private'" (click)="update('visibility', 'private')">Privato</button></div><small>{{ draft().visibility === 'public' ? 'Visibile a tutti dopo la pubblicazione.' : 'Visibile solo a organizzatore e partecipanti.' }}</small></div>
              <div class="field wide"><label>Logo della società organizzante</label>
                <div class="logo-upload">
                  <span class="logo-preview">@if (draft().logoUrl) { <img [src]="draft().logoUrl" alt="Anteprima del logo caricato" /> } @else { <i class="pi pi-image" aria-hidden="true"></i> }</span>
                  <label class="logo-btn"><input class="file-input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" (change)="pickLogo($event)" [disabled]="uploadingLogo()" /><i class="pi pi-upload" aria-hidden="true"></i>{{ uploadingLogo() ? 'Caricamento…' : (draft().logoUrl ? 'Cambia logo' : 'Carica logo') }}</label>
                  @if (draft().logoUrl) { <button type="button" class="logo-clear" (click)="update('logoUrl', null)">Rimuovi</button> }
                </div>
                <small>Facoltativo. Compare nella testata del torneo. PNG, JPG, WebP o SVG fino a 2 MB.</small>
              </div>
              <div class="field"><label for="gender">Categoria</label><p-select inputId="gender" [ngModel]="draft().gender" (ngModelChange)="update('gender', $event)" name="gender" [options]="genderOptions" optionLabel="label" optionValue="value" fluid /></div>
              <div class="level"><div class="field"><label for="min-level">Livello minimo</label><p-select inputId="min-level" [ngModel]="draft().minLevel" (ngModelChange)="update('minLevel', $event)" name="minLevel" [options]="levels" fluid /></div><span>–</span><div class="field"><label for="max-level">Livello massimo</label><p-select inputId="max-level" [ngModel]="draft().maxLevel" (ngModelChange)="update('maxLevel', $event)" name="maxLevel" [options]="levels" fluid /></div></div>
            </div>
          </section>
        }

        @if (step() === 2) {
          <section>
            <div class="heading"><div><p>Passo 2 di 3</p><h2>Quando e dove</h2></div><i class="pi pi-map-marker"></i></div>
            <div class="grid">
              <div class="field wide"><label for="venue">Struttura <b>*</b></label><p-select inputId="venue" [ngModel]="draft().venueId" (ngModelChange)="selectVenue($event)" name="venue" [options]="venueOptions()" optionLabel="label" optionValue="value" placeholder="Seleziona la struttura" fluid /><small>Tutti i campi attivi della struttura saranno disponibili per il torneo.</small></div>
              <div class="field"><label for="start">Inizio torneo <b>*</b></label><p-datepicker inputId="start" [ngModel]="draft().startsAt" (ngModelChange)="update('startsAt', $event)" name="start" [showTime]="true" hourFormat="24" dateFormat="dd/mm/yy" [minDate]="minimumDate" appendTo="body" fluid /></div>
              <div class="field"><label for="end">Fine prevista <b>*</b></label><p-datepicker inputId="end" [ngModel]="draft().endsAt" (ngModelChange)="update('endsAt', $event)" name="end" [showTime]="true" hourFormat="24" dateFormat="dd/mm/yy" [minDate]="draft().startsAt" appendTo="body" fluid /></div>
              <div class="field"><label for="deadline">Chiusura iscrizioni <b>*</b></label><p-datepicker inputId="deadline" [ngModel]="draft().registrationDeadline" (ngModelChange)="update('registrationDeadline', $event)" name="deadline" [showTime]="true" hourFormat="24" dateFormat="dd/mm/yy" [minDate]="minimumDate" appendTo="body" fluid /></div>
              <div class="field"><label for="city">Comune dell'evento</label><app-place-select inputId="city" [text]="draft().city" (placeChange)="chooseCity($event)" /><small>Lascialo vuoto per usare il comune della struttura.</small></div>
              <div class="field"><label for="cost">Costo iscrizione individuale</label><p-inputnumber inputId="cost" [ngModel]="draft().costEuros" (ngModelChange)="update('costEuros', $event ?? 0)" name="cost" mode="currency" currency="EUR" locale="it-IT" [min]="0" [max]="1000" fluid /></div>
            </div>
          </section>
        }

        @if (step() === 3) {
          <section>
            <div class="heading"><div><p>Passo 3 di 3</p><h2>Apri lo Studio</h2></div><i class="pi pi-sparkles"></i></div>
            <div class="review">
              <article>@if (draft().logoUrl) { <img class="review-logo" [src]="draft().logoUrl" alt="" /> } @else { <i class="pi pi-trophy"></i> }<span>Torneo</span><strong>{{ draft().title }}</strong><small>{{ categoryLabel() }}</small></article>
              <article><i class="pi pi-map-marker"></i><span>Luogo dell'evento</span><strong>{{ venueLabel() }}</strong><small>{{ draft().city || '—' }}</small></article>
              <article><i class="pi pi-calendar"></i><span>Inizio</span><strong>{{ draft().startsAt.toLocaleString('it-IT') }}</strong><small>Iscrizioni fino al {{ draft().registrationDeadline.toLocaleString('it-IT') }}</small></article>
              <article><i class="pi pi-wallet"></i><span>Costo iscrizione individuale</span><strong>{{ draft().costEuros | currency:'EUR':'symbol':'1.2-2':'it' }}</strong><small>Pagamento gestito fuori dall'app</small></article>
            </div>
            <div class="blank-message"><i class="pi pi-wave-pulse"></i><div><strong>Nessuna struttura predefinita</strong><span>La bozza nasce senza gironi e senza partite. Nello Studio aggiungerai coppie, gironi e sfide nell'ordine che preferisci.</span></div></div>
          </section>
        }

        @if (error()) { <p class="form-error" role="alert"><i class="pi pi-exclamation-circle"></i>{{ error() }}</p> }
        <footer><p-button type="button" severity="secondary" [outlined]="true" [label]="step() === 1 ? 'Annulla' : 'Indietro'" icon="pi pi-arrow-left" (onClick)="back()" />@if (step() < 3) { <p-button type="button" label="Continua" icon="pi pi-arrow-right" iconPos="right" (onClick)="next()" /> } @else { <p-button type="submit" label="Crea e apri lo Studio" icon="pi pi-sparkles" [loading]="store.saving()" /> }</footer>
      </form>
    </main>
  `,
  styles: `
    :host{display:block}main{width:min(100%,980px);padding:18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 56px);margin:auto}.create-hero{position:relative;overflow:hidden;padding:28px 22px;color:white;border-radius: var(--radius-sm) var(--radius-lg) 0 0;background:linear-gradient(90deg,rgb(4 39 61/.97),rgb(4 61 91/.72)),url('/assets/images/tournaments-hero.webp') center/cover}.eyebrow,.heading p{margin:0 0 6px;color:#a3b3fb;font-size:.68rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}h1{margin:0;font:900 clamp(2.2rem,10vw,4.5rem)/.88 var(--display-font);letter-spacing:-.06em}h1 span{color:#bae6fd}.intro{max-width:39rem;margin:14px 0 0;color:rgb(255 255 255/.75);font-size:.78rem;line-height:1.55}ol{display:flex;gap:9px;padding:0;margin:24px 0 0;list-style:none}ol li{display:flex;align-items:center;gap:6px}ol span{display:grid;width:32px;height:32px;place-items:center;border:2px solid rgb(255 255 255/.28);border-radius:50%;font-size:.68rem;font-weight:900}ol small{display:none}ol li.active span{color:#14348c;border-color:#a3b3fb;background:#a3b3fb}form{display:grid}section{min-height:450px;padding:24px 18px;border:1px solid var(--color-border);border-top:0;border-radius:0 0 26px 26px;background:white}.heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}.heading p{color:var(--color-brand-strong)}.heading h2{margin:0;font:900 1.7rem/1 var(--display-font);letter-spacing:-.04em}.heading>i{display:grid;width:50px;height:50px;place-items:center;color:var(--color-brand-strong);border-radius:var(--radius-lg);background:var(--color-brand-soft);font-size:1.2rem}.grid{display:grid;gap:16px}.field{display:grid;align-content:start;gap:7px;min-width:0}.field label{font-size:.74rem;font-weight:850}.field b{color:var(--color-danger)}.field input,.field textarea{width:100%}.field small{color:var(--color-ink-muted);font-size:.64rem}.wide{grid-column:1/-1}.level{display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:8px}.level>span{padding-bottom:15px}.segmented{display:inline-flex;width:fit-content;gap:3px;padding:4px;border:1px solid var(--color-border);border-radius:var(--radius);background:var(--color-surface-muted)}.segmented button{padding:8px 18px;color:var(--color-ink-muted);border:0;border-radius:var(--radius);background:transparent;font:inherit;font-size:.72rem;font-weight:850;cursor:pointer}.segmented button.selected{color:#14348c;background:white;box-shadow:0 2px 8px rgb(8 48 73/.1)}.review{display:grid;gap:11px}.review article{display:grid;grid-template-columns:38px 1fr;gap:3px 11px;padding:15px;border:1px solid #dceaf1;border-radius:var(--radius-lg);background:#faf7f0}.review i{display:grid;grid-row:1/4;width:38px;height:38px;place-items:center;color:#1b4fd8;border-radius:var(--radius);background:#e3e8ff}.review span,.review small{color:var(--color-ink-muted);font-size:.64rem}.review strong{font-size:.82rem}.blank-message{display:flex;align-items:flex-start;gap:12px;padding:17px;margin-top:18px;color:#14348c;border-radius:var(--radius-lg);background:#e3e8ff}.blank-message>i{font-size:1.35rem}.blank-message div{display:grid;gap:4px}.blank-message span{font-size:.7rem;line-height:1.5}.logo-upload{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
    .logo-preview{display:grid;flex:0 0 60px;width:60px;height:60px;place-items:center;overflow:hidden;color:var(--color-ink-muted);border:1px solid var(--color-border);border-radius:var(--radius);background:var(--color-surface-muted)}
    .logo-preview img{width:100%;height:100%;object-fit:contain}
    .logo-btn{position:relative;display:inline-flex;min-height:44px;align-items:center;gap:8px;padding:0 16px;border:1px solid var(--color-border);border-radius:var(--radius-pill);font-size:.78rem;font-weight:750;cursor:pointer}
    .logo-btn:focus-within{outline:2px solid var(--color-focus);outline-offset:2px}
    .file-input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
    .logo-clear{min-height:44px;color:var(--color-ink-muted);border:0;background:none;font:inherit;font-size:.76rem;font-weight:750;text-decoration:underline;cursor:pointer}
    .review-logo{grid-row:1/4;width:38px;height:38px;object-fit:contain;border-radius:var(--radius);background:white}
    .form-error{display:flex;align-items:center;gap:8px;padding:12px;margin:12px 0 0;color:var(--color-danger);border-radius:var(--radius);background:var(--color-danger-soft);font-size:.74rem;font-weight:750}footer{display:flex;justify-content:space-between;gap:10px;padding:16px 0}.p-invalid{border-color:var(--color-danger)!important}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--color-focus);outline-offset:2px}
    @media(min-width:700px){main{padding:34px 28px 120px}.create-hero{display:grid;grid-template-columns:1fr auto;align-items:end;padding:40px}.intro{font-size:.82rem}ol{margin:0}ol li{display:grid;justify-items:center}ol small{display:block;color:rgb(255 255 255/.6);font-size:.6rem}section{min-height:500px;padding:36px}.grid,.review{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `,
})
export class TournamentCreate implements OnInit, OnDestroy {
  protected readonly store = inject(TournamentsStore);
  private readonly router = inject(Router);
  private readonly actions = inject(PageActionsService);
  protected readonly step = signal(1);
  protected readonly attempted = signal(false);
  protected readonly uploadingLogo = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly minimumDate = new Date();
  protected readonly steps = [{ number: 1, label: 'Torneo' }, { number: 2, label: 'Quando e dove' }, { number: 3, label: 'Studio' }];
  protected readonly levels = [1, 2, 3, 4, 5, 6, 7];
  protected readonly genderOptions = [{ label: 'Misto', value: 'mixed' }, { label: 'Maschile', value: 'male' }, { label: 'Femminile', value: 'female' }];
  private readonly start = (() => { const value = new Date(); value.setDate(value.getDate() + 14); value.setHours(9, 0, 0, 0); return value; })();
  protected readonly draft = signal<TournamentDraft>({ title: '', description: '', venueId: '', courtIds: [], gender: 'mixed', minLevel: 1, maxLevel: 7, registrationDeadline: new Date(this.start.getTime() - 24 * 60 * 60 * 1000), startsAt: this.start, endsAt: new Date(this.start.getTime() + 8 * 60 * 60 * 1000), costEuros: 0, city: '', cityPlace: null, logoUrl: null, visibility: 'public' });
  protected readonly venueOptions = computed(() => { const seen = new Map<string, string>(); for (const court of this.store.courts()) seen.set(court.venue.id, `${court.venue.name} · ${court.venue.city}`); return [...seen].map(([value, label]) => ({ value, label })); });
  protected readonly courtOptions = computed(() => this.store.courts().filter(court => court.venue_id === this.draft().venueId).map(court => ({ value: court.id, label: court.name })));
  protected readonly venueLabel = computed(() => this.venueOptions().find(option => option.value === this.draft().venueId)?.label ?? 'Struttura da selezionare');
  protected readonly categoryLabel = computed(() => `${this.genderOptions.find(option => option.value === this.draft().gender)?.label ?? 'Misto'} · livello ${this.draft().minLevel}–${this.draft().maxLevel}`);

  ngOnInit(): void { this.actions.set([{ id: 'back-tournaments', label: 'Torna ai tornei', icon: 'pi-arrow-left', routerLink: '/tornei' }]); void this.store.loadOptions(); }
  ngOnDestroy(): void { this.actions.clear(); }
  protected update<K extends keyof TournamentDraft>(key: K, value: TournamentDraft[K]): void { this.draft.update(draft => ({ ...draft, [key]: value })); this.error.set(null); }
  /** Il logo sale subito nello storage: nella bozza resta solo l'indirizzo pubblico. */
  protected async pickLogo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) { this.error.set('Il logo deve essere un\u2019immagine di massimo 2 MB.'); return; }
    this.uploadingLogo.set(true);
    const url = await this.store.uploadLogo(file);
    this.uploadingLogo.set(false);
    if (url) this.update('logoUrl', url);
  }
  /** Il comune scelto porta con se coordinate e identificativo condiviso. */
  protected chooseCity(place: PlaceRef | null): void {
    this.draft.update(draft => ({ ...draft, city: place?.name ?? '', cityPlace: place }));
    this.error.set(null);
  }

  protected selectVenue(id: string): void { this.draft.update(draft => ({ ...draft, venueId: id, courtIds: this.store.courts().filter(court => court.venue_id === id).map(court => court.id) })); this.error.set(null); }
  protected next(): void { this.attempted.set(true); const message = this.validateStep(); if (message) { this.error.set(message); return; } this.error.set(null); this.attempted.set(false); this.step.update(value => Math.min(3, value + 1)); }
  protected back(): void { if (this.step() === 1) { void this.router.navigateByUrl('/tornei'); return; } this.error.set(null); this.step.update(value => value - 1); }
  protected async submit(event: Event): Promise<void> {
    event.preventDefault(); const message = this.validateAll(); if (message) { this.error.set(message); return; }
    const draft = this.draft();
    const request: CreateTournamentRequest = { title: draft.title.trim(), description: draft.description.trim() || null, venueId: draft.venueId, courtIds: draft.courtIds, gender: draft.gender, minLevel: draft.minLevel, maxLevel: draft.maxLevel, registrationDeadline: draft.registrationDeadline.toISOString(), startsAt: draft.startsAt.toISOString(), endsAt: draft.endsAt.toISOString(), costCents: Math.round(draft.costEuros * 100), city: draft.city.trim() || null, cityPlaceId: draft.cityPlace?.placeId ?? null, cityLatitude: draft.cityPlace?.latitude ?? null, cityLongitude: draft.cityPlace?.longitude ?? null, logoUrl: draft.logoUrl, visibility: draft.visibility };
    const id = await this.store.create(request); if (id) await this.router.navigate(['/tornei', id], { queryParams: { view: 'studio' } });
  }
  private validateStep(): string | null { const draft = this.draft(); if (this.step() === 1 && (draft.title.trim().length < 3 || draft.minLevel > draft.maxLevel)) return 'Il nome deve contenere almeno 3 caratteri e la fascia di livello deve essere valida.'; if (this.step() === 2 && !draft.venueId) return 'Seleziona la struttura.'; if (this.step() === 2 && (draft.registrationDeadline >= draft.startsAt || draft.startsAt >= draft.endsAt)) return 'Controlla la sequenza di iscrizioni, inizio e fine torneo.'; return null; }
  private validateAll(): string | null { for (const value of [1, 2]) { this.step.set(value); const error = this.validateStep(); if (error) return error; } this.step.set(3); return null; }
}
