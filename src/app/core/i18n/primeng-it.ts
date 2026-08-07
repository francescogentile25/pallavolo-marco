import { Translation } from 'primeng/api';

/**
 * Etichette italiane dei componenti PrimeNG: calendari, filtri e conferme.
 * Le sigle dei giorni sono di due lettere perche in italiano l'iniziale singola
 * non distingue martedi da mercoledi.
 */
export const PRIMENG_IT: Translation = {
  dayNames: ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'],
  dayNamesShort: ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'],
  dayNamesMin: ['do', 'lu', 'ma', 'me', 'gi', 've', 'sa'],
  monthNames: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  monthNamesShort: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
  // La settimana italiana comincia di lunedi.
  firstDayOfWeek: 1,
  today: 'Oggi',
  clear: 'Svuota',
  dateFormat: 'dd/mm/yy',
  weekHeader: 'Sett',
  accept: 'Sì',
  reject: 'No',
  chooseYear: 'Scegli l’anno',
  chooseMonth: 'Scegli il mese',
  chooseDate: 'Scegli la data',
  prevDecade: 'Decennio precedente',
  nextDecade: 'Decennio successivo',
  prevYear: 'Anno precedente',
  nextYear: 'Anno successivo',
  prevMonth: 'Mese precedente',
  nextMonth: 'Mese successivo',
  emptyMessage: 'Nessun risultato',
  emptyFilterMessage: 'Nessun risultato',
};
