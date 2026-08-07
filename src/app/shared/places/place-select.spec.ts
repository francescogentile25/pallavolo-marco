import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { AutoComplete } from 'primeng/autocomplete';
import { PlacesService } from '../../core/services/places.service';
import { PlaceSelect } from './place-select';
import { PlaceRef } from './place.model';

const ROMA: PlaceRef = { placeId: 3169070, name: 'Roma', admin1: 'Lazio', admin2: 'Provincia di Roma', latitude: 41.89193, longitude: 12.51133 };

class PlacesStub {
  async search(): Promise<readonly PlaceRef[]> { return [ROMA]; }
  async resolve(): Promise<PlaceRef | null> { return ROMA; }
}

describe('PlaceSelect', () => {
  let fixture: ComponentFixture<PlaceSelect>;
  let emitted: (PlaceRef | null)[];

  function autocomplete(): AutoComplete {
    return fixture.debugElement.query(By.directive(AutoComplete)).componentInstance as AutoComplete;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PlaceSelect],
      providers: [provideNoopAnimations(), { provide: PlacesService, useClass: PlacesStub }],
    });
    fixture = TestBed.createComponent(PlaceSelect);
    fixture.componentRef.setInput('text', '');
    emitted = [];
    fixture.componentInstance.placeChange.subscribe(place => emitted.push(place));
    fixture.detectChanges();
  });

  function selectRoma(): void {
    autocomplete().onSelect.emit({ originalEvent: new Event('click'), value: { label: 'Roma · Lazio', place: ROMA } });
    fixture.detectChanges();
  }

  it('emette il comune scelto una sola volta', () => {
    selectRoma();
    expect(emitted).toEqual([ROMA]);
  });

  it('non svuota il campo dopo la scelta: il valore resta l’opzione selezionata', () => {
    selectRoma();
    // Il modello del datepicker deve restare l'opzione, non il solo nome:
    // con il nome nudo PrimeNG non ritroverebbe la corrispondenza e pulirebbe.
    expect(typeof autocomplete().modelValue()).toBe('object');
    expect(emitted.length).toBe(1);
  });

  it('emette null quando si svuota un campo valorizzato', () => {
    selectRoma();
    autocomplete().onClear.emit();
    fixture.detectChanges();
    expect(emitted).toEqual([ROMA, null]);
  });

  it('non emette niente svuotando un campo gia vuoto', () => {
    autocomplete().onClear.emit();
    fixture.detectChanges();
    expect(emitted).toEqual([]);
  });

  it('il comune gia salvato riempie il campo ma non emette', () => {
    fixture.componentRef.setInput('text', 'Rimini');
    fixture.detectChanges();
    expect(emitted).toEqual([]);
  });

  it('una scelta dell’utente non viene sovrascritta dal valore salvato', () => {
    selectRoma();
    fixture.componentRef.setInput('text', 'Rimini');
    fixture.detectChanges();
    expect(typeof autocomplete().modelValue()).toBe('object');
    expect(emitted).toEqual([ROMA]);
  });
});
