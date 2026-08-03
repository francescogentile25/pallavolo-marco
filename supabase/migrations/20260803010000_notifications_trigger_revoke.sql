-- Onda 5 — hardening: le funzioni trigger sono SECURITY DEFINER e non devono
-- essere invocabili come RPC PostgREST. Revoca l'EXECUTE di default da PUBLIC.

revoke all on function public.notify_tournament_invite() from public;
revoke all on function public.notify_tournament_invite_response() from public;
revoke all on function public.notify_tournament_status() from public;
revoke all on function public.notify_tournament_result() from public;
revoke all on function public.notify_match_join() from public;
revoke all on function public.notify_match_withdraw() from public;
revoke all on function public.notify_match_status() from public;

notify pgrst, 'reload schema';
