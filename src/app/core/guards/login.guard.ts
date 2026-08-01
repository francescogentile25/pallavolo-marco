import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthStore } from '../../features/auth/store/auth.store';

export const loginGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return toObservable(authStore.initialized).pipe(
    filter(Boolean),
    take(1),
    map(() => (authStore.isAuthenticated() ? router.createUrlTree(['/']) : true)),
  );
};
