/**
 * Comune scelto dall'anagrafica: `placeId` e l'identificativo geonames, stabile
 * fra utenti e sessioni. E quello che rende confrontabili le citta di partite,
 * tornei e profili, dove il testo libero non bastava.
 */
export interface PlaceRef {
  placeId: number;
  name: string;
  /** Regione. */
  admin1: string | null;
  /** Provincia. */
  admin2: string | null;
  latitude: number;
  longitude: number;
}

const RADIUS_KM = 6371;

/** Etichetta da mostrare: comune, provincia e regione senza ripetizioni. */
export function placeLabel(place: PlaceRef): string {
  const province = cleanProvince(place.admin2);
  const parts = [place.name, province && province !== place.name ? province : null, place.admin1];
  return parts.filter(Boolean).join(' · ');
}

/** "Provincia di Rimini" o "Comune di Gazzo" non aggiungono nulla: resta il nome. */
function cleanProvince(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/^(provincia di|citta metropolitana di|città metropolitana di|comune di)\s+/i, '').trim() || null;
}

/** Distanza in chilometri fra due punti, formula dell'emisenoverso. */
export function distanceKm(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRad(second.latitude - first.latitude);
  const deltaLon = toRad(second.longitude - first.longitude);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRad(first.latitude)) * Math.cos(toRad(second.latitude)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Confronto di ripiego per i luoghi inseriti prima dell'anagrafica. */
export function sameCityName(first: string | null | undefined, second: string | null | undefined): boolean {
  const normalize = (value: string | null | undefined) => (value ?? '')
    .trim()
    .toLocaleLowerCase('it')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const left = normalize(first);
  return !!left && left === normalize(second);
}
