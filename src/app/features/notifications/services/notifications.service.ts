import { inject, Injectable, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AppNotification, AppNotificationType, NotificationsPage } from '../models/notification.model';

const RECENT_LIMIT = 15;

interface TypeMeta {
  icon: string;
  title: string;
  text: (actor: string) => string;
}

const META: Record<AppNotificationType, TypeMeta> = {
  match_participant_joined: { icon: 'pi-user-plus', title: 'Nuova iscrizione', text: (a) => `${a} si è iscritto alla tua partita.` },
  match_participant_withdrew: { icon: 'pi-user-minus', title: 'Ritiro dalla partita', text: (a) => `${a} si è ritirato dalla tua partita.` },
  match_cancelled: { icon: 'pi-times-circle', title: 'Partita annullata', text: () => 'Una partita a cui partecipi è stata annullata.' },
  match_closed: { icon: 'pi-flag', title: 'Partita conclusa', text: () => 'Una partita si è conclusa: lascia le tue valutazioni.' },
  match_invited: { icon: 'pi-envelope', title: 'Invito a una partita', text: (a) => `${a} ti ha aggiunto a una partita.` },
  match_rating_received: { icon: 'pi-star', title: 'Nuova valutazione', text: () => 'Hai ricevuto una nuova valutazione.' },
  match_no_show_reported: { icon: 'pi-exclamation-triangle', title: 'Assenza segnalata', text: () => 'Sei stato segnalato come assente a una partita.' },
  tournament_team_invite: { icon: 'pi-envelope', title: 'Invito a un torneo', text: (a) => `${a} ti ha invitato in coppia per un torneo.` },
  tournament_invite_accepted: { icon: 'pi-check-circle', title: 'Invito accettato', text: (a) => `${a} ha accettato il tuo invito in coppia.` },
  tournament_invite_rejected: { icon: 'pi-times-circle', title: 'Invito rifiutato', text: (a) => `${a} ha rifiutato il tuo invito in coppia.` },
  tournament_registration_closed: { icon: 'pi-lock', title: 'Iscrizioni chiuse', text: () => 'Le iscrizioni di un torneo sono chiuse: consulta il calendario.' },
  tournament_cancelled: { icon: 'pi-ban', title: 'Torneo annullato', text: () => 'Un torneo a cui partecipi è stato annullato.' },
  tournament_result_recorded: { icon: 'pi-trophy', title: 'Nuovo risultato', text: () => 'È stato registrato un nuovo risultato in un tuo torneo.' },
  tournament_result_pending: { icon: 'pi-hourglass', title: 'Risultato da validare', text: (a) => `${a} ha proposto il risultato di una partita.` },
  tournament_result_rejected: { icon: 'pi-times-circle', title: 'Risultato non validato', text: (a) => `${a} non ha validato il risultato che hai proposto.` },
  tournament_waitlist_promoted: { icon: 'pi-arrow-up', title: 'Promossi dalla lista d\'attesa', text: () => 'La tua coppia è passata da riserva a confermata.' },
  friend_request_received: { icon: 'pi-user-plus', title: 'Richiesta di amicizia', text: (a) => `${a} ti ha inviato una richiesta di amicizia.` },
  friend_request_accepted: { icon: 'pi-users', title: 'Amicizia accettata', text: (a) => `${a} ha accettato la tua richiesta di amicizia.` },
  chat_message: { icon: 'pi-comments', title: 'Nuovo messaggio', text: (a) => `${a} ha scritto nella chat.` },
  chat_mention: { icon: 'pi-at', title: 'Sei stato menzionato', text: (a) => `${a} ti ha menzionato in chat.` },
  name_change_request: { icon: 'pi-user-edit', title: 'Richiesta cambio nome', text: (a) => `${a} ha richiesto la modifica del proprio nome.` },
};

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly supabase = inject(SupabaseService);
  private channel: RealtimeChannel | null = null;
  private connectedUserId: string | null = null;

  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCount = signal(0);

  /** Apre la connessione realtime per l'utente e carica i recenti. Idempotente. */
  async connect(userId: string): Promise<void> {
    if (this.connectedUserId === userId && this.channel) return;
    await this.disconnect();
    this.connectedUserId = userId;
    this.channel = this.supabase.client
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
        (payload) => this.onInsert(payload.new as AppNotification),
      )
      .subscribe();
    await this.loadRecent();
  }

  async disconnect(): Promise<void> {
    const channel = this.channel;
    this.channel = null;
    this.connectedUserId = null;
    this.notifications.set([]);
    this.unreadCount.set(0);
    if (channel) await this.supabase.client.removeChannel(channel);
  }

  private onInsert(row: AppNotification): void {
    if (!row || this.notifications().some((n) => n.id === row.id)) return;
    this.notifications.update((list) => [row, ...list].slice(0, RECENT_LIMIT));
    if (!row.is_read) this.unreadCount.update((c) => c + 1);
  }

  async loadRecent(): Promise<void> {
    const { data } = await this.supabase.client
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT);
    this.notifications.set((data ?? []) as AppNotification[]);
    const { count } = await this.supabase.client
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);
    this.unreadCount.set(count ?? 0);
  }

  async fetchPage(page: number, pageSize: number): Promise<NotificationsPage> {
    const from = (page - 1) * pageSize;
    const { data, count } = await this.supabase.client
      .from('notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    return { items: (data ?? []) as AppNotification[], total: count ?? 0 };
  }

  async markRead(id: number): Promise<void> {
    if (this.notifications().find((n) => n.id === id)?.is_read) return;
    const { data } = await this.supabase.client.rpc('mark_notification_read', { p_id: id });
    if (typeof data === 'number') this.unreadCount.set(data);
    this.notifications.update((list) => list.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  async markAllRead(): Promise<void> {
    if (this.unreadCount() === 0) return;
    await this.supabase.client.rpc('mark_all_notifications_read');
    this.unreadCount.set(0);
    this.notifications.update((list) => list.map((n) => ({ ...n, is_read: true })));
  }

  // ---- composizione messaggio (sorgente unica per campanella e pagina) ----
  icon(n: AppNotification): string { return META[n.type]?.icon ?? 'pi-bell'; }
  title(n: AppNotification): string { return META[n.type]?.title ?? 'Notifica'; }
  message(n: AppNotification): string {
    const actor = n.actor_name ?? 'Qualcuno';
    return META[n.type]?.text(actor) ?? '';
  }

  link(n: AppNotification): string[] {
    if (n.type === 'friend_request_received' || n.type === 'friend_request_accepted') return ['/amici'];
    if (n.type === 'name_change_request') return ['/admin/utenti'];
    if (n.tournament_id) return ['/tornei', n.tournament_id];
    if (n.match_id) return ['/partite', n.match_id];
    return ['/'];
  }

  timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Ora';
    if (min < 60) return `${min} min fa`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours} h fa`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} g fa`;
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  }
}
