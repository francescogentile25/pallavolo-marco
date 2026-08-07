import { Venue } from '../../features/matches/models/match.model';
import { Tournament } from '../../features/tournaments/models/tournament.model';
import { PlacePoint } from './nearby.service';

/** Il luogo di una partita e la sede del campo. */
export function matchVenuePoint(venue: Venue): PlacePoint {
  return {
    placeId: venue.place_id ?? null,
    latitude: venue.latitude,
    longitude: venue.longitude,
    city: venue.city,
  };
}

/** Il torneo puo indicare un comune diverso da quello della struttura: vince il suo. */
export function tournamentPoint(tournament: Tournament): PlacePoint {
  return {
    placeId: tournament.city_place_id ?? tournament.venue.place_id ?? null,
    latitude: tournament.city_latitude ?? tournament.venue.latitude,
    longitude: tournament.city_longitude ?? tournament.venue.longitude,
    city: tournament.city || tournament.venue.city,
  };
}
