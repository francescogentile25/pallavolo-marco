drop policy if exists "tournament_presets_insert_own" on public.tournament_presets;
drop policy if exists "tournament_presets_update_own" on public.tournament_presets;
drop policy if exists "tournament_presets_delete_own" on public.tournament_presets;

create policy "tournament_presets_insert_own" on public.tournament_presets
for insert to authenticated with check (
  organizer_id = (select auth.uid()) and public.can_organize_tournaments()
);

create policy "tournament_presets_update_own" on public.tournament_presets
for update to authenticated using (
  (organizer_id = (select auth.uid()) and public.can_organize_tournaments()) or public.is_admin()
) with check (
  (organizer_id = (select auth.uid()) and public.can_organize_tournaments()) or public.is_admin()
);

create policy "tournament_presets_delete_own" on public.tournament_presets
for delete to authenticated using (
  (organizer_id = (select auth.uid()) and public.can_organize_tournaments()) or public.is_admin()
);

notify pgrst, 'reload schema';
