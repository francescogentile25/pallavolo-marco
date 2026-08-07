import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoComplete, AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { PlacesService } from '../../core/services/places.service';
import { PlaceRef, placeLabel } from './place.model';

interface PlaceOption {
  label: string;
  place: PlaceRef;
}

/**
 * Selezione di un comune italiano con ricerca. Sostituisce ovunque il campo di
 * testo libero: cosi due utenti che indicano la stessa citta salvano lo stesso
 * comune, con le coordinate che servono a confronti di vicinanza e meteo.
 *
 * Il valore mostrato resta quello scelto dall'utente: sovrascriverlo con il solo
 * nome farebbe perdere la corrispondenza con l'opzione e il campo si
 * svuoterebbe da solo. Il dato esce solo su due azioni esplicite, la scelta di
 * un comune e lo svuotamento del campo.
 */
@Component({
  selector: 'app-place-select',
  imports: [AutoComplete, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-autocomplete
      [inputId]="inputId()"
      [ngModel]="value()"
      (ngModelChange)="value.set($event)"
      [suggestions]="options()"
      (completeMethod)="search($event)"
      (onSelect)="choose($event)"
      (onClear)="clear()"
      optionLabel="label"
      [delay]="320"
      [minQueryLength]="2"
      [showClear]="showClear()"
      [invalid]="invalid()"
      [emptyMessage]="searching() ? 'Ricerca in corso…' : 'Nessun comune trovato'"
      [placeholder]="placeholder()"
      appendTo="body"
      fluid />
  `,
  styles: `:host{display:block}`,
})
export class PlaceSelect {
  readonly inputId = input<string>('place');
  readonly placeholder = input('Cerca il comune');
  readonly invalid = input(false);
  readonly showClear = input(true);
  /** Comune gia salvato, mostrato all'apertura del modulo. */
  readonly text = input<string>('');
  readonly placeChange = output<PlaceRef | null>();

  private readonly places = inject(PlacesService);
  protected readonly value = signal<string | PlaceOption>('');
  protected readonly options = signal<PlaceOption[]>([]);
  protected readonly searching = signal(false);
  /** Dopo una scelta il campo appartiene all'utente: il valore iniziale non lo tocca piu. */
  private chosen = false;

  constructor() {
    effect(() => {
      const seed = this.text();
      if (this.chosen) return;
      untracked(() => this.value.set(seed ?? ''));
    });
  }

  protected async search(event: AutoCompleteCompleteEvent): Promise<void> {
    this.searching.set(true);
    const found = await this.places.search(event.query);
    this.options.set(found.map(place => ({ label: placeLabel(place), place })));
    this.searching.set(false);
  }

  protected choose(event: AutoCompleteSelectEvent): void {
    const option = event.value as PlaceOption;
    this.chosen = true;
    this.value.set(option);
    this.placeChange.emit(option.place);
  }

  protected clear(): void {
    const hadValue = !!this.value();
    this.chosen = false;
    this.value.set('');
    this.options.set([]);
    // Senza niente da togliere non si avvisa nessuno: eviterebbe una rimozione fantasma.
    if (hadValue) this.placeChange.emit(null);
  }
}
