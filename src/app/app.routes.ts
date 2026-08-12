import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/public/public-home').then(c => c.PublicHome),
  },
  {
    path: 'demo',
    pathMatch: 'full',
    redirectTo: 'demo/giocatore',
  },
  {
    path: 'demo/:ruolo',
    loadComponent: () => import('./features/demo/demo-page').then(c => c.DemoPage),
  },
  {
    path: 'demo/:ruolo/:sezione',
    loadComponent: () => import('./features/demo/demo-section-page').then(c => c.DemoSectionPage),
  },
  {
    path: '',
    loadChildren: () => import('./features/_layout/layout.routes')
      .then(r => r.layoutRoutes)
  },
  {
    path: '**',
    pathMatch: 'full',
    redirectTo: ''
  },
];
