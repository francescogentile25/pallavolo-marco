import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { Select } from 'primeng/select';
import { PageActionsService } from '../../core/services/page-actions.service';
import { UserProfile, UserRole } from '../auth/models/auth.model';
import { USER_ROLE_LABELS } from '../auth/auth.utils';
import { AuthStore } from '../auth/store/auth.store';
import { filterAdminUsers } from './admin-users.utils';
import { AdminUserCard } from './components/admin-user-card';
import { AdminActiveFilter, AdminRoleFilter } from './models/admin-user.model';
import { AdminUsersStore } from './store/admin-users.store';

@Component({
  selector: 'app-admin-users',
  imports: [DatePipe, FormsModule, Button, Dialog, InputText, Paginator, Select, AdminUserCard],
  providers: [AdminUsersStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="admin-page">
      <header class="admin-hero">
        <div>
          <p class="eyebrow">Amministrazione</p>
          <h1>Gestione utenti</h1>
          <p>Attiva i nuovi utenti e assegna ruoli e responsabilità senza accedere al database.</p>
        </div>
        <div class="stats" aria-label="Riepilogo utenti">
          <span><strong>{{ store.users().length }}</strong> totali</span>
          <span><strong>{{ pendingCount() }}</strong> da attivare</span>
          <span><strong>{{ organizerCount() }}</strong> organizzatori</span>
          <span><strong>{{ adminCount() }}</strong> admin</span>
        </div>
      </header>

      <section class="filters" aria-labelledby="filters-title">
        <div class="section-title">
          <div><p class="eyebrow">Directory</p><h2 id="filters-title">Cerca e filtra</h2></div>
          <span aria-live="polite">{{ filteredUsers().length }} risultati</span>
        </div>
        <div class="filter-grid">
          <div class="field search-field">
            <label for="admin-user-search">Nome o email</label>
            <span class="search-control">
              <i class="pi pi-search" aria-hidden="true"></i>
              <input
                #searchInput
                id="admin-user-search"
                pInputText
                type="search"
                autocomplete="off"
                placeholder="Cerca un utente"
                (input)="onSearch(searchInput.value)"
              />
            </span>
          </div>
          <div class="field">
            <label for="admin-active-filter">Stato</label>
            <p-select
              inputId="admin-active-filter"
              [options]="activeOptions"
              optionLabel="label"
              optionValue="value"
              [ngModel]="activeFilter()"
              (ngModelChange)="onActiveFilter($event)"
              fluid
            />
          </div>
          <div class="field">
            <label for="admin-role-filter">Ruolo</label>
            <p-select
              inputId="admin-role-filter"
              [options]="roleFilterOptions"
              optionLabel="label"
              optionValue="value"
              [ngModel]="roleFilter()"
              (ngModelChange)="onRoleFilter($event)"
              fluid
            />
          </div>
        </div>
      </section>

      @if (store.error()) {
        <p class="page-error" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i> {{ store.error() }}</p>
      }

      @if (store.loading() && !store.users().length) {
        <div class="loading-state" role="status"><span class="spinner"></span> Caricamento utenti</div>
      } @else {
        <section class="users-section" aria-labelledby="users-title">
          <h2 id="users-title" class="sr-only">Elenco utenti</h2>
          <div class="user-list">
            @for (user of pagedUsers(); track user.id) {
              <app-admin-user-card
                [user]="user"
                [currentUserId]="authStore.authUser()?.id ?? null"
                [updatingId]="store.updatingId()"
                [roleOptions]="roleOptions"
                (activationRequested)="confirmActivationChange($event)"
                (roleRequested)="confirmRoleChange($event.user, $event.role)"
                (nameRequested)="openNameEdit($event)"
              />
            } @empty {
              <div class="empty-state">
                <i class="pi pi-users" aria-hidden="true"></i>
                <h3>Nessun utente trovato</h3>
                <p>Modifica ricerca o filtri per ampliare i risultati.</p>
              </div>
            }
          </div>
          @if (filteredUsers().length > rows()) {
            <p-paginator
              styleClass="admin-paginator"
              [first]="first()"
              [rows]="rows()"
              [totalRecords]="filteredUsers().length"
              [rowsPerPageOptions]="[10, 20, 50]"
              [showCurrentPageReport]="true"
              currentPageReportTemplate="{first}-{last} di {totalRecords}"
              (onPageChange)="onPage($event)"
            />
          }
        </section>
      }

      @if (store.audit().length) {
        <section class="audit-section" aria-labelledby="audit-title">
          <div class="section-title">
            <div><p class="eyebrow">Sicurezza</p><h2 id="audit-title">Ultime modifiche</h2></div>
            <span>Audit in sola lettura</span>
          </div>
          <ol class="audit-list">
            @for (item of store.audit(); track item.id) {
              <li>
                <span class="audit-icon"><i class="pi pi-history" aria-hidden="true"></i></span>
                <div>
                  <strong>{{ userName(item.target_profile_id) }}</strong>
                  <p>{{ auditDescription(item.previous_active, item.new_active, item.previous_role, item.new_role) }}</p>
                  <small>{{ item.created_at | date: 'dd/MM/yyyy, HH:mm' }} · da {{ userName(item.actor_profile_id) }}</small>
                </div>
              </li>
            }
          </ol>
        </section>
      }

      <p-dialog [visible]="createOpen()" (visibleChange)="createOpen.set($event)" [modal]="true" [draggable]="false" header="Nuovo utente" [style]="{ width: '440px', maxWidth: '96vw' }">
        <div class="admin-form">
          <div class="af-field"><label for="nu-email">Email</label><input id="nu-email" pInputText type="email" autocomplete="off" [ngModel]="createForm().email" (ngModelChange)="setCreateField('email', $event)" /></div>
          <div class="af-field"><label for="nu-nome">Nome</label><input id="nu-nome" pInputText [ngModel]="createForm().nome" (ngModelChange)="setCreateField('nome', $event)" maxlength="80" /></div>
          <div class="af-field"><label for="nu-cognome">Cognome</label><input id="nu-cognome" pInputText [ngModel]="createForm().cognome" (ngModelChange)="setCreateField('cognome', $event)" maxlength="80" /></div>
          <div class="af-field"><label for="nu-pass">Password provvisoria</label><input id="nu-pass" pInputText type="text" autocomplete="off" [ngModel]="createForm().password" (ngModelChange)="setCreateField('password', $event)" /><small>Min 6 caratteri. Comunicala all'utente: potrà accedere subito.</small></div>
        </div>
        <div class="admin-form-actions">
          <p-button severity="secondary" [outlined]="true" label="Annulla" (onClick)="createOpen.set(false)" />
          <p-button label="Crea utente" icon="pi pi-check" [loading]="creating()" [disabled]="!createValid()" (onClick)="createUser()" />
        </div>
      </p-dialog>

      <p-dialog [visible]="nameDialogOpen()" (visibleChange)="nameDialogOpen.set($event)" [modal]="true" [draggable]="false" header="Modifica nome" [style]="{ width: '420px', maxWidth: '96vw' }">
        <div class="admin-form">
          <div class="af-field"><label for="en-nome">Nome</label><input id="en-nome" pInputText [ngModel]="nameForm().nome" (ngModelChange)="setNameField('nome', $event)" maxlength="80" /></div>
          <div class="af-field"><label for="en-cognome">Cognome</label><input id="en-cognome" pInputText [ngModel]="nameForm().cognome" (ngModelChange)="setNameField('cognome', $event)" maxlength="80" /></div>
        </div>
        <div class="admin-form-actions">
          <p-button severity="secondary" [outlined]="true" label="Annulla" (onClick)="nameDialogOpen.set(false)" />
          <p-button label="Salva" icon="pi pi-check" [loading]="store.updatingId() === nameTarget()?.id" [disabled]="!nameForm().nome.trim() || !nameForm().cognome.trim()" (onClick)="saveName()" />
        </div>
      </p-dialog>
    </main>
  `,
  styles: `
    :host { display: block; }
    .admin-page { width: min(100%, 1120px); padding: 18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 48px); margin: 0 auto; }
    .admin-hero { display: grid; gap: 20px; padding: 24px; color: white; border-radius: 8px; background: radial-gradient(circle at 90% 0, rgb(25 199 181 / .48), transparent 40%), linear-gradient(145deg, #0f1b23, #1d2b33); box-shadow: 0 18px 38px rgb(7 29 38 / .18); }
    .eyebrow { margin: 0 0 6px; color: var(--color-brand); font-size: .68rem; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
    .admin-hero .eyebrow { color: #a3b3fb; }
    h1 { margin: 0; font: 900 clamp(2rem, 10vw, 4rem)/.95 var(--display-font); letter-spacing: -.045em; }
    .admin-hero > div > p:last-child { max-width: 600px; margin: 12px 0 0; color: rgb(255 255 255 / .72); line-height: 1.5; }
    .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .stats span { padding: 10px; border-radius: var(--radius); background: rgb(255 255 255 / .09); color: rgb(255 255 255 / .7); font-size: .65rem; text-align: center; }
    .stats strong { display: block; color: white; font-size: 1.35rem; }
    .filters, .audit-section { padding: 20px; margin-top: 14px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); }
    .section-title { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
    .section-title h2 { margin: 0; font: 900 1.5rem/1 var(--display-font); letter-spacing: -.03em; }
    .section-title > span { color: var(--color-ink-muted); font-size: .72rem; }
    .filter-grid { display: grid; gap: 14px; }
    .field { display: grid; gap: 7px; }
    .field label { color: var(--color-ink); font-size: .75rem; font-weight: 800; }
    .search-control { position: relative; display: block; }
    .search-control i { position: absolute; z-index: 1; top: 50%; left: 15px; color: var(--color-ink-muted); transform: translateY(-50%); }
    .search-control input { width: 100%; min-height: 48px; padding-left: 42px; }
    .filter-grid p-select { min-height: 48px; }
    .page-error { display: flex; align-items: center; gap: 8px; padding: 12px 14px; color: var(--color-danger); border-radius: var(--radius); background: var(--color-danger-soft); }
    .users-section { margin-top: 14px; }
    .user-list { display: grid; gap: 10px; }
    p-paginator { display: block; margin-top: 12px; }
    :host ::ng-deep .admin-paginator,
    :host ::ng-deep .admin-paginator .p-paginator { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 2px; padding: 4px; background: transparent; border: 0; }
    :host ::ng-deep .admin-paginator .p-paginator-current { color: var(--color-ink-muted); font-size: .75rem; }
    .loading-state, .empty-state { display: grid; min-height: 240px; place-content: center; justify-items: center; gap: 10px; color: var(--color-ink-muted); text-align: center; }
    .empty-state { border: 1px dashed var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); }
    .empty-state i { font-size: 2rem; }
    .empty-state h3, .empty-state p { margin: 0; }
    .spinner { width: 18px; height: 18px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }
    .audit-list { padding: 0; margin: 0; list-style: none; }
    .audit-list li { display: grid; grid-template-columns: auto 1fr; gap: 11px; padding: 12px 0; border-top: 1px solid var(--color-border); }
    .audit-list li:first-child { padding-top: 0; border-top: 0; }
    .audit-icon { display: grid; width: 36px; height: 36px; place-items: center; color: var(--color-brand-strong); border-radius: var(--radius); background: var(--color-brand-soft); }
    .audit-list p, .audit-list small { display: block; margin: 3px 0 0; color: var(--color-ink-muted); font-size: .72rem; line-height: 1.4; }
    .audit-list strong { font-size: .8rem; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
    .admin-form { display: grid; gap: 12px; }
    .af-field { display: grid; gap: 6px; }
    .af-field label { font-size: .76rem; font-weight: 800; }
    .af-field input { width: 100%; min-height: 46px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); }
    .af-field small { color: var(--color-ink-muted); font-size: .68rem; }
    .admin-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (min-width: 600px) { .filter-grid { grid-template-columns: 2fr 1fr 1fr; } }
    @media (min-width: 768px) { .admin-page { padding: 34px 28px 120px; } .admin-hero { grid-template-columns: 1fr auto; align-items: end; padding: 32px; } .stats { min-width: 420px; grid-template-columns: repeat(4, 1fr); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
  `,
})
export class AdminUsers implements OnInit, OnDestroy {
  protected readonly store = inject(AdminUsersStore);
  protected readonly authStore = inject(AuthStore);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly pageActions = inject(PageActionsService);
  protected readonly search = signal('');
  protected readonly activeFilter = signal<AdminActiveFilter>('tutti');
  protected readonly roleFilter = signal<AdminRoleFilter>('tutti');
  protected readonly activeOptions: { label: string; value: AdminActiveFilter }[] = [
    { label: 'Tutti', value: 'tutti' },
    { label: 'Attivi', value: 'attivi' },
    { label: 'In attesa', value: 'in_attesa' },
  ];
  protected readonly roleFilterOptions: { label: string; value: AdminRoleFilter }[] = [
    { label: 'Tutti', value: 'tutti' },
    { label: 'Utenti comuni', value: 'giocatore' },
    { label: 'Organizzatori', value: 'organizzatore' },
    { label: 'Amministratori', value: 'admin' },
  ];
  protected readonly roleOptions: { label: string; value: UserRole }[] = [
    { label: 'Utente comune', value: 'giocatore' },
    { label: 'Organizzatore', value: 'organizzatore' },
    { label: 'Amministratore', value: 'admin' },
  ];
  protected readonly filteredUsers = computed(() =>
    filterAdminUsers(this.store.users(), this.search(), this.activeFilter(), this.roleFilter()),
  );
  protected readonly first = signal(0);
  protected readonly rows = signal(10);
  protected readonly createOpen = signal(false);
  protected readonly creating = signal(false);
  protected readonly createForm = signal<{ email: string; nome: string; cognome: string; password: string }>({ email: '', nome: '', cognome: '', password: '' });
  protected readonly nameDialogOpen = signal(false);
  protected readonly nameTarget = signal<UserProfile | null>(null);
  protected readonly nameForm = signal<{ nome: string; cognome: string }>({ nome: '', cognome: '' });
  protected readonly pagedUsers = computed(() => {
    const list = this.filteredUsers();
    const start = this.first() < list.length ? this.first() : 0;
    return list.slice(start, start + this.rows());
  });
  protected readonly pendingCount = computed(() => this.store.users().filter((user) => !user.attivo).length);
  protected readonly organizerCount = computed(() => this.store.users().filter((user) => user.ruolo === 'organizzatore').length);
  protected readonly adminCount = computed(() => this.store.users().filter((user) => user.ruolo === 'admin').length);

  ngOnInit(): void {
    this.pageActions.set([
      { id: 'new-user', label: 'Nuovo utente', shortLabel: 'Nuovo', icon: 'pi-user-plus', primary: true, click: () => this.openCreate() },
      { id: 'refresh-users', label: 'Aggiorna utenti', shortLabel: 'Aggiorna', icon: 'pi-refresh', click: () => void this.store.load() },
    ]);
    void this.store.load();
  }

  ngOnDestroy(): void { this.pageActions.clear(); }

  protected onPage(event: PaginatorState): void {
    this.first.set(event.first ?? 0);
    this.rows.set(event.rows ?? this.rows());
  }
  protected onSearch(value: string): void { this.search.set(value); this.first.set(0); }
  protected onActiveFilter(value: AdminActiveFilter): void { this.activeFilter.set(value); this.first.set(0); }
  protected onRoleFilter(value: AdminRoleFilter): void { this.roleFilter.set(value); this.first.set(0); }

  protected openCreate(): void { this.createForm.set({ email: '', nome: '', cognome: '', password: '' }); this.createOpen.set(true); }
  protected setCreateField<K extends 'email' | 'nome' | 'cognome' | 'password'>(key: K, value: string): void { this.createForm.update((f) => ({ ...f, [key]: value })); }
  protected createValid(): boolean { const f = this.createForm(); return /.+@.+\..+/.test(f.email) && !!f.nome.trim() && !!f.cognome.trim() && f.password.length >= 6; }
  protected async createUser(): Promise<void> {
    if (!this.createValid() || this.creating()) return;
    this.creating.set(true);
    const f = this.createForm();
    const ok = await this.store.createUser({ email: f.email.trim(), nome: f.nome.trim(), cognome: f.cognome.trim(), password: f.password });
    this.creating.set(false);
    if (ok) this.createOpen.set(false);
  }
  protected openNameEdit(user: UserProfile): void { this.nameTarget.set(user); this.nameForm.set({ nome: user.nome, cognome: user.cognome }); this.nameDialogOpen.set(true); }
  protected setNameField<K extends 'nome' | 'cognome'>(key: K, value: string): void { this.nameForm.update((f) => ({ ...f, [key]: value })); }
  protected async saveName(): Promise<void> {
    const target = this.nameTarget();
    const f = this.nameForm();
    if (!target || !f.nome.trim() || !f.cognome.trim()) return;
    const ok = await this.store.updateName(target.id, f.nome.trim(), f.cognome.trim());
    if (ok) this.nameDialogOpen.set(false);
  }

  protected userName(id: string): string { const user = this.store.users().find((item) => item.id === id); return user ? `${user.nome} ${user.cognome}` : 'Utente'; }
  protected auditDescription(previousActive: boolean, newActive: boolean, previousRole: UserRole, newRole: UserRole): string {
    const changes: string[] = [];
    if (previousActive !== newActive) changes.push(newActive ? 'profilo attivato' : 'profilo disattivato');
    if (previousRole !== newRole) changes.push(`ruolo cambiato da ${USER_ROLE_LABELS[previousRole]} a ${USER_ROLE_LABELS[newRole]}`);
    return changes.join('; ');
  }

  protected confirmActivationChange(user: UserProfile): void {
    const activate = !user.attivo;
    this.confirmationService.confirm({
      header: activate ? 'Attiva utente' : 'Disattiva utente',
      message: activate
        ? `Consentire a ${user.nome} ${user.cognome} di accedere all'app?`
        : `${user.nome} ${user.cognome} verrà disconnesso al prossimo controllo della sessione.`,
      icon: activate ? 'pi pi-check-circle' : 'pi pi-exclamation-triangle',
      acceptLabel: activate ? 'Attiva' : 'Disattiva',
      rejectLabel: 'Annulla',
      acceptButtonProps: { severity: activate ? 'success' : 'danger' },
      rejectButtonProps: { severity: 'secondary', variant: 'text' },
      accept: () => void this.store.updateAccess({ profileId: user.id, attivo: activate, ruolo: user.ruolo }),
    });
  }

  protected confirmRoleChange(user: UserProfile, role: UserRole): void {
    if (role === user.ruolo) return;
    this.confirmationService.confirm({
      header: 'Cambia ruolo',
      message: `Assegnare a ${user.nome} ${user.cognome} il ruolo ${USER_ROLE_LABELS[role]}?`,
      icon: 'pi pi-shield',
      acceptLabel: 'Conferma',
      rejectLabel: 'Annulla',
      rejectButtonProps: { severity: 'secondary', variant: 'text' },
      accept: () => void this.store.updateAccess({ profileId: user.id, attivo: user.attivo, ruolo: role }),
    });
  }
}
