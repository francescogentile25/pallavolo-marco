import { Injectable, signal } from '@angular/core';
import { PageAction } from '../models/page-action.model';

@Injectable({ providedIn: 'root' })
export class PageActionsService {
  private readonly activeActions = signal<readonly PageAction[]>([]);

  readonly actions = this.activeActions.asReadonly();

  set(actions: readonly PageAction[]): void {
    this.activeActions.set(actions);
  }

  clear(): void {
    this.activeActions.set([]);
  }
}
