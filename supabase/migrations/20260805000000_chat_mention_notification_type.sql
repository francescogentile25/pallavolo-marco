-- Nuovo tipo di notifica per le menzioni in chat.
-- In migration separata: un nuovo valore enum non è utilizzabile nella stessa
-- transazione in cui viene aggiunto.

alter type public.notification_type add value if not exists 'chat_mention';
