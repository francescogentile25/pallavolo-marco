import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { PageActionsService } from '../../../core/services/page-actions.service';
import { CourtInput, CourtItem } from '../models/court.model';
import { CourtsService } from '../services/courts.service';

const EMPTY: CourtInput = { venueName: '', address: '', city: '', courtName: '', indoor: false };

@Component({
  selector: 'app-courts-page',
  imports: [FormsModule, Button, Checkbox, Dialog, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="courts-page">
      <header class="courts-hero">
        <div>
          <p class="eyebrow">I tuoi campi</p>
          <h1>Campi</h1>
          <p>Crea e gestisci i tuoi campi. Trovi anche quelli dove hai giocato su invito di altri.</p>
        </div>
        <button type="button" class="new-btn" (click)="openCreate()"><i class="pi pi-plus" aria-hidden="true"></i> Nuovo campo</button>
      </header>

      @if (loading()) {
        <div class="state" role="status"><span class="spinner"></span> Caricamento campi</div>
      } @else {
        <section class="court-list" aria-label="Elenco campi">
          @for (c of courts(); track c.id) {
            <article class="court-card" [class.inherited]="!c.owned">
              <span class="court-ico"><i class="pi pi-map-marker" aria-hidden="true"></i></span>
              <div class="court-body">
                <strong>{{ c.venue.name }} · {{ c.name }}</strong>
                <small>{{ c.venue.address }}, {{ c.venue.city }}</small>
                <div class="court-tags">
                  <span class="tag">{{ c.indoor ? 'Coperto' : "All'aperto" }}</span>
                  <span class="tag">{{ c.surface }}</span>
                  @if (!c.owned) { <span class="tag tag-inherited">Ereditato</span> }
                </div>
              </div>
              @if (c.owned) {
                <div class="court-actions">
                  <button type="button" aria-label="Modifica" (click)="openEdit(c)"><i class="pi pi-pencil"></i></button>
                  <button type="button" class="danger" aria-label="Elimina" (click)="askDelete(c)"><i class="pi pi-trash"></i></button>
                </div>
              }
            </article>
          } @empty {
            <div class="state empty">
              <i class="pi pi-map-marker" aria-hidden="true"></i>
              <h3>Nessun campo</h3>
              <p>Crea il tuo primo campo o gioca una partita per ereditarne uno.</p>
              <p-button label="Nuovo campo" icon="pi pi-plus" (onClick)="openCreate()" />
            </div>
          }
        </section>
      }

      <p-dialog
        [visible]="dialogOpen()"
        (visibleChange)="dialogOpen.set($event)"
        [modal]="true"
        [draggable]="false"
        [resizable]="false"
        [header]="editing() ? 'Modifica campo' : 'Nuovo campo'"
        [style]="{ width: '460px', maxWidth: '96vw' }"
      >
        <div class="court-form">
          <div class="field">
            <label for="c-venue">Nome struttura</label>
            <input id="c-venue" pInputText [ngModel]="form().venueName" (ngModelChange)="setField('venueName', $event)" maxlength="120" />
          </div>
          <div class="field">
            <label for="c-name">Nome campo</label>
            <input id="c-name" pInputText [ngModel]="form().courtName" (ngModelChange)="setField('courtName', $event)" maxlength="80" />
          </div>
          <div class="field">
            <label for="c-address">Indirizzo</label>
            <input id="c-address" pInputText [ngModel]="form().address" (ngModelChange)="setField('address', $event)" maxlength="180" autocomplete="street-address" />
          </div>
          <div class="field">
            <label for="c-city">Città</label>
            <input id="c-city" pInputText [ngModel]="form().city" (ngModelChange)="setField('city', $event)" maxlength="100" autocomplete="address-level2" />
          </div>
          <div class="check">
            <p-checkbox inputId="c-indoor" [ngModel]="form().indoor" (ngModelChange)="setField('indoor', $event)" [binary]="true" />
            <label for="c-indoor">Campo coperto</label>
          </div>
          @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
        </div>
        <div class="court-form-actions">
          <p-button type="button" severity="secondary" [outlined]="true" label="Annulla" (onClick)="dialogOpen.set(false)" />
          <p-button type="button" [label]="editing() ? 'Salva' : 'Crea campo'" icon="pi pi-check" [loading]="saving()" [disabled]="!canSave()" (onClick)="save()" />
        </div>
      </p-dialog>
    </main>
  `,
  styles: `
    :host { display: block; }
    .courts-page { width: min(100%, 860px); padding: 18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 48px); margin: 0 auto; }
    .courts-hero { display: grid; gap: 16px; padding: 22px 4px 18px; }
    .eyebrow { margin: 0 0 8px; color: var(--color-brand-strong); font-size: .72rem; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
    h1 { margin: 0 0 8px; font: 900 clamp(2rem, 9vw, 3.4rem)/.95 var(--display-font); letter-spacing: -.045em; }
    .courts-hero p:last-of-type { max-width: 44rem; margin: 0; color: var(--color-ink-muted); line-height: 1.5; }
    .new-btn { display: inline-flex; align-items: center; gap: 8px; justify-self: start; padding: 11px 18px; color: white; border: 0; border-radius: 14px; background: var(--color-brand); font: inherit; font-weight: 800; font-size: .82rem; cursor: pointer; }
    .new-btn:hover { background: var(--color-brand-strong); }
    .court-list { display: grid; gap: 10px; }
    .court-card { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 14px; padding: 14px; border: 1px solid var(--color-border); border-radius: 18px; background: var(--color-surface); }
    .court-card.inherited { background: var(--color-surface-muted); }
    .court-ico { display: grid; width: 44px; height: 44px; place-items: center; color: var(--color-brand-strong); border-radius: 13px; background: var(--color-brand-soft); }
    .court-body { display: grid; gap: 3px; min-width: 0; }
    .court-body strong { font-size: .88rem; }
    .court-body small { color: var(--color-ink-muted); font-size: .74rem; }
    .court-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }
    .tag { padding: 2px 8px; border-radius: 99px; background: var(--color-surface-muted); color: var(--color-ink-muted); font-size: .64rem; font-weight: 700; text-transform: capitalize; }
    .court-card.inherited .tag { background: var(--color-surface); }
    .tag-inherited { color: var(--color-brand-strong); background: var(--color-brand-soft); }
    .court-actions { display: flex; gap: 4px; }
    .court-actions button { display: grid; width: 38px; height: 38px; place-items: center; color: var(--color-ink-muted); border: 1px solid var(--color-border); border-radius: 11px; background: var(--color-surface); cursor: pointer; }
    .court-actions button:hover { background: var(--color-surface-muted); }
    .court-actions button.danger:hover { color: var(--color-danger); border-color: var(--color-danger); }
    .state { display: grid; min-height: 240px; place-content: center; justify-items: center; gap: 10px; color: var(--color-ink-muted); text-align: center; }
    .state.empty { border: 1px dashed var(--color-border); border-radius: 20px; }
    .state.empty i { font-size: 2rem; }
    .state.empty h3, .state.empty p { margin: 0; }
    .spinner { width: 18px; height: 18px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }
    .court-form { display: grid; gap: 14px; }
    .field { display: grid; gap: 6px; }
    .field label { font-size: .76rem; font-weight: 800; }
    .field input { width: 100%; min-height: 46px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); }
    .check { display: flex; align-items: center; gap: 9px; font-size: .8rem; font-weight: 700; }
    .form-error { margin: 0; color: var(--color-danger); font-size: .76rem; }
    .court-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
    @media (min-width: 620px) { .courts-hero { grid-template-columns: 1fr auto; align-items: end; } }
  `,
})
export class CourtsPage implements OnInit, OnDestroy {
  private readonly service = inject(CourtsService);
  private readonly pageActions = inject(PageActionsService);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  protected readonly courts = signal<CourtItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<CourtItem | null>(null);
  protected readonly form = signal<CourtInput>({ ...EMPTY });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.pageActions.set([{ id: 'new-court', label: 'Nuovo campo', shortLabel: 'Nuovo', icon: 'pi-plus', primary: true, click: () => this.openCreate() }]);
    void this.load();
  }
  ngOnDestroy(): void { this.pageActions.clear(); }

  private async load(): Promise<void> {
    this.loading.set(true);
    try { this.courts.set(await this.service.listMine()); } catch { this.messages.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare i campi.' }); }
    this.loading.set(false);
  }

  protected setField<K extends keyof CourtInput>(key: K, value: CourtInput[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected canSave(): boolean {
    const f = this.form();
    return !!f.venueName.trim() && !!f.courtName.trim() && !!f.address.trim() && !!f.city.trim();
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.set({ ...EMPTY, courtName: 'Campo 1' });
    this.error.set(null);
    this.dialogOpen.set(true);
  }

  protected openEdit(c: CourtItem): void {
    this.editing.set(c);
    this.form.set({ venueName: c.venue.name, address: c.venue.address, city: c.venue.city, courtName: c.name, indoor: c.indoor });
    this.error.set(null);
    this.dialogOpen.set(true);
  }

  protected async save(): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const input: CourtInput = {
      venueName: this.form().venueName.trim(),
      address: this.form().address.trim(),
      city: this.form().city.trim(),
      courtName: this.form().courtName.trim(),
      indoor: this.form().indoor,
    };
    try {
      const current = this.editing();
      if (current) await this.service.update(current.id, input);
      else await this.service.create(input);
      this.dialogOpen.set(false);
      await this.load();
      this.messages.add({ severity: 'success', summary: current ? 'Campo aggiornato' : 'Campo creato', detail: `${input.venueName} · ${input.courtName}` });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Operazione non riuscita.');
    }
    this.saving.set(false);
  }

  protected askDelete(c: CourtItem): void {
    this.confirm.confirm({
      header: 'Elimina campo',
      message: `Eliminare "${c.venue.name} · ${c.name}"? Le partite già create lo mantengono, ma non comparirà più tra i tuoi campi.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', variant: 'text' },
      accept: async () => {
        try { await this.service.remove(c.id); await this.load(); this.messages.add({ severity: 'info', summary: 'Campo eliminato', detail: `${c.venue.name} · ${c.name}` }); }
        catch { this.messages.add({ severity: 'error', summary: 'Errore', detail: 'Eliminazione non riuscita.' }); }
      },
    });
  }
}
