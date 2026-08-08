import { BeachMatch, MatchFilters, MatchGender, MatchStatus } from './models/match.model';

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  draft: 'Bozza',
  open: 'Aperta',
  full: 'Completa',
  in_progress: 'In corso',
  completed: 'Conclusa',
  cancelled: 'Annullata',
};

export const MATCH_GENDER_LABELS: Record<MatchGender, string> = {
  male: 'Maschile',
  female: 'Femminile',
  mixed: 'Misto',
};

export function availableSpots(match: BeachMatch): number {
  return Math.max(0, match.capacity - match.participants.length);
}

export function levelLabel(value: number): string {
  if (value <= 2) return 'Principiante';
  if (value <= 4) return 'Intermedio';
  if (value === 5) return 'Intermedio avanzato';
  if (value === 6) return 'Avanzato';
  return 'Pro player';
}

export function levelRangeLabel(match: Pick<BeachMatch, 'min_level' | 'max_level'>): string {
  if (match.min_level === match.max_level) return `${match.min_level} · ${levelLabel(match.min_level)}`;
  return `Livello ${match.min_level}–${match.max_level}`;
}

/** Intervallo senza prefisso, per i riquadri che hanno gia "Livello" scritto accanto. */
export function levelRangeShort(match: Pick<BeachMatch, 'min_level' | 'max_level'>): string {
  if (match.min_level === match.max_level) return levelLabel(match.min_level);
  return `${match.min_level}–${match.max_level}`;
}

export function isUserJoined(match: BeachMatch, userId: string | null | undefined): boolean {
  return !!userId && match.participants.some((participant) => participant.profile_id === userId);
}

export function filterMatches(
  matches: readonly BeachMatch[],
  filters: MatchFilters,
  now = new Date(),
): readonly BeachMatch[] {
  const query = filters.query.trim().toLocaleLowerCase('it');
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  const weekendEnd = new Date(now);
  const daysToSunday = (7 - now.getDay()) % 7;
  weekendEnd.setDate(now.getDate() + daysToSunday);
  weekendEnd.setHours(23, 59, 59, 999);

  return matches.filter((match) => {
    if (match.status === 'cancelled' || match.status === 'draft') return false;
    const startsAt = new Date(match.starts_at);
    const searchable = `${match.court.venue.name} ${match.court.name} ${match.court.venue.city}`
      .toLocaleLowerCase('it');
    return (
      (!query || searchable.includes(query)) &&
      (filters.visibility === 'all' || match.visibility === filters.visibility) &&
      (filters.gender === 'all' || match.gender === filters.gender) &&
      (filters.level === null ||
        (filters.level >= match.min_level && filters.level <= match.max_level)) &&
      (!filters.onlyAvailable || (match.status === 'open' && availableSpots(match) > 0)) &&
      (filters.date === 'all' ||
        (filters.date === 'today' && startsAt >= now && startsAt <= dayEnd) ||
        (filters.date === 'weekend' && startsAt >= now && startsAt <= weekendEnd))
    );
  });
}

export function matchErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const normalized = raw.toLocaleLowerCase('it');
  if (normalized.includes('invitati superano')) return 'Riduci il numero di giocatori invitati.';
  if (normalized.includes('invitati non sono disponibili')) return 'Uno o più giocatori invitati non sono più disponibili.';
  if (normalized.includes('invitati non rientrano') || normalized.includes('giocatori invitati non rientrano')) return 'Uno o più invitati non rientrano nella fascia di livello scelta.';
  if (normalized.includes('invitati hanno gia una partita')) return 'Uno o più invitati hanno già una partita in questa fascia oraria.';
  if (normalized.includes('solo il creatore puo modificare')) return 'Solo l’organizzatore può modificare questa partita.';
  if (normalized.includes('non puo piu essere modificata')) return 'Questa partita non può più essere modificata.';
  if (normalized.includes('capienza non puo essere inferiore')) return 'La capienza non può essere inferiore ai partecipanti attuali.';
  if (normalized.includes('fascia di livello esclude')) return 'La fascia di livello esclude uno o più partecipanti attuali.';
  if (normalized.includes('nuovo orario si sovrappone')) return 'Il nuovo orario si sovrappone a un impegno di uno o più partecipanti.';
  if (normalized.includes('completo')) return 'La partita è appena diventata completa.';
  if (normalized.includes('gia iscritto')) return 'Sei già iscritto a questa partita.';
  if (normalized.includes('livello')) return 'Il tuo livello non rientra nella fascia ammessa.';
  if (normalized.includes('fascia oraria')) return 'Hai già una partita in questa fascia oraria.';
  if (normalized.includes('creatore deve annullare')) return 'Come organizzatore puoi annullare la partita.';
  if (normalized.includes('non accetta')) return 'La partita non accetta più iscrizioni.';
  if (normalized.includes('campo non validi')) return 'Controlla i dati del nuovo campo.';
  if (normalized.includes('dati partita')) return 'Controlla i dati della partita.';
  if (normalized.includes('gia valutato')) return 'Hai già valutato questo giocatore.';
  if (normalized.includes('finestra di valutazione')) return 'La finestra di 7 giorni per votare è terminata.';
  if (normalized.includes('no-show gia')) return 'Il no-show è già stato registrato.';
  if (normalized.includes('finestra per il no-show')) return 'La finestra di 48 ore per il no-show è terminata.';
  if (normalized.includes('non puo ancora essere chiusa')) return 'La partita può essere chiusa solo dopo l’orario di fine.';
  return 'Operazione non riuscita. Riprova.';
}
