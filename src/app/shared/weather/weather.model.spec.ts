import { placeLabel, playability, roundCoordinates, weatherDescription, weatherGlyph, WeatherPoint } from './weather.model';

function point(overrides: Partial<WeatherPoint> = {}): WeatherPoint {
  return {
    time: '2026-08-07T12:00Z',
    temperature: 26,
    apparentTemperature: 27,
    humidity: 55,
    precipitation: 0,
    precipitationProbability: 5,
    weatherCode: 0,
    windSpeed: 8,
    windGusts: 12,
    uvIndex: 5,
    ...overrides,
  };
}

describe('weather.model', () => {
  it('descrive i codici WMO noti e ripiega su un testo neutro', () => {
    expect(weatherDescription(0)).toBe('Sereno');
    expect(weatherDescription(95)).toBe('Temporale');
    expect(weatherDescription(1234)).toBe('Condizioni variabili');
  });

  it('sceglie il glifo per famiglia di fenomeno', () => {
    expect(weatherGlyph(0)).toBe('sereno');
    expect(weatherGlyph(80)).toBe('pioggia');
    expect(weatherGlyph(73)).toBe('neve');
  });

  it('promuove le giornate senza pioggia e con vento contenuto', () => {
    expect(playability(point()).level).toBe('buone');
  });

  it('boccia temporale e pioggia probabile', () => {
    expect(playability(point({ weatherCode: 95 })).level).toBe('difficili');
    expect(playability(point({ precipitationProbability: 70 })).level).toBe('difficili');
  });

  it('pesa le raffiche piu della pioggia leggera', () => {
    expect(playability(point({ windGusts: 28 })).level).toBe('attenzione');
    expect(playability(point({ windGusts: 45 })).level).toBe('difficili');
  });

  it('segnala sole forte e caldo intenso senza dichiarare il campo impraticabile', () => {
    expect(playability(point({ uvIndex: 9 })).level).toBe('attenzione');
    expect(playability(point({ temperature: 34 })).level).toBe('attenzione');
  });

  it('arrotonda le coordinate a due decimali per riusare la cache', () => {
    expect(roundCoordinates({ latitude: 44.057551, longitude: 12.565281 })).toEqual({ latitude: 44.06, longitude: 12.57 });
  });

  it('non ripete il nome quando la provincia coincide', () => {
    const place = { id: 1, name: 'Roma', admin1: 'Roma', country: 'Italia', countryCode: 'IT', latitude: 41.9, longitude: 12.5 };
    expect(placeLabel(place)).toBe('Roma, Italia');
    expect(placeLabel({ ...place, admin1: 'Lazio' })).toBe('Roma, Lazio, Italia');
  });
});
