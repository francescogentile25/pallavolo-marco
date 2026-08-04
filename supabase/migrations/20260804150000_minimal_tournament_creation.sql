drop function if exists public.create_tournament(
  text, text, uuid, uuid[], public.tournament_preset,
  public.tournament_registration_mode, public.tournament_format, public.match_gender,
  smallint, smallint, smallint, timestamptz, timestamptz, timestamptz, integer,
  smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint,
  boolean, boolean, smallint, smallint, smallint, boolean
);

alter table public.tournaments drop column if exists preset;
drop type if exists public.tournament_preset;

create function public.create_tournament(
  p_title text,
  p_description text,
  p_venue_id uuid,
  p_court_ids uuid[],
  p_gender public.match_gender,
  p_min_level smallint,
  p_max_level smallint,
  p_registration_deadline timestamptz,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_cost_cents integer
) returns public.tournaments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  created public.tournaments;
begin
  if actor is null or not public.can_organize_tournaments() then
    raise exception 'Permesso organizzatore richiesto';
  end if;
  if char_length(trim(p_title)) not between 3 and 100 then
    raise exception 'Nome torneo non valido';
  end if;
  if p_min_level > p_max_level then
    raise exception 'Fascia di livello non valida';
  end if;
  if p_starts_at <= now() + interval '1 hour'
     or p_registration_deadline >= p_starts_at
     or p_starts_at >= p_ends_at
     or coalesce(array_length(p_court_ids, 1), 0) = 0 then
    raise exception 'Controlla date e campi del torneo';
  end if;
  if exists (
    select 1 from unnest(p_court_ids) supplied(id)
    left join public.courts court
      on court.id = supplied.id and court.venue_id = p_venue_id and court.active
    where court.id is null
  ) then
    raise exception 'Uno o piu campi non appartengono al luogo selezionato';
  end if;

  insert into public.tournaments (
    organizer_id, venue_id, title, description, registration_mode, format, gender,
    min_level, max_level, max_teams, registration_deadline, starts_at, ends_at,
    cost_cents, guaranteed_matches, group_size, qualifiers_per_group, group_best_of,
    group_set_points, knockout_best_of, knockout_set_points, tiebreak_points,
    win_by_two, third_place, standings_win_points, standings_loss_points,
    minimum_rest_minutes, result_confirmation_required
  ) values (
    actor, p_venue_id, trim(p_title), nullif(trim(p_description), ''),
    'hybrid'::public.tournament_registration_mode, 'mixed'::public.tournament_format,
    p_gender, p_min_level, p_max_level, 64, p_registration_deadline, p_starts_at,
    p_ends_at, p_cost_cents, 0, 4, 2, 1, 21, 3, 21, 15, true, false, 2, 0, 0, false
  ) returning * into created;

  insert into public.tournament_courts (tournament_id, court_id)
  select created.id, id from (select distinct unnest(p_court_ids) id) courts;
  return created;
end;
$$;

revoke all on function public.create_tournament(
  text, text, uuid, uuid[], public.match_gender, smallint, smallint,
  timestamptz, timestamptz, timestamptz, integer
) from public;
grant execute on function public.create_tournament(
  text, text, uuid, uuid[], public.match_gender, smallint, smallint,
  timestamptz, timestamptz, timestamptz, integer
) to authenticated;
