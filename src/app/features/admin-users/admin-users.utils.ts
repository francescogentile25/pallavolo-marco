import { UserProfile } from '../auth/models/auth.model';
import { AdminActiveFilter, AdminRoleFilter } from './models/admin-user.model';

export function filterAdminUsers(
  users: readonly UserProfile[],
  search: string,
  activeFilter: AdminActiveFilter,
  roleFilter: AdminRoleFilter,
): readonly UserProfile[] {
  const normalizedSearch = search.trim().toLocaleLowerCase('it');

  return users.filter((user) => {
    const matchesSearch =
      !normalizedSearch ||
      `${user.nome} ${user.cognome} ${user.email}`
        .toLocaleLowerCase('it')
        .includes(normalizedSearch);
    const matchesActive =
      activeFilter === 'tutti' ||
      (activeFilter === 'attivi' ? user.attivo : !user.attivo);
    const matchesRole = roleFilter === 'tutti' || user.ruolo === roleFilter;
    return matchesSearch && matchesActive && matchesRole;
  });
}
