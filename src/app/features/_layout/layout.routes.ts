import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/admin.guard';
import { authGuard } from '../../core/guards/auth.guard';
import { loginGuard } from '../../core/guards/login.guard';

export const layoutRoutes: Routes = [
  { path: 'login', canActivate: [loginGuard], loadComponent: () => import('../auth/login/login').then(c => c.Login) },
  { path: 'registrazione', canActivate: [loginGuard], loadComponent: () => import('../auth/register/register').then(c => c.Register) },
  {
    path: '', canActivate: [authGuard], loadComponent: () => import('./main/main').then(c => c.Main),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('../home/home').then(c => c.Home) },
      { path: 'partite', loadComponent: () => import('../matches/pages/matches-list').then(c => c.MatchesList) },
      { path: 'partite/nuova', loadComponent: () => import('../matches/pages/match-create').then(c => c.MatchCreate) },
      { path: 'partite/mie', loadComponent: () => import('../matches/pages/my-matches').then(c => c.MyMatches) },
      { path: 'partite/:id', loadComponent: () => import('../matches/pages/match-detail').then(c => c.MatchDetail) },
      { path: 'tornei', loadComponent: () => import('../coming-soon/coming-soon').then(c => c.ComingSoon), data: { title: 'Tornei', description: 'Iscrizioni, tabelloni e gestione delle fasi torneo saranno raccolti qui.', icon: 'pi-trophy' } },
      { path: 'profilo', loadComponent: () => import('../profile/profile').then(c => c.Profile) },
      { path: 'admin/utenti', canActivate: [adminGuard], loadComponent: () => import('../admin-users/admin-users').then(c => c.AdminUsers) },
      { path: 'notifiche', loadComponent: () => import('../coming-soon/coming-soon').then(c => c.ComingSoon), data: { title: 'Notifiche', description: 'Inviti, cambi partita e aggiornamenti torneo saranno disponibili qui.', icon: 'pi-bell' } },
    ],
  },
  { path: '**', redirectTo: '' },
];
