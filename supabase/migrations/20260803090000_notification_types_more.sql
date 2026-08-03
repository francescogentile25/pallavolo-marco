-- Nuovi tipi notifica: messaggio in chat e richiesta cambio nome (in migration
-- separata: un nuovo valore enum non è usabile nella stessa transazione).

alter type public.notification_type add value if not exists 'chat_message';
alter type public.notification_type add value if not exists 'name_change_request';
