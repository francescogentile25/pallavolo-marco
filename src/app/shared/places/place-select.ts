import { ChangeDetectionStrategy, Component, inject, input, model, output, signal } from '@angular/core';
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
 */
@Component({
  selector: 'app-place-select',
  imports: [AutoComplete, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-autocomplete
      [inputId]="inputId()"
      [ngModel]="text()"
      (ngModelChange)="text.set($event)"
      [suggestions]="options()"
      (completeMethod)="search($event)"
      (onSelect)="choose($event)"
      (onClear)="clear()"
      optionLabel="label"
      [delay]="320"
      [minQueryLength]="2"
      [forceSelection]="true"
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
  /** Testo mostrato nel campo: il nome del comune gia salvato, se c'e. */
  readonly text = model<string | PlaceOption>('');
  readonly placeChange = output<PlaceRef | null>();

  private readonly places = inject(PlacesService);
  protected readonly options = signal<PlaceOption[]>([]);
  protected readonly searching = signal(false);

  protected async search(event: AutoCompleteCompleteEvent): Promise<void> {
    this.searching.set(true);
    const found = await this.places.search(event.query);
    this.options.set(found.map(place => ({ label: placeLabel(place), place })));
    this.searching.set(false);
  }

  protected choose(event: AutoCompleteSelectEvent): void {
    const option = event.value as PlaceOption;
    this.text.set(option.place.name);
    this.placeChange.emit(option.place);
  }

  protected clear(): void {
    this.text.set('');
    this.options.set([]);
    this.placeChange.emit(null);
  }
}
