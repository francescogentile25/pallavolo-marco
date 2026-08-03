-- Nuovi tipi di notifica per il sistema di amicizie (in migration separata:
-- un nuovo valore enum non è usabile nella stessa transazione in cui è aggiunto).

alter type public.notification_type add value if not exists 'friend_request_received';
alter type public.notification_type add value if not exists 'friend_request_accepted';
