-- Dati dimostrativi ripetibili per sviluppo e ambiente di test.
-- Gli indirizzi .invalid non sono recapitabili e gli utenti non hanno una
-- password utilizzabile: gli account reali devono essere creati tramite Auth.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'organizzatore@demo.invalid', null, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nome":"Andrea","cognome":"Rossi","city":"Roma","city_latitude":41.9028,"city_longitude":12.4964,"city_place_id":3169070}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'giulia@demo.invalid', null, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nome":"Giulia","cognome":"Bianchi","city":"Roma","city_latitude":41.9028,"city_longitude":12.4964,"city_place_id":3169070}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'marco@demo.invalid', null, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nome":"Marco","cognome":"Verdi","city":"Roma","city_latitude":41.9028,"city_longitude":12.4964,"city_place_id":3169070}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004',
    'authenticated', 'authenticated', 'sara@demo.invalid', null, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nome":"Sara","cognome":"Neri","city":"Rimini","city_latitude":44.0678,"city_longitude":12.5695,"city_place_id":3169361}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated', 'luca@demo.invalid', null, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nome":"Luca","cognome":"Gialli","city":"Rimini","city_latitude":44.0678,"city_longitude":12.5695,"city_place_id":3169361}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000006',
    'authenticated', 'authenticated', 'elena@demo.invalid', null, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nome":"Elena","cognome":"Blu","city":"Rimini","city_latitude":44.0678,"city_longitude":12.5695,"city_place_id":3169361}'::jsonb,
    now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

update public.profiles
set
  attivo = true,
  ruolo = case
    when id = '10000000-0000-0000-0000-000000000001' then 'organizzatore'::public.user_role
    else 'giocatore'::public.user_role
  end,
  livello = case id
    when '10000000-0000-0000-0000-000000000001' then 4
    when '10000000-0000-0000-0000-000000000002' then 4
    when '10000000-0000-0000-0000-000000000003' then 3
    when '10000000-0000-0000-0000-000000000004' then 5
    when '10000000-0000-0000-0000-000000000005' then 3
    else 4
  end,
  autovalutazione = case id
    when '10000000-0000-0000-0000-000000000004' then 5
    when '10000000-0000-0000-0000-000000000003' then 3
    when '10000000-0000-0000-0000-000000000005' then 3
    else 4
  end,
  registration_completed_at = coalesce(registration_completed_at, now())
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000006'
);

insert into public.venues (
  id, name, address, city, latitude, longitude, active, created_by, place_id
)
values
  (
    '20000000-0000-0000-0000-000000000001', 'Beach Arena Roma',
    'Lungotevere Testaccio 1', 'Roma', 41.875900, 12.474200, true,
    '10000000-0000-0000-0000-000000000001', 3169070
  ),
  (
    '20000000-0000-0000-0000-000000000002', 'Rimini Beach Village',
    'Lungomare Tintori 10', 'Rimini', 44.067800, 12.569500, true,
    '10000000-0000-0000-0000-000000000001', 3169361
  )
on conflict (id) do nothing;

insert into public.courts (id, venue_id, name, surface, indoor, active, created_by)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001', 'Campo Centrale', 'sabbia', false, true,
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001', 'Campo 2', 'sabbia', false, true,
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000002', 'Arena Adriatica', 'sabbia', false, true,
    '10000000-0000-0000-0000-000000000001'
  )
on conflict (id) do nothing;

insert into public.matches (
  id, creator_id, court_id, status, gender, min_level, max_level,
  starts_at, duration_minutes, capacity, notes, visibility
)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', 'open', 'mixed', 2, 5,
    date_trunc('day', now()) + interval '2 days 18 hours', 90, 4,
    'Partita amichevole al tramonto', 'public'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002', 'open', 'female', 3, 6,
    date_trunc('day', now()) + interval '4 days 19 hours', 90, 4,
    'Allenamento intermedio', 'public'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000003', 'open', 'mixed', 3, 6,
    date_trunc('day', now()) + interval '6 days 10 hours', 120, 6,
    'Mattinata di beach volley aperta a nuovi giocatori', 'public'
  )
on conflict (id) do nothing;

insert into public.match_participants (match_id, profile_id)
values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005')
on conflict (match_id, profile_id) do nothing;

insert into public.tournaments (
  id, organizer_id, venue_id, status, title, description,
  registration_mode, format, gender, min_level, max_level, max_teams,
  registration_deadline, starts_at, ends_at, cost_cents,
  guaranteed_matches, group_size, qualifiers_per_group,
  group_best_of, group_set_points, knockout_best_of, knockout_set_points,
  tiebreak_points, win_by_two, third_place, standings_win_points,
  standings_loss_points, minimum_rest_minutes, result_confirmation_required,
  published_at, visibility, city, city_place_id, city_latitude, city_longitude,
  organizer_email, organizer_phone
)
values
  (
    '50000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001', 'published',
    'Roma Summer Cup', 'Torneo misto con fase a gironi e tabellone finale.',
    'hybrid', 'mixed', 'mixed', 2, 6, 16,
    date_trunc('day', now()) + interval '11 days 23 hours',
    date_trunc('day', now()) + interval '14 days 9 hours',
    date_trunc('day', now()) + interval '14 days 20 hours',
    1500, 3, 4, 2, 1, 21, 3, 21, 15, true, true, 2, 0, 20, false,
    now(), 'public', 'Roma', 3169070, 41.9028, 12.4964,
    'eventi@beachvolleyhub.test', '+39 06 0000000'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002', 'published',
    'Adriatic Beach Challenge', 'Una giornata di beach volley sulla costa romagnola.',
    'pairs', 'knockout', 'mixed', 3, 7, 8,
    date_trunc('day', now()) + interval '25 days 23 hours',
    date_trunc('day', now()) + interval '28 days 9 hours',
    date_trunc('day', now()) + interval '28 days 19 hours',
    2000, 1, null, null, 1, 21, 3, 21, 15, true, true, 2, 0, 20, false,
    now(), 'public', 'Rimini', 3169361, 44.0678, 12.5695,
    'tornei@beachvolleyhub.test', '+39 0541 000000'
  )
on conflict (id) do nothing;

insert into public.tournament_courts (tournament_id, court_id)
values
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003')
on conflict (tournament_id, court_id) do nothing;

insert into public.tournament_teams (id, tournament_id, status, seed, created_by)
values
  (
    '60000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001', 'confirmed', 1,
    '10000000-0000-0000-0000-000000000002'
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000001', 'confirmed', 2,
    '10000000-0000-0000-0000-000000000004'
  )
on conflict (id) do nothing;

insert into public.tournament_team_members (
  team_id, profile_id, status, invited_by, responded_at
)
values
  (
    '60000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002', 'accepted',
    '10000000-0000-0000-0000-000000000002', now()
  ),
  (
    '60000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003', 'accepted',
    '10000000-0000-0000-0000-000000000002', now()
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000004', 'accepted',
    '10000000-0000-0000-0000-000000000004', now()
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000005', 'accepted',
    '10000000-0000-0000-0000-000000000004', now()
  )
on conflict (team_id, profile_id) do nothing;
