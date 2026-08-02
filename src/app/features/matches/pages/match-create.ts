import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { PageActionsService } from '../../../core/services/page-actions.service';
import { MatchGender } from '../models/match.model';
import { MatchesStore } from '../store/matches.store';

interface MatchFormModel {
  courtId: string; date: string; time: string; duration: string; capacity: string;
  gender: MatchGender; minLevel: string; maxLevel: string; notes: string;
}
interface CourtFormModel { venueName: string; address: string; city: string; courtName: string; indoor: boolean; }

@Component({
  selector: 'app-match-create',
  imports: [Button, Checkbox, FormField, FormsModule, InputText, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="create-page">
      <header>
        <div class="hero-copy">
          <p>Organizza</p>
          <h1>Crea una partita</h1>
          <p class="hero-intro">Tre scelte rapide e il campo è pronto per accogliere i giocatori.</p>
        </div>
        <ol class="progress" aria-label="Avanzamento creazione">
          @for (item of steps; track item.number) {
            <li [class.active]="step() >= item.number" [class.current]="step() === item.number" [attr.aria-current]="step() === item.number ? 'step' : null">
              <span>{{ item.number }}</span>
              <div class="progress-copy"><strong>{{ item.label }}</strong><small>{{ item.hint }}</small></div>
            </li>
          }
        </ol>
      </header>
      <form class="wizard-panel" (submit)="submitMatch($event)" novalidate>
        @if (step() === 1) {
          <section class="form-card">
            <div class="heading"><div><p>Passo 1 di 3</p><h2>Dove giochiamo?</h2></div><i class="pi pi-map-marker"></i></div>
            @if (store.courts().length) {
              <div class="field">
                <label for="court">Campo <span aria-hidden="true">*</span></label>
                <p-select inputId="court" [ngModel]="model().courtId" (ngModelChange)="updateMatchField('courtId', $event)" [ngModelOptions]="standaloneNgModel" [options]="courtOptions()" optionLabel="label" optionValue="value" placeholder="Seleziona un campo" [invalid]="showError(matchForm.courtId())" fluid />
                @if (showError(matchForm.courtId())) { <p class="field-error" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i> Seleziona il campo della partita.</p> }
              </div>
            }
            <p-button type="button" [text]="true" icon="pi pi-plus" [label]="showNewCourt() ? 'Chiudi nuovo campo' : 'Aggiungi un nuovo campo'" (onClick)="showNewCourt.set(!showNewCourt())" />
            @if (showNewCourt() || !store.courts().length) {
              <div class="new-court">
                <div class="field"><label for="venue">Nome struttura <span aria-hidden="true">*</span></label><input id="venue" pInputText [formField]="courtForm.venueName" [class.p-invalid]="showError(courtForm.venueName())" [attr.aria-invalid]="showError(courtForm.venueName())" />@if (showError(courtForm.venueName())) { <p class="field-error" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i> Inserisci il nome della struttura.</p> }</div>
                <div class="field"><label for="court-name">Nome campo <span aria-hidden="true">*</span></label><input id="court-name" pInputText [formField]="courtForm.courtName" [class.p-invalid]="showError(courtForm.courtName())" [attr.aria-invalid]="showError(courtForm.courtName())" />@if (showError(courtForm.courtName())) { <p class="field-error" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i> Inserisci il nome del campo.</p> }</div>
                <div class="field wide"><label for="address">Indirizzo <span aria-hidden="true">*</span></label><input id="address" pInputText [formField]="courtForm.address" autocomplete="street-address" [class.p-invalid]="showError(courtForm.address())" [attr.aria-invalid]="showError(courtForm.address())" />@if (showError(courtForm.address())) { <p class="field-error" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i> Inserisci l'indirizzo.</p> }</div>
                <div class="field"><label for="city">Città <span aria-hidden="true">*</span></label><input id="city" pInputText [formField]="courtForm.city" autocomplete="address-level2" [class.p-invalid]="showError(courtForm.city())" [attr.aria-invalid]="showError(courtForm.city())" />@if (showError(courtForm.city())) { <p class="field-error" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i> Inserisci la città.</p> }</div>
                <div class="check"><p-checkbox inputId="indoor" [ngModel]="courtModel().indoor" (ngModelChange)="updateCourtField('indoor', $event)" [ngModelOptions]="standaloneNgModel" [binary]="true" /><label for="indoor">Campo coperto</label></div>
                <p-button class="wide" type="button" severity="secondary" label="Salva e seleziona campo" icon="pi pi-check" [loading]="store.saving()" (onClick)="createCourt()" />
              </div>
            }
          </section>
        }
        @if (step() === 2) {
          <section class="form-card">
            <div class="heading"><div><p>Passo 2 di 3</p><h2>Quando e per chi?</h2></div><i class="pi pi-calendar"></i></div>
            <div class="grid">
              <div class="field"><label for="date">Data <span aria-hidden="true">*</span></label><input id="date" pInputText type="date" [formField]="matchForm.date" [class.p-invalid]="showError(matchForm.date())" [attr.aria-invalid]="showError(matchForm.date())" />@if (showError(matchForm.date())) { <p class="field-error" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i> Seleziona la data.</p> }</div>
              <div class="field"><label for="time">Ora <span aria-hidden="true">*</span></label><input id="time" pInputText type="time" [formField]="matchForm.time" [class.p-invalid]="showError(matchForm.time())" [attr.aria-invalid]="showError(matchForm.time())" />@if (showError(matchForm.time())) { <p class="field-error" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i> Seleziona l'orario.</p> }</div>
              <div class="field"><label for="duration">Durata</label><p-select inputId="duration" [ngModel]="model().duration" (ngModelChange)="updateMatchField('duration', $event)" [ngModelOptions]="standaloneNgModel" [options]="durationOptions" optionLabel="label" optionValue="value" fluid /></div>
              <div class="field"><label for="capacity">Posti totali</label><p-select inputId="capacity" [ngModel]="model().capacity" (ngModelChange)="updateMatchField('capacity', $event)" [ngModelOptions]="standaloneNgModel" [options]="capacityOptions" optionLabel="label" optionValue="value" fluid /></div>
              <div class="field"><label for="gender">Genere</label><p-select inputId="gender" [ngModel]="model().gender" (ngModelChange)="updateMatchField('gender', $event)" [ngModelOptions]="standaloneNgModel" [options]="genderOptions" optionLabel="label" optionValue="value" fluid /></div>
              <div class="level-fields">
                <div class="field"><label for="min-level">Livello min.</label><p-select inputId="min-level" [ngModel]="model().minLevel" (ngModelChange)="updateMatchField('minLevel', $event)" [ngModelOptions]="standaloneNgModel" [options]="levelOptions" optionLabel="label" optionValue="value" fluid /></div>
                <span>–</span>
                <div class="field"><label for="max-level">Livello max.</label><p-select inputId="max-level" [ngModel]="model().maxLevel" (ngModelChange)="updateMatchField('maxLevel', $event)" [ngModelOptions]="standaloneNgModel" [options]="levelOptions" optionLabel="label" optionValue="value" fluid /></div>
              </div>
            </div>
            @if (stepError()) { <p class="error" role="alert">{{ stepError() }}</p> }
          </section>
        }
        @if (step() === 3) {
          <section class="form-card">
            <div class="heading"><div><p>Passo 3 di 3</p><h2>Controlla e pubblica</h2></div><i class="pi pi-check-circle"></i></div>
            <div class="summary"><div><span>Campo</span><strong>{{ selectedCourtLabel() }}</strong></div><div><span>Data e ora</span><strong>{{ model().date }} · {{ model().time }}</strong></div><div><span>Formula</span><strong>{{ model().capacity }} giocatori · livello {{ model().minLevel }}–{{ model().maxLevel }}</strong></div></div>
            <div class="field"><label for="notes">Note <small>(opzionale)</small></label><textarea id="notes" rows="5" [formField]="matchForm.notes" placeholder="Costo campo, materiale, indicazioni…"></textarea></div>
            <p class="notice"><i class="pi pi-info-circle"></i> Sarai iscritto automaticamente come organizzatore.</p>
            @if (store.error()) { <p class="error" role="alert">{{ store.error() }}</p> }
          </section>
        }
        <footer>
          <p-button type="button" severity="secondary" [outlined]="true" [label]="step() === 1 ? 'Annulla' : 'Indietro'" icon="pi pi-arrow-left" (onClick)="back()" />
          @if (step() < 3) { <p-button type="button" label="Continua" icon="pi pi-arrow-right" iconPos="right" (onClick)="next()" /> }
          @else { <p-button type="submit" label="Pubblica partita" icon="pi pi-send" [loading]="store.saving()" /> }
        </footer>
      </form>
    </main>
  `,
  styles: `
    :host { display: block; }
    .create-page { width: min(100%, 760px); padding: 18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 50px); margin: auto; }
    header { padding: 24px 20px; color: white; border-radius: 27px 27px 0 0; background: linear-gradient(145deg, #071d26, #123945); }
    .hero-copy > p:first-child, .heading p { margin: 0 0 5px; color: #84efe3; font-size: .68rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    h1 { max-width: 12ch; margin: 0; font: 900 clamp(2rem, 10vw, 3.8rem)/.95 var(--display-font); letter-spacing: -.05em; }
    .hero-intro { display: none; }
    .progress { display: flex; gap: 8px; padding: 0; margin: 22px 0 0; list-style: none; }
    .progress li > span { display: grid; width: 30px; height: 30px; place-items: center; border: 2px solid rgb(255 255 255 / .3); border-radius: 50%; font-size: .7rem; font-weight: 900; }
    .progress li.active > span { color: var(--color-ocean); border-color: var(--color-brand); background: var(--color-brand); }
    .progress li.current > span { box-shadow: 0 0 0 4px rgb(132 239 227 / .14); }
    .progress-copy { display: none; }
    .wizard-panel { display: grid; margin: 0; }
    .form-card { min-height: 410px; padding: 22px 18px; border: 1px solid var(--color-border); border-top: 0; border-radius: 0 0 25px 25px; background: white; }
    .heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .heading p { color: var(--color-brand-strong); }
    .heading h2 { margin: 0; font: 900 1.55rem/1 var(--display-font); }
    .heading > i { display: grid; width: 46px; height: 46px; place-items: center; border-radius: 15px; color: var(--color-brand-strong); background: var(--color-brand-soft); font-size: 1.2rem; }
    .field { display: grid; align-content: start; gap: 7px; min-width: 0; }
    .field label { font-size: .76rem; font-weight: 850; }
    .field label span { color: var(--color-danger); }
    .field input, .field textarea { width: 100%; min-height: 48px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: 13px; color: var(--color-ink); background: white; }
    .field textarea { padding: 12px; resize: vertical; }
    :host ::ng-deep .field .p-invalid { border-color: var(--color-danger); box-shadow: 0 0 0 3px rgb(196 57 57 / .11); }
    .field-error { display: flex; align-items: center; gap: 6px; margin: 0; color: var(--color-danger); font-size: .7rem; font-weight: 700; line-height: 1.35; }
    .field-error i { flex: 0 0 auto; font-size: .76rem; }
    .grid, .new-court { display: grid; gap: 15px; }
    .new-court { padding: 16px; margin-top: 12px; border-radius: 18px; background: var(--color-surface-muted); }
    .check { display: flex; min-height: 44px; align-items: center; gap: 9px; font-size: .76rem; font-weight: 800; }
    .check label { cursor: pointer; }
    .level-fields { display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; gap: 8px; }
    .level-fields > span { padding-bottom: 15px; }
    .summary { display: grid; gap: 9px; margin-bottom: 20px; }
    .summary div { display: grid; gap: 3px; padding: 12px; border-radius: 15px; background: var(--color-surface-muted); }
    .summary span { color: var(--color-ink-muted); font-size: .65rem; }
    .summary strong { font-size: .8rem; }
    .notice { display: flex; gap: 8px; padding: 12px; color: var(--color-brand-strong); border-radius: 13px; background: var(--color-brand-soft); font-size: .72rem; }
    .error { padding: 10px 12px; margin: 16px 0 0; color: var(--color-danger); border-left: 3px solid var(--color-danger); border-radius: 0 10px 10px 0; background: rgb(196 57 57 / .07); font-size: .72rem; font-weight: 700; }
    .wide { grid-column: 1 / -1; }
    footer { display: flex; justify-content: space-between; gap: 10px; padding: 16px 0; }
    input:focus-visible, textarea:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 2px; }

    @media (min-width: 620px) {
      .create-page { padding: 34px 28px 120px; }
      .form-card { padding: 28px; }
      .grid, .new-court { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .wide { grid-column: 1 / -1; }
    }

    @media (min-width: 960px) {
      .create-page { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 18px; width: min(100%, 1180px); padding: 42px 28px 130px; align-items: stretch; }
      header { position: relative; display: flex; min-height: 640px; flex-direction: column; overflow: hidden; padding: 44px 34px; border-radius: 30px; }
      header::after { position: absolute; right: -105px; bottom: -115px; width: 260px; height: 260px; border: 1px solid rgb(132 239 227 / .18); border-radius: 50%; content: ''; }
      h1 { font-size: clamp(3rem, 4.2vw, 4.25rem); }
      .hero-intro { display: block; max-width: 25ch; margin: 22px 0 0; color: rgb(255 255 255 / .65); font-size: .82rem; line-height: 1.55; }
      .progress { position: relative; z-index: 1; display: grid; gap: 0; margin-top: auto; }
      .progress li { position: relative; display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 12px; min-height: 72px; align-items: start; }
      .progress li:not(:last-child)::after { position: absolute; top: 34px; bottom: 5px; left: 14px; width: 2px; background: rgb(255 255 255 / .16); content: ''; }
      .progress li.active:not(:last-child)::after { background: rgb(132 239 227 / .55); }
      .progress-copy { display: grid; gap: 3px; padding-top: 2px; }
      .progress-copy strong { color: rgb(255 255 255 / .9); font-size: .78rem; }
      .progress-copy small { color: rgb(255 255 255 / .48); font-size: .68rem; line-height: 1.35; }
      .progress li.current .progress-copy strong { color: #84efe3; }
      .wizard-panel { min-height: 640px; grid-template-rows: 1fr auto; overflow: hidden; border: 1px solid var(--color-border); border-radius: 30px; background: white; box-shadow: 0 18px 45px rgb(7 29 38 / .08); }
      .form-card { min-height: 0; padding: 44px 46px 34px; border: 0; border-radius: 0; }
      .heading { margin-bottom: 34px; }
      .heading h2 { font-size: 2rem; }
      .heading > i { width: 54px; height: 54px; border-radius: 17px; font-size: 1.35rem; }
      .grid, .new-court { gap: 20px 18px; }
      .summary { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .summary div { min-height: 86px; align-content: center; padding: 16px; }
      footer { padding: 20px 46px; border-top: 1px solid var(--color-border); background: var(--color-surface-muted); }
    }
  `,
})
export class MatchCreate implements OnInit, OnDestroy {
  protected readonly store = inject(MatchesStore); private readonly router = inject(Router); private readonly actions = inject(PageActionsService);
  protected readonly step = signal(1); protected readonly showNewCourt = signal(false); protected readonly stepError = signal<string | null>(null); protected readonly levels = [1,2,3,4,5,6,7];
  protected readonly steps = [
    { number: 1, label: 'Il campo', hint: 'Scegli dove giocare' },
    { number: 2, label: 'La partita', hint: 'Data, formula e livello' },
    { number: 3, label: 'Pubblicazione', hint: 'Controlla e conferma' },
  ];
  protected readonly standaloneNgModel = { standalone: true };
  protected readonly durationOptions = [{ label: '60 minuti', value: '60' }, { label: '90 minuti', value: '90' }, { label: '120 minuti', value: '120' }];
  protected readonly capacityOptions = [{ label: '4 giocatori', value: '4' }, { label: '6 giocatori', value: '6' }, { label: '8 giocatori', value: '8' }];
  protected readonly genderOptions: { label: string; value: MatchGender }[] = [{ label: 'Misto', value: 'mixed' }, { label: 'Maschile', value: 'male' }, { label: 'Femminile', value: 'female' }];
  protected readonly levelOptions = this.levels.map((level) => ({ label: String(level), value: String(level) }));
  protected readonly model = signal<MatchFormModel>({ courtId:'', date:'', time:'', duration:'90', capacity:'4', gender:'mixed', minLevel:'1', maxLevel:'7', notes:'' });
  protected readonly matchForm = form(this.model, p => {
    required(p.courtId, { message: 'Seleziona il campo della partita.' });
    required(p.date, { message: 'Seleziona la data.' });
    required(p.time, { message: "Seleziona l'orario." });
    maxLength(p.notes, 1000, { message: 'Le note non possono superare 1000 caratteri.' });
  });
  protected readonly courtModel = signal<CourtFormModel>({ venueName:'', address:'', city:'', courtName:'Campo 1', indoor:false });
  protected readonly courtForm = form(this.courtModel, p => {
    required(p.venueName, { message: 'Inserisci il nome della struttura.' });
    required(p.address, { message: "Inserisci l'indirizzo." });
    required(p.city, { message: 'Inserisci la città.' });
    required(p.courtName, { message: 'Inserisci il nome del campo.' });
  });
  protected readonly courtOptions = computed(() => this.store.courts().map((court) => ({ label: `${court.venue.name} · ${court.name} · ${court.venue.city}`, value: court.id })));
  protected readonly selectedCourtLabel = computed(() => { const c = this.store.courts().find(item => item.id === this.model().courtId); return c ? `${c.venue.name} · ${c.name}` : 'Campo non selezionato'; });
  ngOnInit(): void { this.actions.set([{ id:'cancel-create', label:'Annulla creazione', shortLabel:'Annulla', icon:'pi-times', danger:true, routerLink:'/partite' }]); void this.store.loadCourts(); }
  ngOnDestroy(): void { this.actions.clear(); }
  protected showError(field: { touched(): boolean; valid(): boolean }): boolean { return field.touched() && !field.valid(); }
  protected updateMatchField<K extends keyof MatchFormModel>(key: K, value: MatchFormModel[K]): void { this.model.update(current => ({ ...current, [key]: value })); }
  protected updateCourtField<K extends keyof CourtFormModel>(key: K, value: CourtFormModel[K]): void { this.courtModel.update(current => ({ ...current, [key]: value })); }
  protected async createCourt(): Promise<void> { this.courtForm().markAsTouched(); if (this.courtForm().invalid()) return; const v=this.courtModel(); const id=await this.store.createCourt({venueName:v.venueName.trim(),address:v.address.trim(),city:v.city.trim(),courtName:v.courtName.trim(),indoor:v.indoor}); if(id){this.matchForm.courtId().value.set(id);this.showNewCourt.set(false);} }
  protected next(): void {
    this.stepError.set(null);
    if (this.step() === 1 && !this.model().courtId) {
      this.matchForm.courtId().markAsTouched();
      if (this.showNewCourt() || !this.store.courts().length) this.courtForm().markAsTouched();
      return;
    }
    if (this.step() === 2) {
      this.matchForm.date().markAsTouched();
      this.matchForm.time().markAsTouched();
      const value = this.model();
      if (!value.date || !value.time) return;
      const startsAt = new Date(`${value.date}T${value.time}`).getTime();
      if (!Number.isFinite(startsAt) || startsAt <= Date.now() + 15 * 60 * 1000) {
        this.stepError.set('Data e ora devono essere almeno 15 minuti nel futuro.');
        return;
      }
      if (+value.minLevel > +value.maxLevel) {
        this.stepError.set('Il livello minimo non può superare quello massimo.');
        return;
      }
    }
    this.step.update(value => Math.min(3, value + 1));
  }
  protected back(): void { if(this.step()===1){void this.router.navigateByUrl('/partite');return;}this.step.update(v=>v-1); }
  protected async submitMatch(event: Event): Promise<void> { event.preventDefault();this.matchForm().markAsTouched();if(this.matchForm().invalid()||this.store.saving())return;const v=this.model();const id=await this.store.createMatch({courtId:v.courtId,gender:v.gender,minLevel:+v.minLevel,maxLevel:+v.maxLevel,startsAt:new Date(`${v.date}T${v.time}`).toISOString(),durationMinutes:+v.duration,capacity:+v.capacity,notes:v.notes.trim()||null});if(id)await this.router.navigate(['/partite',id]); }
}
