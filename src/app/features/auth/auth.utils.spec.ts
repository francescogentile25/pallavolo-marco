import { capabilitiesForRole, USER_ROLE_LABELS } from './auth.utils';

describe('role capabilities', () => {
  it('grants common capabilities to every authenticated role', () => {
    for (const role of ['giocatore', 'organizzatore', 'admin'] as const) {
      const capabilities = capabilitiesForRole(role);
      expect(capabilities.manageOwnProfile).toBeTrue();
      expect(capabilities.createMatches).toBeTrue();
      expect(capabilities.joinMatches).toBeTrue();
      expect(capabilities.joinTournaments).toBeTrue();
    }
  });

  it('restricts tournament organization to organizers and admins', () => {
    expect(capabilitiesForRole('giocatore').organizeTournaments).toBeFalse();
    expect(capabilitiesForRole('organizzatore').organizeTournaments).toBeTrue();
    expect(capabilitiesForRole('admin').organizeTournaments).toBeTrue();
  });

  it('reserves application administration to admins', () => {
    expect(capabilitiesForRole('giocatore').administerApplication).toBeFalse();
    expect(capabilitiesForRole('organizzatore').administerApplication).toBeFalse();
    expect(capabilitiesForRole('admin').administerApplication).toBeTrue();
    expect(USER_ROLE_LABELS.giocatore).toBe('Utente comune');
    expect(USER_ROLE_LABELS.organizzatore).toBe('Organizzatore');
  });
});
