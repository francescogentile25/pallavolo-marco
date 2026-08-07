import { distanceKm, placeLabel, PlaceRef, sameCityName } from './place.model';

function place(overrides: Partial<PlaceRef> = {}): PlaceRef {
  return { placeId: 3169070, name: 'Roma', admin1: 'Lazio', admin2: 'Provincia di Roma', latitude: 41.89193, longitude: 12.51133, ...overrides };
}

describe('place.model', () => {
  it('mostra comune, provincia e regione senza ripetere il nome', () => {
    expect(placeLabel(place())).toBe('Roma · Lazio');
    expect(placeLabel(place({ name: 'Ostia', admin2: 'Provincia di Roma' }))).toBe('Ostia · Roma · Lazio');
  });

  it('toglie i prefissi burocratici dalla provincia', () => {
    expect(placeLabel(place({ name: 'Riccione', admin2: 'Città metropolitana di Rimini', admin1: 'Emilia-Romagna' })))
      .toBe('Riccione · Rimini · Emilia-Romagna');
  });

  it('misura la distanza fra due comuni', () => {
    const roma = place();
    const rimini = place({ name: 'Rimini', latitude: 44.05755, longitude: 12.56528 });
    // Roma-Rimini in linea d'aria sta poco sopra i 240 km.
    expect(distanceKm(roma, rimini)).toBeGreaterThan(230);
    expect(distanceKm(roma, rimini)).toBeLessThan(260);
    expect(distanceKm(roma, roma)).toBeCloseTo(0, 5);
  });

  it('tiene dentro il raggio i comuni della stessa area', () => {
    const roma = place();
    const fiumicino = place({ name: 'Fiumicino', latitude: 41.7714, longitude: 12.2359 });
    expect(distanceKm(roma, fiumicino)).toBeLessThan(50);
  });

  it('confronta i nomi ignorando accenti e maiuscole', () => {
    expect(sameCityName('Forlì', 'forli')).toBe(true);
    expect(sameCityName('  Roma ', 'ROMA')).toBe(true);
    expect(sameCityName('Roma', 'Rimini')).toBe(false);
    expect(sameCityName(null, null)).toBe(false);
    expect(sameCityName('', 'Roma')).toBe(false);
  });
});
