import { UserProfile } from '../auth/models/auth.model';
import { filterAdminUsers } from './admin-users.utils';

const users = [
  { id: '1', nome: 'Ada', cognome: 'Rossi', email: 'ada@example.it', ruolo: 'admin', attivo: true },
  { id: '2', nome: 'Marco', cognome: 'Bianchi', email: 'marco@example.it', ruolo: 'giocatore', attivo: false },
  { id: '3', nome: 'Sara', cognome: 'Verdi', email: 'sara@example.it', ruolo: 'organizzatore', attivo: true },
] as UserProfile[];

describe('filterAdminUsers', () => {
  it('searches case-insensitively across name and email', () => {
    expect(filterAdminUsers(users, 'ROSSI', 'tutti', 'tutti')).toEqual([users[0]]);
    expect(filterAdminUsers(users, 'marco@', 'tutti', 'tutti')).toEqual([users[1]]);
  });

  it('combines activation and role filters', () => {
    expect(filterAdminUsers(users, '', 'in_attesa', 'giocatore')).toEqual([users[1]]);
    expect(filterAdminUsers(users, '', 'attivi', 'giocatore')).toEqual([]);
    expect(filterAdminUsers(users, '', 'attivi', 'organizzatore')).toEqual([users[2]]);
  });
});
