import { Injectable } from '@angular/core';
import { Coordinates, GeoPlace, roundCoordinates, WeatherPoint, WeatherSnapshot } from '../../shared/weather/weather.model';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const CURRENT_FIELDS = 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index';
const HOURLY_FIELDS = 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,uv_index';
const FORECAST_TTL = 30 * 60 * 1000;
const GEOCODING_TTL = 30 * 24 * 60 * 60 * 1000;
/** Open-Meteo pubblica previsioni orarie fino a 16 giorni: oltre non c'e nulla da mostrare. */
const FORECAST_HORIZON_DAYS = 16;
const STORAGE_PREFIX = 'bvh:weather:';

interface CacheEntry<T> { at: number; value: T }

interface ForecastResponse {
  current?: Record<string, number | string>;
  hourly?: Record<string, (number | string | null)[]>;
  daily?: Record<string, (string | null)[]>;
}

/**
 * Meteo via Open-Meteo: nessuna chiave, quindi si chiama direttamente dal browser
 * senza esporre segreti. Le risposte restano in cache mezz'ora perche il servizio
 * aggiorna a intervalli di quindici minuti e la home non deve pesare a ogni visita.
 * I dati sono richiesti in UTC: il confronto con gli orari delle partite resta esatto
 * qualunque sia il fuso del dispositivo.
 */
@Injectable({ providedIn: 'root' })
export class WeatherService {
  private readonly memory = new Map<string, CacheEntry<unknown>>();

  /** Citta suggerite mentre si scrive: nessuna cache, la query cambia a ogni tasto. */
  async searchCity(query: string, signal?: AbortSignal): Promise<readonly GeoPlace[]> {
    const term = query.trim();
    if (term.length < 2) return [];
    const url = `${GEOCODING_URL}?name=${encodeURIComponent(term)}&count=6&language=it&format=json`;
    const data = await this.request<{ results?: readonly Record<string, unknown>[] }>(url, signal);
    return (data?.results ?? []).map(item => ({
      id: Number(item['id']),
      name: String(item['name']),
      admin1: (item['admin1'] as string | undefined) ?? null,
      country: (item['country'] as string | undefined) ?? null,
      countryCode: (item['country_code'] as string | undefined) ?? null,
      latitude: Number(item['latitude']),
      longitude: Number(item['longitude']),
    }));
  }

  /** Coordinate di una sede: quelle salvate se ci sono, altrimenti geocodifica la citta. */
  async coordinatesForCity(city: string | null | undefined, saved?: Coordinates | null): Promise<Coordinates | null> {
    if (saved && Number.isFinite(saved.latitude) && Number.isFinite(saved.longitude)) return roundCoordinates(saved);
    const term = (city ?? '').trim();
    if (term.length < 2) return null;
    const key = `geo:${term.toLocaleLowerCase('it')}`;
    const cached = this.read<Coordinates | null>(key, GEOCODING_TTL);
    if (cached !== undefined) return cached;
    const [place] = await this.searchCity(term);
    const value = place ? roundCoordinates(place) : null;
    this.write(key, value);
    return value;
  }

  /** Condizioni attuali e tramonto: quello che serve alla testata della home. */
  async snapshot(coordinates: Coordinates): Promise<WeatherSnapshot | null> {
    const { latitude, longitude } = roundCoordinates(coordinates);
    const key = `now:${latitude},${longitude}`;
    const cached = this.read<WeatherSnapshot | null>(key, FORECAST_TTL);
    if (cached !== undefined) return cached;

    const url = `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&current=${CURRENT_FIELDS}&daily=sunset&forecast_days=1&timezone=UTC`;
    const data = await this.request<ForecastResponse>(url);
    const current = data?.current ? this.pointFromCurrent(data.current) : null;
    if (!current) { this.write(key, null); return null; }

    const sunset = data?.daily?.['sunset']?.[0] ?? null;
    const value: WeatherSnapshot = { current, sunset: sunset ? this.toInstant(sunset) : null };
    this.write(key, value);
    return value;
  }

  /**
   * Previsione all'ora di inizio di una partita o di un torneo. Restituisce null
   * quando l'evento e passato o troppo lontano perche esista una previsione.
   */
  async forecastAt(coordinates: Coordinates, instant: string): Promise<WeatherPoint | null> {
    const target = Date.parse(instant);
    if (!Number.isFinite(target)) return null;
    const distance = target - Date.now();
    if (distance < -60 * 60 * 1000 || distance > FORECAST_HORIZON_DAYS * 24 * 60 * 60 * 1000) return null;

    const { latitude, longitude } = roundCoordinates(coordinates);
    const day = new Date(target).toISOString().slice(0, 10);
    const key = `at:${latitude},${longitude}:${day}`;
    let points = this.read<readonly WeatherPoint[] | null>(key, FORECAST_TTL);
    if (points === undefined) {
      const url = `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&hourly=${HOURLY_FIELDS}&start_date=${day}&end_date=${day}&timezone=UTC`;
      const data = await this.request<ForecastResponse>(url);
      points = this.pointsFromHourly(data?.hourly);
      this.write(key, points);
    }
    if (!points?.length) return null;

    return points.reduce((closest, point) =>
      Math.abs(Date.parse(point.time) - target) < Math.abs(Date.parse(closest.time) - target) ? point : closest,
    );
  }

  // ---- lettura della risposta ----

  private pointFromCurrent(current: Record<string, number | string>): WeatherPoint {
    return {
      time: this.toInstant(String(current['time'])),
      temperature: Number(current['temperature_2m']),
      apparentTemperature: this.optional(current['apparent_temperature']),
      humidity: Number(current['relative_humidity_2m']),
      precipitation: this.optional(current['precipitation']),
      precipitationProbability: null,
      weatherCode: Number(current['weather_code']),
      windSpeed: Number(current['wind_speed_10m']),
      windGusts: Number(current['wind_gusts_10m']),
      uvIndex: this.optional(current['uv_index']),
    };
  }

  private pointsFromHourly(hourly: ForecastResponse['hourly']): readonly WeatherPoint[] {
    const times = (hourly?.['time'] ?? []) as string[];
    const column = (name: string) => (hourly?.[name] ?? []) as (number | null)[];
    const temperature = column('temperature_2m');
    const apparent = column('apparent_temperature');
    const humidity = column('relative_humidity_2m');
    const precipitation = column('precipitation');
    const probability = column('precipitation_probability');
    const code = column('weather_code');
    const wind = column('wind_speed_10m');
    const gusts = column('wind_gusts_10m');
    const uv = column('uv_index');

    return times.map((time, index) => ({
      time: this.toInstant(time),
      temperature: Number(temperature[index] ?? 0),
      apparentTemperature: this.optional(apparent[index]),
      humidity: Number(humidity[index] ?? 0),
      precipitation: this.optional(precipitation[index]),
      precipitationProbability: this.optional(probability[index]),
      weatherCode: Number(code[index] ?? 0),
      windSpeed: Number(wind[index] ?? 0),
      windGusts: Number(gusts[index] ?? 0),
      uvIndex: this.optional(uv[index]),
    }));
  }

  /** Open-Meteo restituisce orari UTC senza suffisso: va aggiunto per non leggerli come locali. */
  private toInstant(value: string): string {
    return /([Zz]|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  }

  private optional(value: number | string | null | undefined): number | null {
    return value === null || value === undefined || value === '' ? null : Number(value);
  }

  private async request<T>(url: string, signal?: AbortSignal): Promise<T | null> {
    try {
      const response = await fetch(url, { signal });
      if (!response.ok) return null;
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }

  // ---- cache a due livelli: memoria per la sessione, storage fra i caricamenti ----

  private read<T>(key: string, ttl: number): T | undefined {
    const hit = this.memory.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.value as T;
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      if (!raw) return undefined;
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() - entry.at >= ttl) return undefined;
      this.memory.set(key, entry);
      return entry.value;
    } catch {
      return undefined;
    }
  }

  private write<T>(key: string, value: T): void {
    const entry: CacheEntry<T> = { at: Date.now(), value };
    this.memory.set(key, entry);
    try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry)); } catch { /* storage pieno o non disponibile */ }
  }
}
