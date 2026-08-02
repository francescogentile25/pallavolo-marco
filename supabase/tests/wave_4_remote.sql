begin;

do $$
declare
  organizer uuid;
  player uuid;
  venue uuid;
  court uuid;
begin
  select id into organizer from public.profiles where attivo order by created_at limit 1;
  select id into player from public.profiles where attivo and id <> organizer order by created_at limit 1;
  select c.id, c.venue_id into court, venue
  from public.courts c where c.active order by c.created_at limit 1;

  if organizer is null or player is null then
    raise exception 'Servono almeno due profili attivi per la matrice Onda 4';
  end if;
  if court is null then raise exception 'Serve almeno un campo attivo'; end if;

  perform set_config('wave4_test.organizer', organizer::text, true);
  perform set_config('wave4_test.player', player::text, true);
  perform set_config('wave4_test.venue', venue::text, true);
  perform set_config('wave4_test.court', court::text, true);
  perform set_config('wave4_test.organizer_role', (select ruolo::text from public.profiles where id = organizer), true);
  update public.profiles set ruolo = 'organizzatore' where id = organizer;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('wave4_test.organizer'), true);

do $$
declare created public.tournaments;
begin
  created := public.create_tournament(
    'Wave 4 rollback tournament', 'Matrice automatica con rollback',
    current_setting('wave4_test.venue')::uuid, array[current_setting('wave4_test.court')::uuid],
    'quick', 'hybrid', 'groups', 'mixed', 1::smallint, 7::smallint, 8::smallint,
    now() + interval '1 day', now() + interval '2 days', now() + interval '2 days 8 hours',
    0, 3::smallint, 4::smallint, 2::smallint, 1::smallint, 15::smallint,
    1::smallint, 21::smallint, 15::smallint, true, false, 2::smallint, 0::smallint,
    15::smallint, true
  );
  perform set_config('wave4_test.tournament', created.id::text, true);

  if created.status <> 'draft' or created.rules_locked_at is not null then
    raise exception 'Creazione bozza non coerente';
  end if;
end;
$$;

select public.publish_tournament(current_setting('wave4_test.tournament')::uuid);

do $$ begin
  if not exists (
    select 1 from public.tournaments
    where id = current_setting('wave4_test.tournament')::uuid and status = 'published'
  ) then raise exception 'Pubblicazione non riuscita'; end if;

  begin
    insert into public.tournaments (
      organizer_id, venue_id, title, registration_mode, format, min_level, max_level,
      max_teams, registration_deadline, starts_at, ends_at, guaranteed_matches
    ) values (
      current_setting('wave4_test.organizer')::uuid, current_setting('wave4_test.venue')::uuid,
      'Scrittura diretta', 'hybrid', 'groups', 1, 7, 8,
      now() + interval '1 day', now() + interval '2 days', now() + interval '3 days', 3
    );
    raise exception 'INSERT diretto sul torneo accettato';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('wave4_test.player'), true);
select public.join_tournament_as_free_player(current_setting('wave4_test.tournament')::uuid);

do $$ begin
  if not exists (
    select 1 from public.tournament_free_players
    where tournament_id = current_setting('wave4_test.tournament')::uuid
      and profile_id = current_setting('wave4_test.player')::uuid and status = 'active'
  ) then raise exception 'Iscrizione individuale non registrata'; end if;

  begin
    perform public.join_tournament_as_free_player(current_setting('wave4_test.tournament')::uuid);
    raise exception 'Iscrizione individuale duplicata accettata';
  exception when others then
    if sqlerrm not like '%già iscritto%' and sqlerrm not like '%gia iscritto%' then raise; end if;
  end;
end $$;

select public.withdraw_from_tournament(current_setting('wave4_test.tournament')::uuid);
select public.join_tournament_as_free_player(current_setting('wave4_test.tournament')::uuid);

do $$ begin
  if (select status from public.tournament_free_players
      where tournament_id = current_setting('wave4_test.tournament')::uuid
        and profile_id = current_setting('wave4_test.player')::uuid) <> 'active' then
    raise exception 'Re-iscrizione dopo ritiro non riuscita';
  end if;
end $$;

select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
do $$ begin
  if (select count(*) from public.tournaments
      where id = current_setting('wave4_test.tournament')::uuid) <> 0 then
    raise exception 'Profilo inesistente vede il torneo';
  end if;
  begin
    perform public.join_tournament_as_free_player(current_setting('wave4_test.tournament')::uuid);
    raise exception 'Profilo inesistente iscritto al torneo';
  exception when others then
    if sqlerrm not like '%Profilo attivo richiesto%' then raise; end if;
  end;
end $$;

reset role;
select json_build_object(
  'status', 'ok',
  'checks', array[
    'create_draft', 'publish', 'player_join', 'duplicate_rejected', 'withdraw',
    'rejoin', 'direct_write_rejected', 'inactive_profile_rls', 'inactive_profile_rpc'
  ],
  'rolled_back', true
) as wave_4_matrix;

rollback;
