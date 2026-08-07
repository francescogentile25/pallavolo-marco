import { computed, inject, Injectable, signal } from '@angular/core';
import { PlacesService } from '../../core/services/places.service';
import { AuthStore } from '../../features/auth/store/auth.store';
import { distanceKm, PlaceRef, sameCityName } from './place.model';

/** Quanto lontano si e disposti a spostarsi per giocare. */
export const NEARBY_KM = 50;

/** Un luogo da confrontare: puo avere l'anagrafica, le sole coordinate o solo il nome. */
export interface PlacePoint {
  placeId: number | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
}

export function cityKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase('it');
}

/**
 * Decide cosa e vicino al comune scelto nel profilo. I luoghi salvati prima
 * dell'anagrafica hanno solo il nome: quelli vengono risolti una volta sola e
 * tenuti in cache, cosi il raggio vale anche sui dati storici senza doverli
 * riscrivere. Il servizio e condiviso da home, partite e tornei perche la
 * regola di vicinanza deve essere una sola.
 */
@Injectable({ providedIn: 'root' })
export class NearbyPlaces {
  readonly radiusKm = NEARBY_KM;

  private readonly authStore = inject(AuthStore);
  private readonly places = inject(PlacesService);
  private readonly resolved = signal<ReadonlyMap<string, PlaceRef | null>>(new Map());
  private pending = new Set<string>();

  /** Comune del profilo: null finche l'utente non ne sceglie uno. */
  readonly home = computed(() => {
    const profile = this.authStore.profile();
    if (!profile?.city_latitude || !profile.city_longitude) return null;
    return {
      placeId: profile.city_place_id ?? null,
      latitude: profile.city_latitude,
      longitude: profile.city_longitude,
      name: profile.city,
    };
  });

  readonly cityName = computed(() => this.home()?.name ?? null);
  readonly hasHome = computed(() => this.home() !== null);

  /** Mette in coda i comuni dei luoghi privi di coordinate. Ignora i gia noti. */
  resolveMissing(points: Iterable<PlacePoint>): void {
    const known = this.resolved();
    const missing: string[] = [];
    for (const point of points) {
      if (point.latitude !== null && point.longitude !== null) continue;
      const key = cityKey(point.city);
      if (key.length < 2 || known.has(key) || this.pending.has(key)) continue;
      this.pending.add(key);
      missing.push(key);
    }
    if (missing.length) void this.resolve(missing);
  }

  /**
   * Vicino significa: stesso comune dell'anagrafica, oppure entro il raggio.
   * Senza comune nel profilo non si filtra niente: meglio mostrare tutto che
   * nascondere in silenzio.
   */
  isNearby(point: PlacePoint): boolean {
    const home = this.home();
    if (!home) return true;
    if (point.placeId !== null && home.placeId !== null && point.placeId === home.placeId) return true;

    const target = point.latitude !== null && point.longitude !== null
      ? { latitude: point.latitude, longitude: point.longitude }
      : this.resolved().get(cityKey(point.city)) ?? null;

    if (target) return distanceKm(home, target) <= NEARBY_KM;
    return sameCityName(point.city, home.name);
  }

  private async resolve(names: readonly string[]): Promise<void> {
    const found = await Promise.all(names.map(name => this.places.resolve(name)));
    this.resolved.update(current => {
      const next = new Map(current);
      names.forEach((name, index) => next.set(name, found[index]));
      return next;
    });
    for (const name of names) this.pending.delete(name);
  }
}
