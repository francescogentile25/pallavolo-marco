import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { loginGuard } from '../../core/guards/login.guard';

export const layoutRoutes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () => import('../auth/login/login').then((component) => component.Login),
  },
  {
    path: 'registrazione',
    canActivate: [loginGuard],
    loadComponent: () => import('../auth/register/register').then((component) => component.Register),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./main/main').then((component) => component.Main),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('../home/home').then((component) => component.Home),
      },
      {
        path: 'partite',
        loadComponent: () =>
          import('../coming-soon/coming-soon').then((component) => component.ComingSoon),
        data: {
          title: 'Trova una partita',
          description: 'Qui arriveranno ricerca, filtri per livello e disponibilità dei posti.',
          icon: 'pi-users',
        },
      },
      {
        path: 'partite/nuova',
        loadComponent: () =>
          import('../coming-soon/coming-soon').then((component) => component.ComingSoon),
        data: {
          title: 'Crea una partita',
          description: 'Il flusso raccoglierà luogo, data, ora, genere e livello richiesto.',
          icon: 'pi-plus',
        },
      },
      {
        path: 'tornei',
        loadComponent: () =>
          import('../coming-soon/coming-soon').then((component) => component.ComingSoon),
        data: {
          title: 'Tornei',
          description: 'Iscrizioni, tabelloni e gestione delle fasi torneo saranno raccolti qui.',
          icon: 'pi-trophy',
        },
      },
      {
        path: 'profilo',
        loadComponent: () =>
          import('../coming-soon/coming-soon').then((component) => component.ComingSoon),
        data: {
          title: 'Il tuo profilo',
          description: 'Livello, andamento delle valutazioni e affidabilità avranno una vista dedicata.',
          icon: 'pi-user',
        },
      },
      {
        path: 'notifiche',
        loadComponent: () =>
          import('../coming-soon/coming-soon').then((component) => component.ComingSoon),
        data: {
          title: 'Notifiche',
          description: 'Inviti, cambi partita e aggiornamenti torneo saranno disponibili qui.',
          icon: 'pi-bell',
        },
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
