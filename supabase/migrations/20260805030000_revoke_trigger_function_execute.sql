-- Le funzioni trigger non devono essere invocabili via PostgREST: il trigger le esegue
-- comunque, l'EXECUTE al ruolo public/anon esporrebbe solo una RPC inutile.

revoke all on function public.guard_knockout_results_after_groups() from public;
revoke all on function public.notify_chat_message() from public;

notify pgrst, 'reload schema';
