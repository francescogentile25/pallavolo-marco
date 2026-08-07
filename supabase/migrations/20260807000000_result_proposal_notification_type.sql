-- Nuovo tipo per il rifiuto di una proposta di risultato.
-- In migration separata: un valore enum non e usabile nella stessa transazione
-- in cui viene aggiunto.
alter type public.notification_type add value if not exists 'tournament_result_rejected';
