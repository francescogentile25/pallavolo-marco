import { Injectable } from '@angular/core';
import { CourtItem } from '../courts/models/court.model';
import { AddableUser, FriendProfile, FriendRequest } from '../friends/models/friend.model';
import { BeachMatch, Court, MatchDetails } from '../matches/models/match.model';
import { AppNotification } from '../notifications/models/notification.model';
import { Tournament } from '../tournaments/models/tournament.model';

const DEMO_ID = '00000000-0000-4000-8000-000000000001';
const isoAt = (days: number, hour: number): string => {
  const date = new Date(); date.setDate(date.getDate() + days); date.setHours(hour, 30, 0, 0); return date.toISOString();
};
const venue = (id: string, name: string, city: string, address: string, lat: number, lng: number) => ({ id, name, city, address, latitude: lat, longitude: lng, place_id: 1 });

@Injectable({ providedIn: 'root' })
export class DemoData {
  readonly courts: Court[] = [
    { id: 'court-aurora', venue_id: 'venue-aurora', name: 'Campo centrale', surface: 'sand', indoor: false, venue: venue('venue-aurora', 'Lido Aurora', 'Pescara', 'Via del Mare 24', 42.468, 14.226) },
    { id: 'court-sole', venue_id: 'venue-sole', name: 'Campo 2', surface: 'sand', indoor: false, venue: venue('venue-sole', 'Arena del Sole', 'Montesilvano', 'Lungomare 8', 42.51, 14.17) },
    { id: 'court-park', venue_id: 'venue-park', name: 'Campo coperto', surface: 'sand', indoor: true, venue: venue('venue-park', 'Beach Park', 'Francavilla al Mare', 'Viale Nettuno 12', 42.42, 14.29) },
  ];
  private joined = false;
  readonly matches: BeachMatch[] = [
    this.match('match-aurora', 0, 18, this.courts[0], 3, 5, ['luca', 'nina', 'anna']),
    this.match('match-sole', 1, 19, this.courts[1], 4, 6, ['fabio', 'giulia']),
    this.match('match-park', 3, 10, this.courts[2], 2, 4, ['luca']),
  ];
  readonly tournaments: Tournament[] = [this.tournament('tournament-sunset', 'Sunset Cup', 4, this.courts[0]), this.tournament('tournament-adriatic', 'Adriatic Open', 11, this.courts[2])];
  readonly friends: FriendProfile[] = [
    { id: 'luca', nome: 'Luca', cognome: 'Bianchi', livello: 4 }, { id: 'nina', nome: 'Nina', cognome: 'Rosi', livello: 4 },
    { id: 'anna', nome: 'Anna', cognome: 'Ricci', livello: 5 }, { id: 'fabio', nome: 'Fabio', cognome: 'Serra', livello: 5 },
  ];
  readonly requests: FriendRequest[] = [{ request_id: 1, id: 'giulia', nome: 'Giulia', cognome: 'Conti', livello: 4 }];
  readonly addable: AddableUser[] = [...this.friends.map(friend => ({ ...friend, relation: 'friend' as const })), { id: 'giulia', nome: 'Giulia', cognome: 'Conti', livello: 4, relation: 'incoming' }];
  readonly notifications: AppNotification[] = [
    { id: 1, type: 'match_invited', match_id: 'match-aurora', tournament_id: null, actor_id: 'luca', actor_name: 'Luca Bianchi', payload: {}, is_read: false, created_at: isoAt(0, new Date().getHours()) },
    { id: 2, type: 'friend_request_received', match_id: null, tournament_id: null, actor_id: 'giulia', actor_name: 'Giulia Conti', payload: {}, is_read: false, created_at: isoAt(0, Math.max(0, new Date().getHours() - 1)) },
    { id: 3, type: 'tournament_registration_closed', match_id: null, tournament_id: 'tournament-sunset', actor_id: null, actor_name: null, payload: {}, is_read: true, created_at: isoAt(-1, 18) },
  ];

  get myMatches(): BeachMatch[] { return this.matches.filter(match => match.id === 'match-aurora' && this.joined); }
  getMatch(id: string): MatchDetails {
    const match = this.matches.find(item => item.id === id) ?? this.matches[0];
    return { ...match, participantDetails: match.participants.map((p, index) => ({ profile_id: p.profile_id, nome: p.profile_id === DEMO_ID ? 'Marco' : ['Luca', 'Nina', 'Anna', 'Fabio'][index] ?? 'Giocatore', cognome: p.profile_id === DEMO_ID ? 'Demo' : 'Beach', avatar_url: null, livello: 4, joined_at: p.joined_at ?? new Date().toISOString(), is_creator: index === 0, attendance_status: null, my_rating: null })) };
  }
  join(id: string): void { const match = this.matches.find(item => item.id === id); if (!match || match.participants.some(p => p.profile_id === DEMO_ID)) return; match.participants = [...match.participants, { profile_id: DEMO_ID, joined_at: new Date().toISOString() }]; this.joined = true; }
  withdraw(id: string): void { const match = this.matches.find(item => item.id === id); if (!match) return; match.participants = match.participants.filter(p => p.profile_id !== DEMO_ID); this.joined = false; }
  courtItems(): CourtItem[] { return this.courts.map(c => ({ id: c.id, name: c.name, indoor: c.indoor, surface: c.surface, owned: c.id !== 'court-park', venue: c.venue })); }

  private match(id: string, days: number, hour: number, court: Court, min: number, max: number, players: string[]): BeachMatch { const now = new Date().toISOString(); return { id, creator_id: players[0], court_id: court.id, status: 'open', visibility: 'public', gender: 'mixed', min_level: min, max_level: max, starts_at: isoAt(days, hour), duration_minutes: 90, capacity: 4, notes: 'Partita dimostrativa: porta acqua e voglia di giocare.', created_at: now, updated_at: now, completed_at: null, court, participants: players.map(profile_id => ({ profile_id, joined_at: now })) }; }
  private tournament(id: string, title: string, days: number, court: Court): Tournament { return { id, organizer_id: DEMO_ID, venue_id: court.venue_id, status: 'published', visibility: 'public', title, description: 'Torneo dimostrativo Beach Volley Hub', registration_mode: 'hybrid', format: 'mixed', gender: 'mixed', min_level: 3, max_level: 6, max_teams: 8, registration_deadline: isoAt(days - 1, 20), starts_at: isoAt(days, 9), ends_at: isoAt(days, 20), cost_cents: 2000, guaranteed_matches: 3, group_size: 4, qualifiers_per_group: 2, group_best_of: 1, group_set_points: 21, knockout_best_of: 3, knockout_set_points: 21, tiebreak_points: 15, win_by_two: true, third_place: true, standings_win_points: 2, standings_loss_points: 0, minimum_rest_minutes: 20, result_confirmation_required: true, groups_closed_at: null, city: court.venue.city, city_place_id: 1, city_latitude: court.venue.latitude, city_longitude: court.venue.longitude, organizer_logo_url: null, organizer_email: 'demo@beachvolleyhub.it', organizer_phone: null, champion_team_id: null, runner_up_team_id: null, third_place_team_id: null, venue: court.venue, courts: [{ court_id: court.id, court }], teams: [], brackets: [], groups: [], group_teams: [], games: [] }; }
}
