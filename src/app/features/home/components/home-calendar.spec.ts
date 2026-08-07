import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { CalendarEvent, HomeCalendar } from './home-calendar';

function isoAt(offsetDays: number, hour = 19): string {
  const date = new Date();
  date.setHours(hour, 30, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

describe('HomeCalendar', () => {
  let fixture: ComponentFixture<HomeCalendar>;

  // Le etichette accessibili degli eventi usano il locale italiano, registrato dall'app.
  beforeAll(() => registerLocaleData(localeIt));

  function days(): HTMLElement[] {
    return fixture.debugElement.queryAll(By.css('.day')).map(item => item.nativeElement as HTMLElement);
  }

  function clickButton(text: string): void {
    const button = fixture.debugElement
      .queryAll(By.css('button'))
      .find(item => (item.nativeElement as HTMLElement).textContent?.trim() === text);
    (button?.nativeElement as HTMLElement).click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HomeCalendar], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(HomeCalendar);
    fixture.componentRef.setInput('events', []);
    fixture.detectChanges();
  });

  it('apre sulla settimana con sette giorni a partire da lunedi', () => {
    expect(days().length).toBe(7);
    expect(fixture.debugElement.query(By.css('.day-name')).nativeElement.textContent.trim()).toBe('LUN');
  });

  it('marca il giorno corrente', () => {
    expect(days().filter(day => day.classList.contains('today')).length).toBe(1);
  });

  it('passa al mese con una griglia chiusa a settimane intere', () => {
    clickButton('Mese');
    const cells = days();
    expect(cells.length % 7).toBe(0);
    expect(cells.length).toBeGreaterThanOrEqual(28);
    expect(cells.some(cell => cell.classList.contains('outside'))).toBe(true);
  });

  it('sposta il periodo avanti e indietro senza perdere la scala', () => {
    const before = fixture.debugElement.query(By.css('.range')).nativeElement.textContent;
    fixture.debugElement.queryAll(By.css('.step'))[1].nativeElement.click();
    fixture.detectChanges();
    const after = fixture.debugElement.query(By.css('.range')).nativeElement.textContent;
    expect(after).not.toBe(before);
    expect(days().length).toBe(7);

    fixture.debugElement.queryAll(By.css('.step'))[0].nativeElement.click();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.range')).nativeElement.textContent).toBe(before);
  });

  it('colloca gli eventi nel giorno giusto e distingue partite e tornei', () => {
    const events: CalendarEvent[] = [
      { id: 'm1', kind: 'match', startsAt: isoAt(0, 19), label: 'Pala Beach', link: ['/partite', 'm1'] },
      { id: 't1', kind: 'tournament', startsAt: isoAt(0, 16), label: 'Sunset Cup', link: ['/tornei', 't1'] },
    ];
    fixture.componentRef.setInput('events', events);
    fixture.detectChanges();

    const today = days().find(day => day.classList.contains('today'))!;
    const rendered = today.querySelectorAll('.event');
    expect(rendered.length).toBe(2);
    // Il torneo delle 16 precede la partita delle 19: dentro il giorno si ordina per orario.
    expect(rendered[0].classList.contains('tournament')).toBe(true);
    expect(rendered[1].classList.contains('tournament')).toBe(false);
  });

  it('ignora gli eventi con data non valida invece di rompere la griglia', () => {
    fixture.componentRef.setInput('events', [
      { id: 'x', kind: 'match', startsAt: 'non-una-data', label: 'Rotta', link: ['/partite', 'x'] },
    ]);
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.css('.event')).length).toBe(0);
    expect(days().length).toBe(7);
  });
});
