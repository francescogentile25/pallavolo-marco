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

  function cells(): HTMLButtonElement[] {
    return fixture.debugElement.queryAll(By.css('.grid .cell')).map(item => item.nativeElement as HTMLButtonElement);
  }

  function touch(element: HTMLElement): void {
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
    // Safari invia anche questo click sintetico: non deve ripetere l'azione.
    element.click();
    fixture.detectChanges();
  }

  it('disegna la settimana a partire da lunedi', () => {
    const weekdays = fixture.debugElement.queryAll(By.css('.weekdays span'));
    expect(weekdays.length).toBe(7);
    expect((weekdays[0].nativeElement as HTMLElement).textContent?.trim()).toBe('Lun');
    expect(cells().length).toBe(7);
  });

  it('seleziona il giorno toccato e ci porta dietro il periodo', () => {
    const before = text('.range');
    const last = cells()[6];
    last.click();
    fixture.detectChanges();

    expect(cells()[6].getAttribute('aria-pressed')).toBe('true');
    expect(text('.range')).toBe(before);

    // La freccia continua a muovere la settimana, non il singolo giorno.
    const steps = fixture.debugElement.queryAll(By.css('.step'));
    (steps[1].nativeElement as HTMLElement).click();
    fixture.detectChanges();
    expect(text('.range')).not.toBe(before);
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

  it('gestisce il tocco iOS senza eseguire anche il click sintetico', () => {
    const component = fixture.componentInstance as unknown as { shift: (direction: number) => void };
    const shift = spyOn(component, 'shift').and.callThrough();
    const next = fixture.debugElement.queryAll(By.css('.step'))[1].nativeElement as HTMLElement;

    touch(next);

    expect(shift).toHaveBeenCalledOnceWith(1);
  });

  it('cambia vista e seleziona un giorno con pointer touch', () => {
    const month = fixture.debugElement.queryAll(By.css('.switch button'))[1].nativeElement as HTMLElement;
    touch(month);
    expect(text('h2')).toBe('Questo mese');

    const target = cells().find(cell => !cell.classList.contains('selected') && !cell.classList.contains('outside'))!;
    touch(target);
    expect(target.getAttribute('aria-pressed')).toBe('true');
  });

  it('in vista mese riempie righe intere e segna i giorni degli altri mesi', () => {
    clickButton('Mese');

    const grid = cells();
    expect(grid.length % 7).toBe(0);
    expect(grid.length).toBeGreaterThanOrEqual(28);

    const inside = grid.filter(cell => !cell.classList.contains('outside'));
    const days = inside.map(cell => Number(cell.querySelector('.cell-day')?.textContent));
    expect(days[0]).toBe(1);
    expect(days.length).toBe(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
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
