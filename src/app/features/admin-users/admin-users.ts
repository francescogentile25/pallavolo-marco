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
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { PageActionsService } from '../../core/services/page-actions.service';
import { UserProfile, UserRole } from '../auth/models/auth.model';
import { AuthStore } from '../auth/store/auth.store';
import { filterAdminUsers } from './admin-users.utils';
import { AdminUserCard } from './components/admin-user-card';
import { AdminActiveFilter, AdminRoleFilter } from './models/admin-user.model';
import { AdminUsersStore } from './store/admin-users.store';

@Component({
  selector: 'app-admin-users',
  imports: [DatePipe, FormsModule, InputText, Select, AdminUserCard],
  providers: [AdminUsersStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="admin-page">
      <header class="admin-hero">
        <div>
          <p class="eyebrow">Amministrazione</p>
          <h1>Gestione utenti</h1>
          <p>Attiva i nuovi giocatori e assegna i ruoli senza accedere al database.</p>
        </div>
        <div class="stats" aria-label="Riepilogo utenti">
          <span><strong>{{ store.users().length }}</strong> totali</span>
          <span><strong>{{ pendingCount() }}</strong> da attivare</span>
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
                (input)="search.set(searchInput.value)"
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
              (ngModelChange)="activeFilter.set($event)"
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
              (ngModelChange)="roleFilter.set($event)"
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
            @for (user of filteredUsers(); track user.id) {
              <app-admin-user-card
                [user]="user"
                [currentUserId]="authStore.authUser()?.id ?? null"
                [updatingId]="store.updatingId()"
                [roleOptions]="roleOptions"
                (activationRequested)="confirmActivationChange($event)"
                (roleRequested)="confirmRoleChange($event.user, $event.role)"
              />
            } @empty {
              <div class="empty-state">
                <i class="pi pi-users" aria-hidden="true"></i>
                <h3>Nessun utente trovato</h3>
                <p>Modifica ricerca o filtri per ampliare i risultati.</p>
              </div>
            }
          </div>
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
    </main>
  `,
  styles: `
    :host { display: block; }
    .admin-page { width: min(100%, 1120px); padding: 18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 48px); margin: 0 auto; }
    .admin-hero { display: grid; gap: 20px; padding: 24px; color: white; border-radius: 28px; background: radial-gradient(circle at 90% 0, rgb(25 199 181 / .48), transparent 40%), linear-gradient(145deg, #071d26, #123945); box-shadow: 0 18px 38px rgb(7 29 38 / .18); }
    .eyebrow { margin: 0 0 6px; color: var(--color-brand); font-size: .68rem; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
    .admin-hero .eyebrow { color: #84efe3; }
    h1 { margin: 0; font: 900 clamp(2rem, 10vw, 4rem)/.95 var(--display-font); letter-spacing: -.045em; }
    .admin-hero > div > p:last-child { max-width: 600px; margin: 12px 0 0; color: rgb(255 255 255 / .72); line-height: 1.5; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .stats span { padding: 10px; border-radius: 14px; background: rgb(255 255 255 / .09); color: rgb(255 255 255 / .7); font-size: .65rem; text-align: center; }
    .stats strong { display: block; color: white; font-size: 1.35rem; }
    .filters, .audit-section { padding: 20px; margin-top: 14px; border: 1px solid var(--color-border); border-radius: 24px; background: var(--color-surface); }
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
    .page-error { display: flex; align-items: center; gap: 8px; padding: 12px 14px; color: var(--color-danger); border-radius: 14px; background: var(--color-danger-soft); }
    .users-section { margin-top: 14px; }
    .user-list { display: grid; gap: 10px; }
    .loading-state, .empty-state { display: grid; min-height: 240px; place-content: center; justify-items: center; gap: 10px; color: var(--color-ink-muted); text-align: center; }
    .empty-state { border: 1px dashed var(--color-border); border-radius: 22px; background: var(--color-surface); }
    .empty-state i { font-size: 2rem; }
    .empty-state h3, .empty-state p { margin: 0; }
    .spinner { width: 18px; height: 18px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }
    .audit-list { padding: 0; margin: 0; list-style: none; }
    .audit-list li { display: grid; grid-template-columns: auto 1fr; gap: 11px; padding: 12px 0; border-top: 1px solid var(--color-border); }
    .audit-list li:first-child { padding-top: 0; border-top: 0; }
    .audit-icon { display: grid; width: 36px; height: 36px; place-items: center; color: var(--color-brand-strong); border-radius: 12px; background: var(--color-brand-soft); }
    .audit-list p, .audit-list small { display: block; margin: 3px 0 0; color: var(--color-ink-muted); font-size: .72rem; line-height: 1.4; }
    .audit-list strong { font-size: .8rem; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (min-width: 600px) { .filter-grid { grid-template-columns: 2fr 1fr 1fr; } }
    @media (min-width: 768px) { .admin-page { padding: 34px 28px 120px; } .admin-hero { grid-template-columns: 1fr auto; align-items: end; padding: 32px; } .stats { min-width: 310px; } }
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
    { label: 'Giocatori', value: 'giocatore' },
    { label: 'Amministratori', value: 'admin' },
  ];
  protected readonly roleOptions: { label: string; value: UserRole }[] = [
    { label: 'Giocatore', value: 'giocatore' },
    { label: 'Amministratore', value: 'admin' },
  ];
  protected readonly filteredUsers = computed(() =>
    filterAdminUsers(this.store.users(), this.search(), this.activeFilter(), this.roleFilter()),
  );
  protected readonly pendingCount = computed(() => this.store.users().filter((user) => !user.attivo).length);
  protected readonly adminCount = computed(() => this.store.users().filter((user) => user.ruolo === 'admin').length);

  ngOnInit(): void {
    this.pageActions.set([{ id: 'refresh-users', label: 'Aggiorna utenti', shortLabel: 'Aggiorna', icon: 'pi-refresh', primary: true, click: () => void this.store.load() }]);
    void this.store.load();
  }

  ngOnDestroy(): void { this.pageActions.clear(); }

  protected userName(id: string): string { const user = this.store.users().find((item) => item.id === id); return user ? `${user.nome} ${user.cognome}` : 'Utente'; }
  protected auditDescription(previousActive: boolean, newActive: boolean, previousRole: UserRole, newRole: UserRole): string {
    const changes: string[] = [];
    if (previousActive !== newActive) changes.push(newActive ? 'profilo attivato' : 'profilo disattivato');
    if (previousRole !== newRole) changes.push(`ruolo cambiato da ${previousRole} a ${newRole}`);
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
      message: `Assegnare a ${user.nome} ${user.cognome} il ruolo ${role}?`,
      icon: 'pi pi-shield',
      acceptLabel: 'Conferma',
      rejectLabel: 'Annulla',
      rejectButtonProps: { severity: 'secondary', variant: 'text' },
      accept: () => void this.store.updateAccess({ profileId: user.id, attivo: user.attivo, ruolo: role }),
    });
  }
}
