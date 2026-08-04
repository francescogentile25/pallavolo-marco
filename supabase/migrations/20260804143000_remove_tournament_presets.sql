-- Tournament configuration is intentionally per-tournament and edited in the Studio.
-- Remove the reusable preset collection introduced by the previous iteration.
alter table public.tournaments
  drop column if exists source_preset_id;

drop table if exists public.tournament_presets;
