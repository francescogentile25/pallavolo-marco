do $$
declare
  actor_id uuid;
  target_id uuid;
begin
  select id into actor_id from public.profiles where attivo order by created_at limit 1;
  select id into target_id from public.profiles where attivo and id <> actor_id order by created_at limit 1;
  if actor_id is null or target_id is null then raise exception 'Servono due profili attivi'; end if;

  insert into public.venues (id, name, address, city, created_by)
  values ('f3000000-0000-0000-0000-000000000001', 'Demo Onda 3', 'Via Test 3', 'Roma', actor_id);
  insert into public.courts (id, venue_id, name, created_by)
  values ('f3000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000001', 'Campo QA', actor_id);
  insert into public.matches (
    id, creator_id, court_id, status, gender, min_level, max_level,
    starts_at, duration_minutes, capacity, notes, completed_at
  ) values (
    'f3000000-0000-0000-0000-000000000003', actor_id,
    'f3000000-0000-0000-0000-000000000002', 'completed', 'mixed', 1, 7,
    now() - interval '2 hours', 60, 2, 'Partita dimostrativa per valutazioni e affidabilità', now()
  );
  insert into public.match_participants (match_id, profile_id)
  values
    ('f3000000-0000-0000-0000-000000000003', actor_id),
    ('f3000000-0000-0000-0000-000000000003', target_id);
  insert into public.match_attendance (match_id, profile_id)
  values
    ('f3000000-0000-0000-0000-000000000003', actor_id),
    ('f3000000-0000-0000-0000-000000000003', target_id);
end;
$$;

select 'f3000000-0000-0000-0000-000000000003'::uuid as fixture_match_id;
