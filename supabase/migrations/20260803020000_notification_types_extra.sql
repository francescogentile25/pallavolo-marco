-- Onda 5 — nuovi tipi di notifica (in migration separata: un nuovo valore enum
-- non è utilizzabile nella stessa transazione in cui viene aggiunto).

alter type public.notification_type add value if not exists 'match_invited';
alter type public.notification_type add value if not exists 'match_rating_received';
alter type public.notification_type add value if not exists 'match_no_show_reported';
alter type public.notification_type add value if not exists 'tournament_waitlist_promoted';
alter type public.notification_type add value if not exists 'tournament_result_pending';
