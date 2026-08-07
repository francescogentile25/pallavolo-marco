import { Injectable } from '@angular/core';
import { PlaceRef } from '../../shared/places/place.model';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const STORAGE_PREFIX = 'bvh:places:';
const LOOKUP_TTL = 30 * 24 * 60 * 60 * 1000;

interface GeocodingRow {
  id: number;
  name: string;
  admin1?: string;
  admin2?: string;
  latitude: number;
  longitude: number;
  population?: number;
}

/**
 * Anagrafica dei comuni, servita da Open-Meteo (dati geonames) senza chiavi.
 * E la stessa sorgente del meteo: scegliendo un comune da qui, le coordinate
 * salvate sono esattamente quelle su cui poi si chiede la previsione.
 */
@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly memory = new Map<string, PlaceRef | null>();

  /** Comuni italiani che iniziano per `query`, i piu popolosi per primi. */
  async search(query: string, signal?: AbortSignal): Promise<readonly PlaceRef[]> {
    const term = query.trim();
    if (term.length < 2) return [];
    const url = `${GEOCODING_URL}?name=${encodeURIComponent(term)}&count=10&language=it&format=json&countryCode=IT`;
    const data = await this.request<{ results?: readonly GeocodingRow[] }>(url, signal);
    return (data?.results ?? [])
      .slice()
      .sort((first, second) => (second.population ?? 0) - (first.population ?? 0))
      .map(row => this.toPlace(row));
  }

  /**
   * Ricava un comune dal solo nome: serve ai luoghi inseriti prima
   * dell'anagrafica, che hanno la citta ma non l'identificativo.
   */
  async resolve(name: string | null | undefined): Promise<PlaceRef | null> {
    const term = (name ?? '').trim();
    if (term.length < 2) return null;
    const key = term.toLocaleLowerCase('it');
    if (this.memory.has(key)) return this.memory.get(key) ?? null;

    const stored = this.readStored(key);
    if (stored !== undefined) {
      this.memory.set(key, stored);
      return stored;
    }

    const [first] = await this.search(term);
    const place = first ?? null;
    this.memory.set(key, place);
    this.writeStored(key, place);
    return place;
  }

  private toPlace(row: GeocodingRow): PlaceRef {
    return {
      placeId: Number(row.id),
      name: String(row.name),
      admin1: row.admin1 ?? null,
      admin2: row.admin2 ?? null,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    };
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

  private readStored(key: string): PlaceRef | null | undefined {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      if (!raw) return undefined;
      const entry = JSON.parse(raw) as { at: number; value: PlaceRef | null };
      if (Date.now() - entry.at >= LOOKUP_TTL) return undefined;
      return entry.value;
    } catch {
      return undefined;
    }
  }

  private writeStored(key: string, value: PlaceRef | null): void {
    try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ at: Date.now(), value })); } catch { /* storage non disponibile */ }
  }
}
