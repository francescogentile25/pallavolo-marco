import { isNight, skyMood, weatherIconName, WEATHER_ICON_FILES } from './weather-icon.model';

describe('weather-icon.model', () => {
  it('sceglie la variante diurna o notturna dove esiste', () => {
    expect(weatherIconName(0, false)).toBe('clear-day');
    expect(weatherIconName(0, true)).toBe('clear-night');
    expect(weatherIconName(95, true)).toBe('thunderstorms-night');
  });

  it('usa un unico file dove la notte non cambia il disegno', () => {
    expect(weatherIconName(63, false)).toBe('rain');
    expect(weatherIconName(63, true)).toBe('rain');
    expect(weatherIconName(71, true)).toBe('snow');
  });

  it('ripiega su una condizione neutra per i codici sconosciuti', () => {
    expect(weatherIconName(1234, false)).toBe('overcast-day');
    expect(skyMood(1234)).toBe('overcast');
  });

  it('classifica il cielo per famiglia', () => {
    expect(skyMood(0)).toBe('clear');
    expect(skyMood(2)).toBe('partly');
    expect(skyMood(45)).toBe('fog');
    expect(skyMood(80)).toBe('rain');
    expect(skyMood(96)).toBe('storm');
  });

  it('elenca senza ripetizioni i file da copiare fra gli asset', () => {
    expect(WEATHER_ICON_FILES.length).toBe(new Set(WEATHER_ICON_FILES).size);
    expect(WEATHER_ICON_FILES).toContain('clear-night');
    expect(WEATHER_ICON_FILES).toContain('rain');
  });

  it('riconosce la notte da alba e tramonto', () => {
    const sunrise = '2026-08-07T04:10:00Z';
    const sunset = '2026-08-07T18:40:00Z';
    expect(isNight(new Date('2026-08-07T12:00:00Z'), sunrise, sunset)).toBe(false);
    expect(isNight(new Date('2026-08-07T20:00:00Z'), sunrise, sunset)).toBe(true);
    expect(isNight(new Date('2026-08-07T03:00:00Z'), sunrise, sunset)).toBe(true);
  });

  it('senza alba e tramonto ripiega sull’ora locale', () => {
    const night = new Date();
    night.setHours(23, 0, 0, 0);
    const day = new Date();
    day.setHours(13, 0, 0, 0);
    expect(isNight(night, null, null)).toBe(true);
    expect(isNight(day, null, null)).toBe(false);
  });
});
