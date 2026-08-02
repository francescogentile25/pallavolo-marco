create type public.match_attendance_status as enum ('present', 'no_show');

alter table public.matches
  add column completed_at timestamptz;

create table public.match_attendance (
  match_id uuid not null references public.matches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  status public.match_attendance_status not null default 'present',
  reason text,
  reported_by uuid references public.profiles(id) on delete restrict,
  reported_at timestamptz,
  primary key (match_id, profile_id),
  constraint match_attendance_report_check check (
    (status = 'present' and reason is null and reported_by is null and reported_at is null)
    or (status = 'no_show' and char_length(reason) between 3 and 240
      and reported_by is not null and reported_at is not null)
  )
);

update public.matches
set completed_at = starts_at + make_interval(mins => duration_minutes)
where status = 'completed' and completed_at is null;

insert into public.match_attendance (match_id, profile_id)
select mp.match_id, mp.profile_id
from public.match_participants mp
join public.matches m on m.id = mp.match_id
where m.status = 'completed'
on conflict (match_id, profile_id) do nothing;

create table public.match_ratings (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  evaluator_id uuid not null references public.profiles(id) on delete restrict,
  rated_profile_id uuid not null references public.profiles(id) on delete restrict,
  score smallint not null check (score between 1 and 7),
  valid boolean not null default true,
  created_at timestamptz not null default now(),
  constraint match_ratings_not_self check (evaluator_id <> rated_profile_id),
  constraint match_ratings_unique_pair unique (match_id, evaluator_id, rated_profile_id)
);

create index match_ratings_rated_created_idx
  on public.match_ratings (rated_profile_id, created_at desc);

alter table public.match_attendance enable row level security;
alter table public.match_ratings enable row level security;

create policy "match_attendance_select_participants"
on public.match_attendance for select to authenticated
using (
  public.is_active_user()
  and exists (
    select 1 from public.match_participants mine
    where mine.match_id = match_attendance.match_id
      and mine.profile_id = (select auth.uid())
  )
);

create policy "match_ratings_select_own"
on public.match_ratings for select to authenticated
using (
  public.is_active_user()
  and (evaluator_id = (select auth.uid()) or rated_profile_id = (select auth.uid()))
);

grant select on public.match_attendance, public.match_ratings to authenticated;

create or replace function public.refresh_match_statuses()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Autenticazione richiesta'; end if;
  update public.matches
  set status = 'in_progress'::public.match_status
  where status in ('open', 'full') and starts_at <= now();
end;
$$;

create or replace function public.close_match(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_match public.matches;
begin
  select * into target_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Partita non trovata'; end if;
  if actor_id is null or target_match.creator_id <> actor_id then
    raise exception 'Solo il creatore puo chiudere la partita';
  end if;
  if target_match.status not in ('open', 'full', 'in_progress')
     or target_match.starts_at + make_interval(mins => target_match.duration_minutes) > now() then
    raise exception 'La partita non puo ancora essere chiusa';
  end if;

  update public.matches
  set status = 'completed', completed_at = now()
  where id = p_match_id
  returning * into target_match;

  insert into public.match_attendance (match_id, profile_id)
  select match_id, profile_id from public.match_participants where match_id = p_match_id
  on conflict (match_id, profile_id) do nothing;

  return target_match;
end;
$$;

create or replace function public.submit_match_rating(
  p_match_id uuid,
  p_rated_profile_id uuid,
  p_score smallint
)
returns public.match_ratings
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_match public.matches;
  created_rating public.match_ratings;
  rating_average numeric;
  self_rating smallint;
  calculated_level smallint;
begin
  if actor_id is null or not public.is_active_user() then
    raise exception 'Profilo attivo richiesto';
  end if;
  if p_score not between 1 and 7 or actor_id = p_rated_profile_id then
    raise exception 'Valutazione non valida';
  end if;

  select * into target_match from public.matches where id = p_match_id;
  if not found or target_match.status <> 'completed' or target_match.completed_at is null then
    raise exception 'La partita non e conclusa';
  end if;
  if now() > target_match.completed_at + interval '7 days' then
    raise exception 'La finestra di valutazione e chiusa';
  end if;
  if not exists (select 1 from public.match_participants where match_id = p_match_id and profile_id = actor_id)
     or not exists (select 1 from public.match_participants where match_id = p_match_id and profile_id = p_rated_profile_id) then
    raise exception 'Puoi valutare solo i partecipanti';
  end if;
  if exists (
    select 1 from public.match_attendance
    where match_id = p_match_id and profile_id in (actor_id, p_rated_profile_id) and status = 'no_show'
  ) then
    raise exception 'I no-show non possono inviare o ricevere valutazioni';
  end if;

  insert into public.match_ratings (match_id, evaluator_id, rated_profile_id, score)
  values (p_match_id, actor_id, p_rated_profile_id, p_score)
  returning * into created_rating;

  select avg(score)::numeric into rating_average
  from public.match_ratings where rated_profile_id = p_rated_profile_id and valid;
  select autovalutazione into self_rating from public.profiles where id = p_rated_profile_id for update;
  calculated_level := greatest(1, least(7, round((rating_average * 0.75) + (self_rating * 0.25))::smallint));

  update public.profiles set livello = calculated_level where id = p_rated_profile_id;
  insert into public.profile_level_history (profile_id, autovalutazione, livello_calcolato, motivo)
  values (p_rated_profile_id, self_rating, calculated_level, 'valutazione_partita');

  return created_rating;
exception
  when unique_violation then raise exception 'Hai gia valutato questo giocatore';
end;
$$;

create or replace function public.report_match_no_show(
  p_match_id uuid,
  p_profile_id uuid,
  p_reason text
)
returns public.match_attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_match public.matches;
  attendance_record public.match_attendance;
  previous_reliability numeric(3, 2);
  new_reliability numeric(3, 2);
  affected record;
  rating_average numeric;
  self_rating smallint;
  calculated_level smallint;
begin
  select * into target_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Partita non trovata'; end if;
  if actor_id is null or target_match.creator_id <> actor_id then
    raise exception 'Solo il creatore puo segnalare un no-show';
  end if;
  if target_match.status <> 'completed' or target_match.completed_at is null
     or now() > target_match.completed_at + interval '48 hours' then
    raise exception 'La finestra per il no-show e chiusa';
  end if;
  if p_profile_id = actor_id
     or not exists (select 1 from public.match_participants where match_id = p_match_id and profile_id = p_profile_id)
     or char_length(trim(coalesce(p_reason, ''))) not between 3 and 240 then
    raise exception 'Segnalazione no-show non valida';
  end if;

  update public.match_attendance
  set status = 'no_show', reason = trim(p_reason), reported_by = actor_id, reported_at = now()
  where match_id = p_match_id and profile_id = p_profile_id and status = 'present'
  returning * into attendance_record;
  if not found then raise exception 'No-show gia registrato'; end if;

  for affected in
    select distinct rated_profile_id
    from public.match_ratings
    where match_id = p_match_id and valid
      and (evaluator_id = p_profile_id or rated_profile_id = p_profile_id)
  loop
    update public.match_ratings set valid = false
    where match_id = p_match_id and valid
      and (evaluator_id = p_profile_id or rated_profile_id = p_profile_id);
    select avg(score)::numeric into rating_average
    from public.match_ratings where rated_profile_id = affected.rated_profile_id and valid;
    select autovalutazione into self_rating from public.profiles
    where id = affected.rated_profile_id for update;
    calculated_level := greatest(1, least(7,
      round((coalesce(rating_average, self_rating) * 0.75) + (self_rating * 0.25))::smallint));
    update public.profiles set livello = calculated_level where id = affected.rated_profile_id;
    insert into public.profile_level_history (profile_id, autovalutazione, livello_calcolato, motivo)
    values (affected.rated_profile_id, self_rating, calculated_level, 'no_show_valutazioni_invalidate');
  end loop;

  select affidabilita into previous_reliability from public.profiles where id = p_profile_id for update;
  new_reliability := greatest(1, previous_reliability - 1);
  update public.profiles set affidabilita = new_reliability where id = p_profile_id;
  insert into public.profile_reliability_history (profile_id, affidabilita, variazione, motivo)
  values (p_profile_id, new_reliability, new_reliability - previous_reliability, 'no_show_partita');

  return attendance_record;
end;
$$;

drop function public.get_match_participants(uuid);
create function public.get_match_participants(p_match_id uuid)
returns table (
  profile_id uuid,
  nome text,
  cognome text,
  avatar_url text,
  livello smallint,
  joined_at timestamptz,
  is_creator boolean,
  attendance_status public.match_attendance_status,
  my_rating smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_user() or not exists (
    select 1 from public.matches m
    where m.id = p_match_id and (m.status <> 'draft' or m.creator_id = (select auth.uid()))
  ) then raise exception 'Partita non accessibile'; end if;

  return query
  select p.id, p.nome, p.cognome, p.avatar_url, p.livello, mp.joined_at,
    p.id = m.creator_id,
    case when exists (
      select 1 from public.match_participants viewer
      where viewer.match_id = mp.match_id and viewer.profile_id = (select auth.uid())
    ) then ma.status else null end,
    mr.score
  from public.match_participants mp
  join public.profiles p on p.id = mp.profile_id
  join public.matches m on m.id = mp.match_id
  left join public.match_attendance ma on ma.match_id = mp.match_id and ma.profile_id = mp.profile_id
  left join public.match_ratings mr on mr.match_id = mp.match_id
    and mr.rated_profile_id = mp.profile_id and mr.evaluator_id = (select auth.uid()) and mr.valid
  where mp.match_id = p_match_id
  order by (p.id = m.creator_id) desc, mp.joined_at;
end;
$$;

revoke all on function public.close_match(uuid) from public;
revoke all on function public.submit_match_rating(uuid, uuid, smallint) from public;
revoke all on function public.report_match_no_show(uuid, uuid, text) from public;
revoke all on function public.get_match_participants(uuid) from public;
grant execute on function public.close_match(uuid) to authenticated;
grant execute on function public.submit_match_rating(uuid, uuid, smallint) to authenticated;
grant execute on function public.report_match_no_show(uuid, uuid, text) to authenticated;
grant execute on function public.get_match_participants(uuid) to authenticated;

alter publication supabase_realtime add table public.match_attendance;
alter publication supabase_realtime add table public.match_ratings;

comment on function public.submit_match_rating(uuid, uuid, smallint) is
  'Registra un voto immutabile fra partecipanti presenti e ricalcola il livello del destinatario.';
comment on function public.report_match_no_show(uuid, uuid, text) is
  'Consente al solo organizzatore di registrare un no-show entro 48 ore e aggiorna la reputazione.';
