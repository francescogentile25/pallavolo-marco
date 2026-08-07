/** Coordinate gia arrotondate: due decimali valgono circa un chilometro, basta per il meteo. */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Misura puntuale: vale sia per l'adesso sia per una singola ora futura. */
export interface WeatherPoint {
  time: string;
  temperature: number;
  apparentTemperature: number | null;
  humidity: number;
  precipitation: number | null;
  precipitationProbability: number | null;
  weatherCode: number;
  windSpeed: number;
  windGusts: number;
  uvIndex: number | null;
}

export interface WeatherSnapshot {
  current: WeatherPoint;
  /** Prossime ore, gia tagliate a partire da adesso. */
  hours: readonly WeatherPoint[];
  /** Alba e tramonto di oggi: dicono fino a quando si vede la palla, e se e notte. */
  sunrise: string | null;
  sunset: string | null;
}

export type WeatherGlyph = 'sereno' | 'poco-nuvoloso' | 'nuvoloso' | 'nebbia' | 'pioggia' | 'neve' | 'temporale';

/** Le condizioni che contano quando si gioca sulla sabbia. */
export type PlayabilityLevel = 'buone' | 'attenzione' | 'difficili';

export interface Playability {
  level: PlayabilityLevel;
  label: string;
  reason: string;
}

const DESCRIPTIONS: readonly (readonly [readonly number[], string, WeatherGlyph])[] = [
  [[0], 'Sereno', 'sereno'],
  [[1], 'Poco nuvoloso', 'poco-nuvoloso'],
  [[2], 'Parzialmente nuvoloso', 'poco-nuvoloso'],
  [[3], 'Coperto', 'nuvoloso'],
  [[45, 48], 'Nebbia', 'nebbia'],
  [[51, 53, 55, 56, 57], 'Pioviggine', 'pioggia'],
  [[61, 66], 'Pioggia debole', 'pioggia'],
  [[63], 'Pioggia', 'pioggia'],
  [[65, 67], 'Pioggia forte', 'pioggia'],
  [[71, 73, 75, 77, 85, 86], 'Neve', 'neve'],
  [[80], 'Rovesci deboli', 'pioggia'],
  [[81], 'Rovesci', 'pioggia'],
  [[82], 'Rovesci intensi', 'pioggia'],
  [[95], 'Temporale', 'temporale'],
  [[96, 99], 'Temporale con grandine', 'temporale'],
];

export function weatherDescription(code: number): string {
  return DESCRIPTIONS.find(([codes]) => codes.includes(code))?.[1] ?? 'Condizioni variabili';
}

export function weatherGlyph(code: number): WeatherGlyph {
  return DESCRIPTIONS.find(([codes]) => codes.includes(code))?.[2] ?? 'nuvoloso';
}

/**
 * Giudizio sul campo, non sul tempo in generale: sulla sabbia il vento sposta la
 * palla molto prima che il cielo diventi brutto, quindi le raffiche pesano piu di tutto.
 */
export function playability(point: WeatherPoint): Playability {
  const rain = (point.precipitation ?? 0) >= 0.5 || (point.precipitationProbability ?? 0) >= 60 || point.weatherCode >= 61;
  if (point.weatherCode >= 95) return { level: 'difficili', label: 'Si gioca male', reason: 'Temporale previsto.' };
  if (rain) return { level: 'difficili', label: 'Si gioca male', reason: 'Pioggia probabile.' };
  if (point.windGusts >= 40) return { level: 'difficili', label: 'Si gioca male', reason: `Raffiche fino a ${Math.round(point.windGusts)} km/h.` };
  if (point.windGusts >= 25) return { level: 'attenzione', label: 'Campo ventoso', reason: `Raffiche fino a ${Math.round(point.windGusts)} km/h.` };
  if ((point.uvIndex ?? 0) >= 8) return { level: 'attenzione', label: 'Sole forte', reason: `Indice UV ${Math.round(point.uvIndex ?? 0)}: crema e acqua.` };
  if (point.temperature >= 33) return { level: 'attenzione', label: 'Caldo intenso', reason: `Percepiti ${Math.round(point.apparentTemperature ?? point.temperature)}°.` };
  if (point.temperature <= 8) return { level: 'attenzione', label: 'Sabbia fredda', reason: `Solo ${Math.round(point.temperature)}° in campo.` };
  return { level: 'buone', label: 'Buone condizioni', reason: 'Niente pioggia, vento contenuto.' };
}

export function roundCoordinates(value: Coordinates): Coordinates {
  return { latitude: Math.round(value.latitude * 100) / 100, longitude: Math.round(value.longitude * 100) / 100 };
}
