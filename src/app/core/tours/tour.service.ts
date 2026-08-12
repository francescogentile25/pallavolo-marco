import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ActiveTourStep, TourStartOptions, TourStep } from './tour.model';

@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly steps = signal<readonly TourStep[]>([]);
  private options: TourStartOptions = {};
  private tourId = '';
  private activation = 0;
  private guidedNavigations = 0;

  readonly activeStep = signal<ActiveTourStep | null>(null);

  constructor() {
    const navigationSubscription = this.router.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
      .subscribe(() => {
        if (this.activeStep() && this.guidedNavigations === 0) this.cancel();
      });
    const refresh = () => this.refreshTarget();
    window.addEventListener('resize', refresh, { passive: true });
    window.addEventListener('scroll', refresh, { passive: true, capture: true });
    this.destroyRef.onDestroy(() => {
      navigationSubscription.unsubscribe();
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    });
  }

  async start(tourId: string, steps: readonly TourStep[], options: TourStartOptions = {}): Promise<void> {
    if (!steps.length) return;
    this.activation += 1;
    this.tourId = tourId;
    this.steps.set(steps);
    this.options = options;
    await this.activate(0);
  }

  async next(): Promise<void> {
    const current = this.activeStep();
    if (!current) return;
    if (current.index === current.total - 1) {
      this.finish(false);
      return;
    }
    await this.activate(current.index + 1);
  }

  async back(): Promise<void> {
    const current = this.activeStep();
    if (!current || current.index === 0) return;
    await this.activate(current.index - 1);
  }

  cancel(): void {
    if (!this.activeStep()) return;
    this.finish(true);
  }

  async runGuidedNavigation<T>(action: () => Promise<T>): Promise<T> {
    this.guidedNavigations += 1;
    try {
      return await action();
    } finally {
      this.guidedNavigations = Math.max(0, this.guidedNavigations - 1);
    }
  }

  private async activate(index: number): Promise<void> {
    const step = this.steps()[index];
    if (!step) return;
    const activation = ++this.activation;
    this.activeStep.set(null);
    await step.beforeHighlight?.();
    if (activation !== this.activation) return;
    const target = step.element ? await this.waitForVisibleElement(step.element) : null;
    if (activation !== this.activation) return;
    target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    if (target) await new Promise<void>((resolve) => setTimeout(resolve, 180));
    this.activeStep.set({
      tourId: this.tourId,
      step,
      index,
      total: this.steps().length,
      targetRect: target?.getBoundingClientRect() ?? null,
      showProgress: this.options.showProgress ?? true,
    });
  }

  private async waitForVisibleElement(selector: string): Promise<HTMLElement | null> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 3500) {
      const target = this.findVisibleElement(selector);
      if (target) return target;
      await new Promise<void>((resolve) => setTimeout(resolve, 60));
    }
    return null;
  }

  private findVisibleElement(selector: string): HTMLElement | null {
    return [...this.document.querySelectorAll<HTMLElement>(selector)].find((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }) ?? null;
  }

  private refreshTarget(): void {
    const current = this.activeStep();
    if (!current?.step.element) return;
    const target = this.findVisibleElement(current.step.element);
    this.activeStep.set({ ...current, targetRect: target?.getBoundingClientRect() ?? null });
  }

  private finish(skipped: boolean): void {
    this.activation += 1;
    this.activeStep.set(null);
    const callback = skipped ? this.options.onSkip : this.options.onComplete;
    this.steps.set([]);
    this.options = {};
    callback?.();
  }
}
