import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/admin.guard';
import { authGuard } from '../../core/guards/auth.guard';
import { loginGuard } from '../../core/guards/login.guard';
import { organizerGuard } from '../../core/guards/organizer.guard';
import { onboardingGuard } from '../../core/guards/onboarding.guard';

export const layoutRoutes: Routes = [
  { path: 'login', canActivate: [loginGuard], loadComponent: () => import('../auth/login/login').then(c => c.Login) },
  { path: 'registrazione', canActivate: [loginGuard], loadComponent: () => import('../auth/register/register').then(c => c.Register) },
  { path: 'auth/callback', loadComponent: () => import('../auth/oauth-callback/oauth-callback').then(c => c.OauthCallback) },
  { path: 'completa-registrazione', canActivate: [onboardingGuard], loadComponent: () => import('../auth/complete-registration/complete-registration').then(c => c.CompleteRegistration) },
  {
    path: '', canActivate: [authGuard], loadComponent: () => import('./main/main').then(c => c.Main),
    children: [
      { path: 'app', loadComponent: () => import('../home/home').then(c => c.Home) },
      { path: 'partite', loadComponent: () => import('../matches/pages/matches-list').then(c => c.MatchesList) },
      { path: 'partite/nuova', loadComponent: () => import('../matches/pages/match-create').then(c => c.MatchCreate) },
      { path: 'partite/mie', loadComponent: () => import('../matches/pages/my-matches').then(c => c.MyMatches) },
      { path: 'partite/:id/modifica', loadComponent: () => import('../matches/pages/match-create').then(c => c.MatchCreate) },
      { path: 'partite/:id', loadComponent: () => import('../matches/pages/match-detail').then(c => c.MatchDetail) },
      { path: 'tornei/organizza', canActivate: [organizerGuard], loadComponent: () => import('../tournaments/pages/tournament-create').then(c => c.TournamentCreate) },
      { path: 'tornei/:id', loadComponent: () => import('../tournaments/pages/tournament-detail').then(c => c.TournamentDetail) },
      { path: 'tornei', loadComponent: () => import('../tournaments/pages/tournaments-list').then(c => c.TournamentsList) },
      { path: 'campi', loadComponent: () => import('../courts/pages/courts-page').then(c => c.CourtsPage) },
      { path: 'amici', loadComponent: () => import('../friends/pages/friends-page').then(c => c.FriendsPage) },
      { path: 'giocatori/:id', loadComponent: () => import('../friends/pages/friend-profile-page').then(c => c.FriendProfilePage) },
      { path: 'profilo', loadComponent: () => import('../profile/profile').then(c => c.Profile) },
      { path: 'admin/utenti', canActivate: [adminGuard], loadComponent: () => import('../admin-users/admin-users').then(c => c.AdminUsers) },
      { path: 'notifiche', loadComponent: () => import('../notifications/pages/notifications-page').then(c => c.NotificationsPage) },
    ],
  },
  { path: '**', redirectTo: '/' },
];
