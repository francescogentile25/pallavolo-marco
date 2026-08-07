/**
 * Corrispondenza fra i codici WMO di Open-Meteo e le icone Meteocons, che
 * distinguono giorno e notte. Le icone sono SVG animati: l'animazione vive
 * dentro il file, quindi basta un <img> e non serve nulla a runtime.
 */
export type SkyMood = 'clear' | 'partly' | 'overcast' | 'fog' | 'rain' | 'snow' | 'storm';

interface Entry {
  codes: readonly number[];
  mood: SkyMood;
  /** Nome del file; `{d}` diventa "day" o "night" dove l'icona lo prevede. */
  icon: string;
}

const ENTRIES: readonly Entry[] = [
  { codes: [0], mood: 'clear', icon: 'clear-{d}' },
  { codes: [1, 2], mood: 'partly', icon: 'partly-cloudy-{d}' },
  { codes: [3], mood: 'overcast', icon: 'overcast-{d}' },
  { codes: [45, 48], mood: 'fog', icon: 'fog-{d}' },
  { codes: [51, 53, 55], mood: 'rain', icon: 'drizzle' },
  { codes: [56, 57, 66, 67], mood: 'snow', icon: 'sleet' },
  { codes: [61], mood: 'rain', icon: 'partly-cloudy-{d}-rain' },
  { codes: [63, 65], mood: 'rain', icon: 'rain' },
  { codes: [71, 73, 75, 77, 85, 86], mood: 'snow', icon: 'snow' },
  { codes: [80], mood: 'rain', icon: 'partly-cloudy-{d}-rain' },
  { codes: [81, 82], mood: 'rain', icon: 'rain' },
  { codes: [95], mood: 'storm', icon: 'thunderstorms-{d}' },
  { codes: [96, 99], mood: 'storm', icon: 'thunderstorms-{d}-rain' },
];

const FALLBACK: Entry = { codes: [], mood: 'overcast', icon: 'overcast-{d}' };

function entryFor(code: number): Entry {
  return ENTRIES.find(entry => entry.codes.includes(code)) ?? FALLBACK;
}

export function weatherIconName(code: number, night: boolean): string {
  return entryFor(code).icon.replace('{d}', night ? 'night' : 'day');
}

export function skyMood(code: number): SkyMood {
  return entryFor(code).mood;
}

/** Elenco dei file da copiare fra gli asset: tiene la build leggera. */
export const WEATHER_ICON_FILES: readonly string[] = [
  ...new Set(ENTRIES.flatMap(entry => (entry.icon.includes('{d}')
    ? [entry.icon.replace('{d}', 'day'), entry.icon.replace('{d}', 'night')]
    : [entry.icon]))),
];

/** Notte se l'ora corrente sta fuori dall'arco fra alba e tramonto. */
export function isNight(now: Date, sunrise: string | null, sunset: string | null): boolean {
  const time = now.getTime();
  const start = sunrise ? Date.parse(sunrise) : NaN;
  const end = sunset ? Date.parse(sunset) : NaN;
  if (Number.isFinite(start) && Number.isFinite(end)) return time < start || time > end;
  const hour = now.getHours();
  return hour < 6 || hour >= 21;
}
