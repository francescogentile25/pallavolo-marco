import { BeachMatch, MatchFilters } from './models/match.model';
import { availableSpots, filterMatches, isUserJoined, levelRangeLabel } from './matches.utils';

const match = {
  id: 'm1', status: 'open', gender: 'mixed', min_level: 3, max_level: 5,
  starts_at: '2026-08-02T18:00:00Z', capacity: 4,
  participants: [{ profile_id: 'u1' }, { profile_id: 'u2' }],
  court: { name: 'Campo 1', venue: { name: 'Beach Arena', city: 'Roma' } },
} as unknown as BeachMatch;
const filters: MatchFilters = { query: '', gender: 'all', level: null, onlyAvailable: false, date: 'all' };

describe('match utilities', () => {
  it('calculates availability and membership', () => {
    expect(availableSpots(match)).toBe(2);
    expect(isUserJoined(match, 'u2')).toBeTrue();
    expect(isUserJoined(match, 'other')).toBeFalse();
  });
  it('combines discovery filters', () => {
    expect(filterMatches([match], { ...filters, query: 'arena' })).toEqual([match]);
    expect(filterMatches([match], { ...filters, gender: 'male' })).toEqual([]);
    expect(filterMatches([match], { ...filters, level: 4 })).toEqual([match]);
    expect(filterMatches([{ ...match, status: 'full' }], { ...filters, onlyAvailable: true })).toEqual([]);
  });
  it('formats ranges', () => expect(levelRangeLabel(match)).toBe('Livello 3–5'));
});
