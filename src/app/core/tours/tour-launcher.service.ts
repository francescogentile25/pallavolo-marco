import { Injectable, effect, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthStore } from '../../features/auth/store/auth.store';
import { buildAppTourSteps } from './app-tour.steps';
import { TourPersistenceService } from './tour-persistence.service';
import { TourService } from './tour.service';

export const FORCE_DEMO_TOUR_KEY = 'bvh:force-demo-tour';

@Injectable({ providedIn: 'root' })
export class TourLauncherService {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly tour = inject(TourService);
  private readonly persistence = inject(TourPersistenceService);
  private lastAutoKey = '';
  private checking = false;

  constructor() {
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(() => void this.considerAutoStart());
    effect(() => {
      this.auth.initialized();
      this.auth.isAuthenticated();
      this.auth.isDemo();
      this.auth.profile()?.ruolo;
      queueMicrotask(() => void this.considerAutoStart());
    });
  }

  async restart(): Promise<void> {
    const definition = this.currentDefinition();
    const userId = this.auth.authUser()?.id;
    await this.tour.runGuidedNavigation(() => this.router.navigateByUrl('/app?tour=1'));
    this.startCurrent();
    if (userId && !this.auth.isDemo()) void this.persistence.reset(definition, userId).catch(() => undefined);
  }

  private async considerAutoStart(): Promise<void> {
    if (!this.auth.initialized() || this.checking || this.tour.activeStep()) return;
    const path = this.router.url.split('?')[0];
    const force = new URLSearchParams(this.router.url.split('?')[1] ?? '').get('tour') === '1';

    if (path !== '/app' || !this.auth.isAuthenticated()) return;
    let demoForced = false;
    try {
      demoForced = sessionStorage.getItem(FORCE_DEMO_TOUR_KEY) === '1';
      if (demoForced) sessionStorage.removeItem(FORCE_DEMO_TOUR_KEY);
    } catch { /* storage non disponibile */ }
    const key = `app:${this.auth.authUser()?.id}:${this.auth.profile()?.ruolo}`;
    if (!force && !demoForced && this.lastAutoKey === key) return;
    this.lastAutoKey = key;

    if (force || this.auth.isDemo() || demoForced) {
      setTimeout(() => this.startCurrent(), 260);
      return;
    }

    const userId = this.auth.authUser()?.id;
    if (!userId) return;
    this.checking = true;
    try {
      if (!await this.persistence.hasSeen(this.currentDefinition(), userId)) setTimeout(() => this.startCurrent(), 260);
    } catch { /* Se Supabase non risponde, l'app resta utilizzabile senza mostrare errori. */ }
    finally { this.checking = false; }
  }

  private startCurrent(): void {
    if (this.tour.activeStep()) return;
    const role = this.auth.profile()?.ruolo === 'organizzatore' || this.auth.profile()?.ruolo === 'admin' ? 'organizzatore' : 'giocatore';
    const definition = this.persistence.definitionFor(role);
    const userId = this.auth.authUser()?.id;
    const markSeen = () => {
      if (userId && !this.auth.isDemo()) void this.persistence.markSeen(definition, userId).catch(() => undefined);
    };
    void this.tour.start(
      definition.id,
      buildAppTourSteps(role, this.router, this.tour, this.auth),
      { onComplete: markSeen, onSkip: markSeen, showProgress: true },
    );
  }

  private currentDefinition() {
    return this.persistence.definitionFor(this.auth.profile()?.ruolo);
  }
}
