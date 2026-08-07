import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { PRIMENG_IT } from '../../../core/i18n/primeng-it';
import { CalendarEvent, HomeCalendar } from './home-calendar';

/** Data locale a `offsetDays` da oggi, con orario fissato. */
function isoAt(offsetDays: number, hour = 19): string {
  const date = new Date();
  date.setHours(hour, 30, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

describe('HomeCalendar', () => {
  let fixture: ComponentFixture<HomeCalendar>;

  // Le etichette usano il locale italiano, registrato dall'app.
  beforeAll(() => registerLocaleData(localeIt));

  function text(selector: string): string {
    return (fixture.debugElement.query(By.css(selector))?.nativeElement as HTMLElement | undefined)?.textContent?.trim() ?? '';
  }

  function agendaLinks(): HTMLElement[] {
    return fixture.debugElement.queryAll(By.css('.agenda-day a')).map(item => item.nativeElement as HTMLElement);
  }

  function clickButton(label: string): void {
    const button = fixture.debugElement
      .queryAll(By.css('.switch button'))
      .find(item => (item.nativeElement as HTMLElement).textContent?.trim() === label);
    (button!.nativeElement as HTMLElement).click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HomeCalendar],
      providers: [provideRouter([]), provideNoopAnimations(), providePrimeNG({ translation: PRIMENG_IT })],
    });
    fixture = TestBed.createComponent(HomeCalendar);
    fixture.componentRef.setInput('events', []);
    fixture.detectChanges();
  });

  it('monta il datepicker PrimeNG con la settimana che parte da lunedi', () => {
    const weekdays = fixture.debugElement.queryAll(By.css('.p-datepicker-weekday'));
    expect(weekdays.length).toBe(7);
    expect((weekdays[0].nativeElement as HTMLElement).textContent?.trim()).toBe('lu');
  });

  it('apre sulla settimana e passa al mese', () => {
    expect(text('h2')).toBe('Questa settimana');
    expect(text('.agenda-head')).toBe('Impegni della settimana');

    clickButton('Mese');
    expect(text('h2')).toBe('Questo mese');
    expect(text('.agenda-head')).toBe('Impegni del mese');
  });

  it('sposta il periodo avanti e indietro senza cambiare scala', () => {
    const before = text('.range');
    const steps = fixture.debugElement.queryAll(By.css('.step'));

    (steps[1].nativeElement as HTMLElement).click();
    fixture.detectChanges();
    expect(text('.range')).not.toBe(before);

    (steps[0].nativeElement as HTMLElement).click();
    fixture.detectChanges();
    expect(text('.range')).toBe(before);
    expect(text('h2')).toBe('Questa settimana');
  });

  it('porta la griglia sul mese del periodo, anche saltando da una settimana all’altra', async () => {
    const steps = fixture.debugElement.queryAll(By.css('.step'));
    // Sei settimane indietro superano di sicuro il confine del mese.
    for (let click = 0; click < 6; click += 1) {
      (steps[0].nativeElement as HTMLElement).click();
      fixture.detectChanges();
    }
    // ngModel scrive nel datepicker in una microtask: la griglia si aggiorna dopo.
    await fixture.whenStable();
    fixture.detectChanges();

    const shown = text('.p-datepicker-select-month').toLocaleLowerCase('it');
    expect(text('.range').toLocaleLowerCase('it')).toContain(shown.slice(0, 3));
  });

  it('elenca solo gli impegni del periodo attivo, in ordine di orario', () => {
    const events: CalendarEvent[] = [
      { id: 'm1', kind: 'match', startsAt: isoAt(0, 19), label: 'Pala Beach', link: ['/partite', 'm1'] },
      { id: 't1', kind: 'tournament', startsAt: isoAt(0, 16), label: 'Sunset Cup', link: ['/tornei', 't1'] },
      { id: 'm2', kind: 'match', startsAt: isoAt(60, 18), label: 'Fuori periodo', link: ['/partite', 'm2'] },
    ];
    fixture.componentRef.setInput('events', events);
    fixture.detectChanges();

    const links = agendaLinks();
    expect(links.length).toBe(2);
    expect(links[0].textContent).toContain('Sunset Cup');
    expect(links[0].classList.contains('tournament')).toBe(true);
    expect(links[1].textContent).toContain('Pala Beach');
    expect(links.some(link => link.textContent?.includes('Fuori periodo'))).toBe(false);
  });

  it('segna con i punti i giorni impegnati', () => {
    fixture.componentRef.setInput('events', [
      { id: 't1', kind: 'tournament', startsAt: isoAt(0, 16), label: 'Sunset Cup', link: ['/tornei', 't1'] },
    ]);
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.css('.picker .dot.tournament')).length).toBe(1);
    expect(fixture.debugElement.queryAll(By.css('.picker .dot.match')).length).toBe(0);
  });

  it('ignora gli eventi con data non valida', () => {
    fixture.componentRef.setInput('events', [
      { id: 'x', kind: 'match', startsAt: 'non-una-data', label: 'Rotta', link: ['/partite', 'x'] },
    ]);
    fixture.detectChanges();
    expect(agendaLinks().length).toBe(0);
    expect(text('.agenda-empty')).toBe('Nessun impegno in questo periodo.');
  });
});
