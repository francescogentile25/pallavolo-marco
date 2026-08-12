import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { UserProfile, UserRole } from '../../auth/models/auth.model';

@Component({
  selector: 'app-admin-user-card',
  imports: [FormsModule, Button, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="user-card" [class.pending]="!user().attivo">
      <div class="user-avatar" aria-hidden="true">{{ initials() }}</div>
      <div class="user-identity">
        <div class="name-line">
          <h3>{{ user().nome }} {{ user().cognome }}</h3>
          @if (isCurrentUser()) { <span class="you-badge">Tu</span> }
          <button type="button" class="edit-name" (click)="nameRequested.emit(user())" [disabled]="updatingId() !== null" aria-label="Modifica nome e cognome"><i class="pi pi-pencil" aria-hidden="true"></i></button>
        </div>
        <p>{{ user().email }}</p>
        <span class="status" [class.active]="user().attivo">
          <i
            class="pi"
            [class.pi-check-circle]="user().attivo"
            [class.pi-clock]="!user().attivo"
            aria-hidden="true"
          ></i>
          {{ user().attivo ? 'Attivo' : user().registration_completed_at ? 'In attesa' : 'Da completare' }}
        </span>
      </div>
      <div class="user-controls">
        <div class="field role-field">
          <label [for]="'role-' + user().id">Ruolo</label>
          <p-select
            [inputId]="'role-' + user().id"
            [options]="roleOptions()"
            optionLabel="label"
            optionValue="value"
            [ngModel]="user().ruolo"
            (ngModelChange)="requestRoleChange($event)"
            [disabled]="locked()"
          />
        </div>
        <p-button
          [label]="user().attivo ? 'Disattiva' : 'Attiva'"
          [icon]="user().attivo ? 'pi pi-ban' : 'pi pi-check'"
          [severity]="user().attivo ? 'danger' : 'success'"
          [outlined]="user().attivo"
          [loading]="updatingId() === user().id"
          [disabled]="locked() || (!user().attivo && !user().registration_completed_at)"
          (onClick)="activationRequested.emit(user())"
        />
      </div>
    </article>
  `,
  styles: `
    :host { display: block; }
    .user-card { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); box-shadow: 0 8px 22px rgb(7 29 38 / .045); }
    .user-card.pending { border-color: #f1c6b5; }
    .user-avatar { display: grid; width: 48px; height: 48px; place-items: center; color: var(--color-brand-strong); border-radius: var(--radius); background: var(--color-brand-soft); font-size: .78rem; font-weight: 900; }
    .user-identity { min-width: 0; }
    .name-line { display: flex; align-items: center; gap: 7px; }
    h3 { overflow: hidden; margin: 2px 0 3px; font-size: .98rem; text-overflow: ellipsis; white-space: nowrap; }
    .user-identity p { overflow: hidden; margin: 0 0 9px; color: var(--color-ink-muted); font-size: .72rem; text-overflow: ellipsis; white-space: nowrap; }
    .you-badge, .status { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; font-size: .65rem; font-weight: 800; }
    .you-badge { padding: 3px 6px; color: var(--color-brand-strong); background: var(--color-brand-soft); }
    .edit-name { display: grid; width: 26px; height: 26px; place-items: center; color: var(--color-ink-muted); border: 0; border-radius: var(--radius-sm); background: none; cursor: pointer; font-size: .72rem; }
    .edit-name:hover { color: var(--color-brand-strong); background: var(--color-surface-muted); }
    .status { padding: 4px 7px; color: var(--color-tournament); background: var(--color-tournament-soft); }
    .status.active { color: var(--color-success); background: var(--color-success-soft); }
    .user-controls { display: grid; grid-column: 1 / -1; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 10px; padding-top: 12px; border-top: 1px solid var(--color-border); }
    .field { display: grid; gap: 7px; }
    .field label { color: var(--color-ink); font-size: .75rem; font-weight: 800; }
    .role-field p-select { width: 100%; min-width: 0; }
    @media (min-width: 600px) { .user-card { grid-template-columns: auto minmax(180px, 1fr) minmax(320px, auto); align-items: center; } .user-controls { grid-column: auto; padding-top: 0; border-top: 0; } }
  `,
})
export class AdminUserCard {
  readonly user = input.required<UserProfile>();
  readonly currentUserId = input<string | null>(null);
  readonly updatingId = input<string | null>(null);
  readonly roleOptions = input.required<{ label: string; value: UserRole }[]>();
  readonly activationRequested = output<UserProfile>();
  readonly roleRequested = output<{ user: UserProfile; role: UserRole }>();
  readonly nameRequested = output<UserProfile>();
  protected readonly isCurrentUser = computed(() => this.user().id === this.currentUserId());
  protected readonly locked = computed(() => this.isCurrentUser() || this.updatingId() !== null);
  protected readonly initials = computed(() =>
    `${this.user().nome.charAt(0)}${this.user().cognome.charAt(0)}`.toUpperCase(),
  );

  protected requestRoleChange(role: UserRole): void {
    if (role !== this.user().ruolo && !this.locked()) {
      this.roleRequested.emit({ user: this.user(), role });
    }
  }
}
