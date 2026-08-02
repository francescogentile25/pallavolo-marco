import { UserCapabilities, UserRole } from './models/auth.model';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  giocatore: 'Utente comune',
  organizzatore: 'Organizzatore',
  admin: 'Amministratore',
};

const COMMON_CAPABILITIES: UserCapabilities = {
  manageOwnProfile: true,
  createMatches: true,
  joinMatches: true,
  joinTournaments: true,
  organizeTournaments: false,
  administerApplication: false,
};

export const USER_ROLE_CAPABILITIES: Record<UserRole, UserCapabilities> = {
  giocatore: COMMON_CAPABILITIES,
  organizzatore: { ...COMMON_CAPABILITIES, organizeTournaments: true },
  admin: {
    manageOwnProfile: true,
    createMatches: true,
    joinMatches: true,
    joinTournaments: true,
    organizeTournaments: true,
    administerApplication: true,
  },
};

export function capabilitiesForRole(role: UserRole | null | undefined): UserCapabilities {
  return role ? USER_ROLE_CAPABILITIES[role] : {
    manageOwnProfile: false,
    createMatches: false,
    joinMatches: false,
    joinTournaments: false,
    organizeTournaments: false,
    administerApplication: false,
  };
}
