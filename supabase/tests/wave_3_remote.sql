begin;

do $$
declare
  actor_id uuid;
  target_id uuid;
  venue_id uuid := gen_random_uuid();
  court_id uuid := gen_random_uuid();
  match_id uuid := gen_random_uuid();
begin
  select id into actor_id from public.profiles where attivo order by created_at limit 1;
  select id into target_id from public.profiles where attivo and id <> actor_id order by created_at limit 1;
  if actor_id is null or target_id is null then
    raise exception 'Servono almeno due profili attivi';
  end if;

  insert into public.venues (id, name, address, city, created_by)
  values (venue_id, 'Wave 3 rollback venue', 'Via Test 3', 'Roma', actor_id);
  insert into public.courts (id, venue_id, name, created_by)
  values (court_id, venue_id, 'Wave 3 rollback court', actor_id);
  insert into public.matches (
    id, creator_id, court_id, status, gender, min_level, max_level,
    starts_at, duration_minutes, capacity
  ) values (
    match_id, actor_id, court_id, 'in_progress', 'mixed', 1, 7,
    now() - interval '30 minutes', 60, 2
  );
  insert into public.match_participants (match_id, profile_id)
  values (match_id, actor_id), (match_id, target_id);

  perform set_config('wave3_test.actor', actor_id::text, true);
  perform set_config('wave3_test.target', target_id::text, true);
  perform set_config('wave3_test.match', match_id::text, true);
  perform set_config('wave3_test.target_reliability', (select affidabilita::text from public.profiles where id = target_id), true);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('wave3_test.target'), true);
do $$ begin
  begin
    perform public.close_match(current_setting('wave3_test.match')::uuid);
    raise exception 'Il non organizzatore ha chiuso la partita';
  exception when others then
    if sqlerrm not like '%Solo il creatore%' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('wave3_test.actor'), true);
do $$ begin
  begin
    perform public.close_match(current_setting('wave3_test.match')::uuid);
    raise exception 'Partita chiusa prima del termine';
  exception when others then
    if sqlerrm not like '%non puo ancora%' then raise; end if;
  end;
end $$;

reset role;
update public.matches set starts_at = now() - interval '2 hours'
where id = current_setting('wave3_test.match')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('wave3_test.actor'), true);
select public.close_match(current_setting('wave3_test.match')::uuid);

do $$ begin
  if (select status <> 'completed' or completed_at is null from public.matches where id = current_setting('wave3_test.match')::uuid) then
    raise exception 'Chiusura partita non coerente';
  end if;
  if (select count(*) <> 2 from public.match_attendance where match_id = current_setting('wave3_test.match')::uuid) then
    raise exception 'Presenze iniziali non create';
  end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('wave3_test.target'), true);
select public.submit_match_rating(
  current_setting('wave3_test.match')::uuid,
  current_setting('wave3_test.actor')::uuid,
  6::smallint
);

do $$
declare
  expected_level smallint;
begin
  select greatest(1, least(7, round((6 * 0.75) + (autovalutazione * 0.25))::smallint))
  into expected_level from public.profiles where id = current_setting('wave3_test.actor')::uuid;
  if (select livello from public.profiles where id = current_setting('wave3_test.actor')::uuid) <> expected_level then
    raise exception 'Livello non ricalcolato correttamente';
  end if;
  if not exists (
    select 1 from public.profile_level_history
    where profile_id = current_setting('wave3_test.actor')::uuid and motivo = 'valutazione_partita'
  ) then raise exception 'Storico livello non aggiornato'; end if;
end $$;

do $$ begin
  begin
    perform public.submit_match_rating(
      current_setting('wave3_test.match')::uuid,
      current_setting('wave3_test.actor')::uuid,
      6::smallint
    );
    raise exception 'Il voto duplicato è stato accettato';
  exception when others then
    if sqlerrm not like '%gia valutato%' then raise; end if;
  end;

  begin
    perform public.submit_match_rating(
      current_setting('wave3_test.match')::uuid,
      current_setting('wave3_test.target')::uuid,
      6::smallint
    );
    raise exception 'Autovalutazione accettata';
  exception when others then
    if sqlerrm not like '%Valutazione non valida%' then raise; end if;
  end;

  begin
    perform public.report_match_no_show(
      current_setting('wave3_test.match')::uuid,
      current_setting('wave3_test.actor')::uuid,
      'Tentativo non autorizzato'
    );
    raise exception 'Il non organizzatore ha registrato un no-show';
  exception when others then
    if sqlerrm not like '%Solo il creatore%' then raise; end if;
  end;
end $$;

reset role;
update public.matches set completed_at = now() - interval '8 days'
where id = current_setting('wave3_test.match')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('wave3_test.target'), true);
do $$ begin
  begin
    perform public.submit_match_rating(
      current_setting('wave3_test.match')::uuid,
      current_setting('wave3_test.actor')::uuid,
      5::smallint
    );
    raise exception 'Voto accettato oltre 7 giorni';
  exception when others then
    if sqlerrm not like '%finestra di valutazione%' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('wave3_test.actor'), true);
do $$ begin
  begin
    perform public.report_match_no_show(
      current_setting('wave3_test.match')::uuid,
      current_setting('wave3_test.target')::uuid,
      'Assenza tardiva'
    );
    raise exception 'No-show accettato oltre 48 ore';
  exception when others then
    if sqlerrm not like '%finestra per il no-show%' then raise; end if;
  end;
end $$;

reset role;
update public.matches set completed_at = now()
where id = current_setting('wave3_test.match')::uuid;
set local role authenticated;

select set_config('request.jwt.claim.sub', current_setting('wave3_test.actor'), true);
do $$ begin
  begin
    perform public.report_match_no_show(
      current_setting('wave3_test.match')::uuid,
      current_setting('wave3_test.target')::uuid,
      ''
    );
    raise exception 'No-show senza motivazione accettato';
  exception when others then
    if sqlerrm not like '%non valida%' then raise; end if;
  end;
end $$;
select public.report_match_no_show(
  current_setting('wave3_test.match')::uuid,
  current_setting('wave3_test.target')::uuid,
  'Assenza non comunicata'
);

do $$ begin
  if not exists (
    select 1 from public.match_attendance
    where match_id = current_setting('wave3_test.match')::uuid
      and profile_id = current_setting('wave3_test.target')::uuid
      and status = 'no_show'
  ) then raise exception 'No-show non registrato'; end if;
  if exists (
    select 1 from public.match_ratings
    where match_id = current_setting('wave3_test.match')::uuid and valid
  ) then raise exception 'Voto del no-show ancora valido'; end if;
  if (select affidabilita from public.profiles where id = current_setting('wave3_test.target')::uuid)
     <> greatest(1, current_setting('wave3_test.target_reliability')::numeric - 1) then
    raise exception 'Affidabilità non aggiornata correttamente';
  end if;
  if not exists (
    select 1 from public.profile_reliability_history
    where profile_id = current_setting('wave3_test.target')::uuid and motivo = 'no_show_partita'
  ) then raise exception 'Storico affidabilità non aggiornato'; end if;

  begin
    perform public.report_match_no_show(
      current_setting('wave3_test.match')::uuid,
      current_setting('wave3_test.target')::uuid,
      'Duplicato'
    );
    raise exception 'No-show duplicato accettato';
  exception when others then
    if sqlerrm not like '%gia registrato%' then raise; end if;
  end;

  begin
    insert into public.match_ratings (match_id, evaluator_id, rated_profile_id, score)
    values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 4);
    raise exception 'INSERT diretto sulle valutazioni accettato';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.match_attendance set status = 'present'
    where match_id = current_setting('wave3_test.match')::uuid
      and profile_id = current_setting('wave3_test.target')::uuid;
    raise exception 'UPDATE diretto sulle presenze accettato';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
do $$ begin
  if (select count(*) from public.match_attendance where match_id = current_setting('wave3_test.match')::uuid) <> 0 then
    raise exception 'Utente estraneo vede le presenze';
  end if;
  if (select count(*) from public.match_ratings where match_id = current_setting('wave3_test.match')::uuid) <> 0 then
    raise exception 'Utente estraneo vede le valutazioni';
  end if;
  begin
    perform public.submit_match_rating(
      current_setting('wave3_test.match')::uuid,
      current_setting('wave3_test.actor')::uuid,
      4::smallint
    );
    raise exception 'Utente estraneo ha inviato una valutazione';
  exception when others then
    if sqlerrm not like '%Profilo attivo richiesto%' then raise; end if;
  end;
end $$;

reset role;
select json_build_object(
  'status', 'ok',
  'checks', array[
    'close_match', 'initial_attendance', 'rating', 'duplicate_rejected',
    'self_rating_rejected', 'early_close_rejected', 'non_creator_close_rejected',
    'rating_level_history', 'rating_window', 'outsider_rating_rejected',
    'non_creator_no_show_rejected', 'no_show_window', 'no_show_reason_required',
    'no_show', 'duplicate_no_show_rejected', 'reliability_history',
    'rating_invalidated', 'direct_writes_rejected', 'outsider_rls'
  ],
  'rolled_back', true
) as wave_3_matrix;

rollback;
