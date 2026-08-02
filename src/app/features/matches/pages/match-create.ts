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
        <p>Organizza</p><h1>Crea una partita</h1>
        <div class="progress" aria-label="Avanzamento creazione">
          @for (item of [1, 2, 3]; track item) { <span [class.active]="step() >= item">{{ item }}</span> }
        </div>
      </header>
      <form (submit)="submitMatch($event)" novalidate>
        @if (step() === 1) {
          <section class="form-card">
            <div class="heading"><div><p>Passo 1 di 3</p><h2>Dove giochiamo?</h2></div><i class="pi pi-map-marker"></i></div>
            @if (store.courts().length) {
              <div class="field"><label for="court">Campo</label><p-select inputId="court" [ngModel]="model().courtId" (ngModelChange)="updateMatchField('courtId', $event)" [ngModelOptions]="standaloneNgModel" [options]="courtOptions()" optionLabel="label" optionValue="value" placeholder="Seleziona un campo" fluid /></div>
            }
            <p-button type="button" [text]="true" icon="pi pi-plus" [label]="showNewCourt() ? 'Chiudi nuovo campo' : 'Aggiungi un nuovo campo'" (onClick)="showNewCourt.set(!showNewCourt())" />
            @if (showNewCourt() || !store.courts().length) {
              <div class="new-court">
                <div class="field"><label for="venue">Nome struttura</label><input id="venue" pInputText [formField]="courtForm.venueName" /></div>
                <div class="field"><label for="court-name">Nome campo</label><input id="court-name" pInputText [formField]="courtForm.courtName" /></div>
                <div class="field wide"><label for="address">Indirizzo</label><input id="address" pInputText [formField]="courtForm.address" autocomplete="street-address" /></div>
                <div class="field"><label for="city">Città</label><input id="city" pInputText [formField]="courtForm.city" autocomplete="address-level2" /></div>
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
              <div class="field"><label for="date">Data</label><input id="date" type="date" [formField]="matchForm.date" /></div>
              <div class="field"><label for="time">Ora</label><input id="time" type="time" [formField]="matchForm.time" /></div>
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
    :host{display:block}.create-page{width:min(100%,760px);padding:18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 50px);margin:auto}header{padding:24px 20px;color:white;border-radius:27px 27px 0 0;background:linear-gradient(145deg,#071d26,#123945)}header>p,.heading p{margin:0 0 5px;color:#84efe3;font-size:.68rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}h1{margin:0;font:900 clamp(2rem,10vw,3.8rem)/.95 var(--display-font);letter-spacing:-.05em}.progress{display:flex;gap:8px;margin-top:22px}.progress span{display:grid;width:28px;height:28px;place-items:center;border:2px solid rgb(255 255 255/.3);border-radius:50%;font-size:.7rem;font-weight:900}.progress span.active{color:var(--color-ocean);border-color:var(--color-brand);background:var(--color-brand)}.form-card{min-height:410px;padding:22px 18px;border:1px solid var(--color-border);border-top:0;border-radius:0 0 25px 25px;background:white}.heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}.heading p{color:var(--color-brand-strong)}.heading h2{margin:0;font:900 1.55rem/1 var(--display-font)}.heading>i{display:grid;width:46px;height:46px;place-items:center;border-radius:15px;color:var(--color-brand-strong);background:var(--color-brand-soft);font-size:1.2rem}.field{display:grid;align-content:start;gap:7px}.field label{font-size:.76rem;font-weight:850}.field input,.field select,.field textarea{width:100%;min-height:48px;padding:0 12px;border:1px solid var(--color-border);border-radius:13px;color:var(--color-ink);background:white}.field textarea{padding:12px;resize:vertical}.grid,.new-court{display:grid;gap:15px}.new-court{padding:16px;margin-top:12px;border-radius:18px;background:var(--color-surface-muted)}.text-button{display:flex;min-height:44px;align-items:center;gap:8px;padding:0;border:0;color:var(--color-brand-strong);background:transparent;font-weight:850;cursor:pointer}.check{display:flex;min-height:44px;align-items:center;gap:9px;font-size:.76rem;font-weight:800}.check input{width:20px;height:20px;accent-color:var(--color-brand-strong)}.level-fields{display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:8px}.level-fields>span{padding-bottom:15px}.summary{display:grid;gap:9px;margin-bottom:20px}.summary div{display:grid;gap:3px;padding:12px;border-radius:15px;background:var(--color-surface-muted)}.summary span{color:var(--color-ink-muted);font-size:.65rem}.summary strong{font-size:.8rem}.notice{display:flex;gap:8px;padding:12px;color:var(--color-brand-strong);border-radius:13px;background:var(--color-brand-soft);font-size:.72rem}.error{color:var(--color-danger);font-size:.72rem}.wide{grid-column:1/-1}footer{display:flex;justify-content:space-between;gap:10px;padding:16px 0}input:focus-visible,select:focus-visible,textarea:focus-visible,button:focus-visible{outline:3px solid var(--color-focus);outline-offset:2px}@media(min-width:620px){.create-page{padding:34px 28px 120px}.form-card{padding:28px}.grid,.new-court{grid-template-columns:repeat(2,minmax(0,1fr))}.wide{grid-column:1/-1}}
  `,
})
export class MatchCreate implements OnInit, OnDestroy {
  protected readonly store = inject(MatchesStore); private readonly router = inject(Router); private readonly actions = inject(PageActionsService);
  protected readonly step = signal(1); protected readonly showNewCourt = signal(false); protected readonly stepError = signal<string | null>(null); protected readonly levels = [1,2,3,4,5,6,7];
  protected readonly standaloneNgModel = { standalone: true };
  protected readonly durationOptions = [{ label: '60 minuti', value: '60' }, { label: '90 minuti', value: '90' }, { label: '120 minuti', value: '120' }];
  protected readonly capacityOptions = [{ label: '4 giocatori', value: '4' }, { label: '6 giocatori', value: '6' }, { label: '8 giocatori', value: '8' }];
  protected readonly genderOptions: { label: string; value: MatchGender }[] = [{ label: 'Misto', value: 'mixed' }, { label: 'Maschile', value: 'male' }, { label: 'Femminile', value: 'female' }];
  protected readonly levelOptions = this.levels.map((level) => ({ label: String(level), value: String(level) }));
  protected readonly model = signal<MatchFormModel>({ courtId:'', date:'', time:'', duration:'90', capacity:'4', gender:'mixed', minLevel:'1', maxLevel:'7', notes:'' });
  protected readonly matchForm = form(this.model, p => { required(p.courtId); required(p.date); required(p.time); maxLength(p.notes, 1000); });
  protected readonly courtModel = signal<CourtFormModel>({ venueName:'', address:'', city:'', courtName:'Campo 1', indoor:false });
  protected readonly courtForm = form(this.courtModel, p => { required(p.venueName); required(p.address); required(p.city); required(p.courtName); });
  protected readonly courtOptions = computed(() => this.store.courts().map((court) => ({ label: `${court.venue.name} · ${court.name} · ${court.venue.city}`, value: court.id })));
  protected readonly selectedCourtLabel = computed(() => { const c = this.store.courts().find(item => item.id === this.model().courtId); return c ? `${c.venue.name} · ${c.name}` : 'Campo non selezionato'; });
  ngOnInit(): void { this.actions.set([{ id:'cancel-create', label:'Annulla creazione', shortLabel:'Annulla', icon:'pi-times', danger:true, routerLink:'/partite' }]); void this.store.loadCourts(); }
  ngOnDestroy(): void { this.actions.clear(); }
  protected updateMatchField<K extends keyof MatchFormModel>(key: K, value: MatchFormModel[K]): void { this.model.update(current => ({ ...current, [key]: value })); }
  protected updateCourtField<K extends keyof CourtFormModel>(key: K, value: CourtFormModel[K]): void { this.courtModel.update(current => ({ ...current, [key]: value })); }
  protected async createCourt(): Promise<void> { this.courtForm().markAsTouched(); if (this.courtForm().invalid()) return; const v=this.courtModel(); const id=await this.store.createCourt({venueName:v.venueName.trim(),address:v.address.trim(),city:v.city.trim(),courtName:v.courtName.trim(),indoor:v.indoor}); if(id){this.matchForm.courtId().value.set(id);this.showNewCourt.set(false);} }
  protected next(): void { this.stepError.set(null); if(this.step()===1 && !this.model().courtId){this.matchForm.courtId().markAsTouched();return;} if(this.step()===2){const v=this.model();const starts=new Date(`${v.date}T${v.time}`);if(!v.date||!v.time||starts.getTime()<=Date.now()+15*60*1000){this.stepError.set('Scegli un orario di almeno 15 minuti nel futuro.');return;}if(+v.minLevel>+v.maxLevel){this.stepError.set('Il livello minimo non può superare quello massimo.');return;}} this.step.update(v=>Math.min(3,v+1)); }
  protected back(): void { if(this.step()===1){void this.router.navigateByUrl('/partite');return;}this.step.update(v=>v-1); }
  protected async submitMatch(event: Event): Promise<void> { event.preventDefault();this.matchForm().markAsTouched();if(this.matchForm().invalid()||this.store.saving())return;const v=this.model();const id=await this.store.createMatch({courtId:v.courtId,gender:v.gender,minLevel:+v.minLevel,maxLevel:+v.maxLevel,startsAt:new Date(`${v.date}T${v.time}`).toISOString(),durationMinutes:+v.duration,capacity:+v.capacity,notes:v.notes.trim()||null});if(id)await this.router.navigate(['/partite',id]); }
}
