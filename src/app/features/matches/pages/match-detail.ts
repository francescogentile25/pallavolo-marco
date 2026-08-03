import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ConfirmationService } from 'primeng/api';
import { Button, ButtonModule } from 'primeng/button';
import { PageActionsService } from '../../../core/services/page-actions.service';
import { AuthStore } from '../../auth/store/auth.store';
import { ChatDialog } from '../../chat/components/chat-dialog';
import { MatchFeedbackCard } from '../components/match-feedback-card';
import { availableSpots, isUserJoined, levelRangeLabel, MATCH_GENDER_LABELS, MATCH_STATUS_LABELS } from '../matches.utils';
import { MatchesService } from '../services/matches.service';
import { MatchesStore } from '../store/matches.store';

@Component({
  selector: 'app-match-detail',
  imports: [Button, ButtonModule, DatePipe, RouterLink, MatchFeedbackCard, ChatDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="detail-page">
      <a class="back-link" routerLink="/partite"><i class="pi pi-arrow-left" aria-hidden="true"></i> Tutte le partite</a>
      @if (store.loading() && !store.selected()) {
        <div class="state" role="status"><span class="spinner"></span> Caricamento partita…</div>
      } @else if (store.selected(); as match) {
        <header class="match-hero">
          <div class="hero-top"><span [class]="'status status-' + match.status">{{ statusLabels[match.status] }}</span><span>{{ spots() }} posti liberi</span></div>
          <p class="eyebrow">{{ genderLabels[match.gender] }} · {{ levelRange(match) }}</p>
          <h1>{{ match.court.venue.name }}</h1>
          <p>{{ match.court.name }} · {{ match.court.venue.city }}</p>
          <div class="date-block"><span>{{ match.starts_at | date: 'dd' }}</span><div><strong>{{ match.starts_at | date: 'EEEE MMMM' : undefined : 'it-IT' }}</strong><small>{{ match.starts_at | date: 'HH:mm' }} · {{ match.duration_minutes }} minuti</small></div></div>
        </header>

        @if (joined() || match.creator_id === authStore.authUser()?.id) {
          <button type="button" class="chat-open" (click)="chatOpen.set(true)"><i class="pi pi-comments" aria-hidden="true"></i> Chat della partita</button>
          <app-chat-dialog [open]="chatOpen()" (openChange)="chatOpen.set($event)" resourceType="match" [resourceId]="match.id" [title]="'Chat · ' + match.court.venue.name" />
        }

        <div class="detail-grid">
          <section class="card" aria-labelledby="participants-title">
            <div class="section-heading"><div><p class="eyebrow">Squadra</p><h2 id="participants-title">Partecipanti</h2></div><strong>{{ match.participantDetails.length }}/{{ match.capacity }}</strong></div>
            <div class="participants">
              @for (participant of match.participantDetails; track participant.profile_id) {
                <article class="participant">
                  <div class="avatar">@if (participant.avatar_url) { <img [src]="participant.avatar_url" alt="" /> } @else { <span aria-hidden="true">{{ participant.nome.charAt(0) }}{{ participant.cognome.charAt(0) }}</span> }</div>
                  <div><strong>{{ participant.nome }} {{ participant.cognome }}</strong><small>Livello {{ participant.livello }} @if (participant.is_creator) { · Organizzatore }</small></div>
                  @if (participant.is_creator) { <i class="pi pi-star-fill" title="Organizzatore"></i> }
                </article>
              }
              @for (slot of emptySlots(); track slot) { <div class="empty-slot"><i class="pi pi-plus" aria-hidden="true"></i><span>Posto disponibile</span></div> }
            </div>
          </section>

          <section class="card info-card" aria-labelledby="info-title">
            <div class="section-heading"><div><p class="eyebrow">Dettagli</p><h2 id="info-title">Informazioni</h2></div></div>
            <dl><div><dt><i class="pi pi-map-marker"></i> Indirizzo</dt><dd>{{ match.court.venue.address }}, {{ match.court.venue.city }}</dd></div><div><dt><i class="pi pi-users"></i> Formula</dt><dd>{{ genderLabels[match.gender] }}, {{ match.capacity }} giocatori</dd></div><div><dt><i class="pi pi-chart-line"></i> Livello</dt><dd>{{ levelRange(match) }}</dd></div><div><dt><i class="pi pi-sun"></i> Campo</dt><dd>{{ match.court.surface }} · {{ match.court.indoor ? 'Coperto' : 'All’aperto' }}</dd></div></dl>
            @if (match.notes) { <div class="notes"><strong>Note dell’organizzatore</strong><p>{{ match.notes }}</p></div> }
          </section>
        </div>

        @if (match.status === 'completed' && joined()) {
          <section class="card feedback-card" aria-labelledby="feedback-title">
            <div class="section-heading"><div><p class="eyebrow">Post-partita</p><h2 id="feedback-title">Valutazioni e presenze</h2></div></div>
            <p class="feedback-help">Valuta il livello dei giocatori presenti. Il voto è definitivo e resta disponibile per 7 giorni dalla chiusura.</p>
            <div class="feedback-grid">@for (participant of feedbackParticipants(); track participant.profile_id) {
              <app-match-feedback-card [participant]="participant" [busy]="store.feedbackProfileId() === participant.profile_id" [canReportNoShow]="canReportNoShow(participant.profile_id)" (rating)="rate(participant.profile_id, $event)" (noShow)="reportNoShow(participant.profile_id, $event)" />
            } @empty { <p class="feedback-help">Non ci sono altri partecipanti da valutare.</p> }</div>
          </section>
        }

        <section class="mobile-cta" aria-label="Azione principale">
          @if (canEdit()) { <a pButton fluid [routerLink]="['/partite', match.id, 'modifica']"><i class="pi pi-pencil" pButtonIcon></i><span pButtonLabel>Modifica partita</span></a> }
          @if (canJoin()) { <p-button fluid label="Iscriviti · " [loading]="busy()" icon="pi pi-user-plus" (onClick)="join()"><ng-template #content>Iscriviti · {{ spots() }} posti</ng-template></p-button> }
          @if (canWithdraw()) { <p-button fluid severity="secondary" label="Ritirati dalla partita" [loading]="busy()" icon="pi pi-user-minus" (onClick)="withdraw()" /> }
          @if (canCancel()) { <p-button fluid severity="danger" [outlined]="true" label="Annulla partita" [loading]="busy()" icon="pi pi-times" (onClick)="cancel()" /> }
          @if (canClose()) { <p-button fluid label="Concludi partita" [loading]="busy()" icon="pi pi-flag-fill" (onClick)="close()" /> }
        </section>
      } @else {
        <div class="state error" role="alert"><i class="pi pi-exclamation-circle"></i><h1>Partita non trovata</h1><p>{{ store.error() }}</p><a routerLink="/partite">Torna alla ricerca</a></div>
      }
    </main>
  `,
  styles: `
    .chat-open { display: inline-flex; align-items: center; gap: 8px; margin-top: 12px; padding: 10px 16px; color: var(--color-brand-strong); border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); font: inherit; font-size: .8rem; font-weight: 750; cursor: pointer; }
    .chat-open:hover { background: var(--color-surface-muted); }
    .feedback-card { margin-top: 14px; }.feedback-help { margin: -6px 0 16px; color: var(--color-ink-muted); font-size: .76rem; line-height: 1.5; }.feedback-grid { display: grid; gap: 10px; }
    :host { display: block; }.detail-page { width: min(100%, 1040px); padding: 18px 16px calc(var(--bottom-nav-height) + var(--bottom-actions-height) + 80px); margin: 0 auto; }.back-link { display: inline-flex; min-height: 44px; align-items: center; gap: 8px; color: var(--color-brand-strong); font-size: .78rem; font-weight: 850; text-decoration: none; }.match-hero { padding: 22px; color: white; border-radius: 28px; background: radial-gradient(circle at 90% 0, rgb(25 199 181 / .55), transparent 42%), linear-gradient(145deg, #071d26, #123945); box-shadow: 0 18px 38px rgb(7 29 38 / .16); }.hero-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 34px; font-size: .72rem; font-weight: 850; }.status { padding: 5px 8px; border-radius: 9px; color: var(--color-brand-strong); background: #dffffa; text-transform: uppercase; }.status-full,.status-cancelled { color: var(--color-danger); background: var(--color-danger-soft); }.eyebrow { margin: 0 0 6px; color: var(--color-brand); font-size: .68rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }.match-hero .eyebrow { color: #84efe3; }.match-hero h1 { margin: 0 0 5px; font: 900 clamp(2rem, 10vw, 4.3rem)/.95 var(--display-font); letter-spacing: -.05em; }.match-hero > p:not(.eyebrow) { margin: 0; color: rgb(255 255 255 / .7); }.date-block { display: flex; align-items: center; gap: 12px; padding-top: 18px; margin-top: 20px; border-top: 1px solid rgb(255 255 255 / .15); text-transform: capitalize; }.date-block > span { font: 900 2.5rem/1 var(--display-font); }.date-block div { display: grid; gap: 3px; }.date-block small { color: rgb(255 255 255 / .68); }.detail-grid { display: grid; gap: 14px; margin-top: 14px; }.card { padding: 20px; border: 1px solid var(--color-border); border-radius: 24px; background: var(--color-surface); }.section-heading { display: flex; align-items: end; justify-content: space-between; margin-bottom: 16px; }.section-heading h2 { margin: 0; font: 900 1.45rem/1 var(--display-font); }.section-heading > strong { color: var(--color-brand-strong); }.participants { display: grid; gap: 8px; }.participant,.empty-slot { display: flex; min-height: 58px; align-items: center; gap: 11px; padding: 8px; border-radius: 16px; background: var(--color-surface-muted); }.avatar { display: grid; width: 42px; height: 42px; flex: 0 0 42px; place-items: center; overflow: hidden; border-radius: 14px; color: white; background: var(--color-brand-strong); font-size: .7rem; font-weight: 900; }.avatar img { width: 100%; height: 100%; object-fit: cover; }.participant > div:nth-child(2) { display: grid; min-width: 0; }.participant small { color: var(--color-ink-muted); font-size: .68rem; }.participant > i { margin-left: auto; color: var(--color-tournament); }.empty-slot { color: var(--color-ink-muted); border: 1px dashed var(--color-border); background: transparent; font-size: .75rem; }.empty-slot i { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 14px; background: var(--color-surface-muted); }.info-card dl { display: grid; gap: 15px; margin: 0; }.info-card dl div { display: grid; gap: 4px; }.info-card dt { color: var(--color-ink-muted); font-size: .68rem; font-weight: 800; }.info-card dt i { width: 20px; color: var(--color-brand-strong); }.info-card dd { margin: 0 0 0 24px; font-size: .82rem; font-weight: 750; }.notes { padding: 14px; margin-top: 18px; border-radius: 15px; background: var(--color-brand-soft); }.notes strong { font-size: .72rem; }.notes p { margin: 6px 0 0; font-size: .78rem; line-height: 1.5; white-space: pre-wrap; }.mobile-cta { display: grid; gap: 8px; padding-top: 14px; }.mobile-cta a[pButton] { justify-content: center; text-decoration: none; }.state { display: grid; min-height: 60dvh; place-content: center; justify-items: center; gap: 10px; color: var(--color-ink-muted); text-align: center; }.spinner { width: 20px; height: 20px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }@keyframes spin { to { transform: rotate(360deg); } }a:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 2px; }@media (min-width: 768px) { .detail-page { padding: 34px 28px 120px; }.match-hero { padding: 34px; }.detail-grid { grid-template-columns: minmax(0, 1.2fr) minmax(280px, .8fr); }.mobile-cta { display: none; } }
  `,
})
export class MatchDetail implements OnInit, OnDestroy {
  protected readonly store = inject(MatchesStore); protected readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute); private readonly actions = inject(PageActionsService); private readonly service = inject(MatchesService); private readonly confirmationService = inject(ConfirmationService);
  private readonly matchId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly chatOpen = signal(false);
  protected readonly statusLabels = MATCH_STATUS_LABELS; protected readonly genderLabels = MATCH_GENDER_LABELS; protected readonly levelRange = levelRangeLabel;
  protected readonly spots = computed(() => this.store.selected() ? availableSpots(this.store.selected()!) : 0);
  protected readonly emptySlots = computed(() => Array.from({ length: Math.min(this.spots(), 4) }, (_, index) => index));
  protected readonly busy = computed(() => this.store.actionMatchId() === this.matchId);
  protected readonly joined = computed(() => !!this.store.selected() && isUserJoined(this.store.selected()!, this.authStore.authUser()?.id));
  protected readonly canJoin = computed(() => this.store.selected()?.status === 'open' && this.spots() > 0 && !this.joined());
  protected readonly canWithdraw = computed(() => { const m = this.store.selected(); return !!m && m.creator_id !== this.authStore.authUser()?.id && ['open','full'].includes(m.status) && this.joined(); });
  protected readonly canEdit = computed(() => { const m = this.store.selected(); return !!m && m.creator_id === this.authStore.authUser()?.id && ['open','full'].includes(m.status) && new Date(m.starts_at).getTime() > Date.now(); });
  protected readonly canCancel = computed(() => { const m = this.store.selected(); return !!m && m.creator_id === this.authStore.authUser()?.id && ['draft','open','full'].includes(m.status); });
  protected readonly canClose = computed(() => { const m = this.store.selected(); return !!m && m.creator_id === this.authStore.authUser()?.id && ['open','full','in_progress'].includes(m.status) && Date.now() >= new Date(m.starts_at).getTime() + m.duration_minutes * 60000; });
  protected readonly feedbackParticipants = computed(() => this.store.selected()?.participantDetails.filter(p => p.profile_id !== this.authStore.authUser()?.id) ?? []);
  private channel?: RealtimeChannel; private refreshTimer?: ReturnType<typeof setTimeout>;
  constructor() { effect(() => { if (this.canJoin()) this.actions.set([{ id:'join-match', label:'Iscriviti alla partita', shortLabel:'Iscriviti', icon:'pi-user-plus', primary:true, click:()=>void this.join() }]); else if (this.canWithdraw()) this.actions.set([{ id:'withdraw-match', label:'Ritirati dalla partita', shortLabel:'Ritirati', icon:'pi-user-minus', danger:true, click:()=>void this.withdraw() }]); else if (this.canEdit()) this.actions.set([{ id:'edit-match', label:'Modifica partita', shortLabel:'Modifica', icon:'pi-pencil', primary:true, routerLink:`/partite/${this.matchId}/modifica` },{ id:'cancel-match', label:'Annulla partita', shortLabel:'Annulla', icon:'pi-times', danger:true, click:()=>void this.cancel() }]); else if (this.canCancel()) this.actions.set([{ id:'cancel-match', label:'Annulla partita', shortLabel:'Annulla', icon:'pi-times', danger:true, click:()=>void this.cancel() }]); else if (this.canClose()) this.actions.set([{ id:'close-match', label:'Concludi partita', shortLabel:'Concludi', icon:'pi-flag-fill', primary:true, click:()=>void this.close() }]); else this.actions.clear(); }); }
  ngOnInit(): void { void this.store.loadMatch(this.matchId); this.channel = this.service.subscribeToMatchChanges(() => this.scheduleRefresh()); }
  ngOnDestroy(): void { this.actions.clear(); this.store.clearSelected(); if (this.channel) this.service.removeChannel(this.channel); if (this.refreshTimer) clearTimeout(this.refreshTimer); }
  protected async join(): Promise<void> { await this.store.join(this.matchId); }
  protected withdraw(): void { this.confirmationService.confirm({ header: 'Libera il posto?', message: 'La tua iscrizione verrà rimossa e il posto tornerà disponibile.', icon: 'pi pi-user-minus', acceptLabel: 'Libera posto', rejectLabel: 'Resta iscritto', acceptButtonProps: { severity: 'danger' }, rejectButtonProps: { severity: 'secondary', variant: 'text' }, accept: () => void this.store.withdraw(this.matchId) }); }
  protected cancel(): void { this.confirmationService.confirm({ header: 'Annulla partita?', message: 'La partita verrà annullata per tutti i partecipanti. Questa azione non può essere annullata.', icon: 'pi pi-exclamation-triangle', acceptLabel: 'Annulla partita', rejectLabel: 'Mantieni partita', acceptButtonProps: { severity: 'danger' }, rejectButtonProps: { severity: 'secondary', variant: 'text' }, accept: () => void this.store.cancel(this.matchId) }); }
  protected close(): void { this.confirmationService.confirm({ header: 'Concludi partita?', message: 'Conferma che la partita è terminata. Si aprirà la fase delle valutazioni.', icon: 'pi pi-flag-fill', acceptLabel: 'Concludi', rejectLabel: 'Non ancora', rejectButtonProps: { severity: 'secondary', variant: 'text' }, accept: () => void this.store.close(this.matchId) }); }
  protected rate(profileId: string, score: number): void { this.confirmationService.confirm({ header: 'Invia valutazione?', message: `Stai assegnando ${score}/7. Dopo l’invio la valutazione non potrà essere modificata.`, icon: 'pi pi-star-fill', acceptLabel: `Invia ${score}/7`, rejectLabel: 'Rivedi', rejectButtonProps: { severity: 'secondary', variant: 'text' }, accept: () => void this.store.rate(this.matchId, profileId, score) }); }
  protected reportNoShow(profileId: string, reason: string): void { this.confirmationService.confirm({ header: 'Conferma no-show?', message: 'La segnalazione verrà registrata e ridurrà l’affidabilità del giocatore.', icon: 'pi pi-user-minus', acceptLabel: 'Registra no-show', rejectLabel: 'Annulla', acceptButtonProps: { severity: 'danger' }, rejectButtonProps: { severity: 'secondary', variant: 'text' }, accept: () => void this.store.reportNoShow(this.matchId, profileId, reason) }); }
  protected canReportNoShow(profileId: string): boolean { const m = this.store.selected(); return !!m?.completed_at && m.creator_id === this.authStore.authUser()?.id && profileId !== m.creator_id && Date.now() <= new Date(m.completed_at).getTime() + 48 * 60 * 60 * 1000; }
  private scheduleRefresh(): void { if (this.refreshTimer) clearTimeout(this.refreshTimer); this.refreshTimer = setTimeout(() => void this.store.loadMatch(this.matchId, true), 250); }
}
