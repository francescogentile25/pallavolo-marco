-- Una partita rimane consultabile dopo la disattivazione del campo, ma le
-- vecchie policy nascondevano l'embed court/venue e PostgREST restituiva null.
-- Manteniamo pubblici i luoghi attivi e rendiamo quelli storici leggibili solo
-- al creatore o a un partecipante della specifica partita che li utilizza.

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
      join public.matches m on m.court_id = c.id
      where c.venue_id = venues.id
        and (
          public.is_admin()
          or m.creator_id = (select auth.uid())
          or public.is_match_participant(m.id)
        )
    )
  )
);

notify pgrst, 'reload schema';
