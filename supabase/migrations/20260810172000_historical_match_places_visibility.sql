-- Una partita rimane consultabile dopo la disattivazione del campo, ma le
-- vecchie policy nascondevano l'embed court/venue e PostgREST restituiva null.
-- Manteniamo pubblici i luoghi attivi e rendiamo quelli storici leggibili solo
-- a chi puo gia vedere una partita o un torneo che li utilizza.

drop policy if exists "courts_select_active_users" on public.courts;
create policy "courts_select_active_users"
on public.courts for select to authenticated
using (
  public.is_active_user()
  and (
    active = true
    or exists (
      select 1
      from public.matches m
      where m.court_id = courts.id
        and (
          public.is_admin()
          or m.creator_id = (select auth.uid())
          or public.is_match_participant(m.id)
        )
    )
    or exists (
      select 1
      from public.tournament_courts link
      join public.tournaments t on t.id = link.tournament_id
      where link.court_id = courts.id
    )
  )
);

drop policy if exists "venues_select_active_users" on public.venues;
create policy "venues_select_active_users"
on public.venues for select to authenticated
using (
  public.is_active_user()
  and (
    active = true
    or exists (
      select 1
      from public.courts c
      where c.venue_id = venues.id
    )
    or exists (
      select 1
      from public.tournaments t
      where t.venue_id = venues.id
    )
  )
);

notify pgrst, 'reload schema';
