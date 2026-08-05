-- Sezione torneo — secondo giro di feedback.
-- 1) Ogni iscrizione ha sempre il proprio numero progressivo (seed).
-- 2) L'organizzatore può rimuovere una coppia dal torneo o smembrarla in due singoli.
-- 3) Il campo di un incontro si assegna da solo, senza dover fissare anche l'orario.

-- ---- 1) Numero progressivo su ogni iscrizione ----
create or replace function public.assign_tournament_team_seed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.seed is null then
    select coalesce(max(seed), 0) + 1 into new.seed
    from public.tournament_teams where tournament_id = new.tournament_id;
  end if;
  return new;
end;
$$;

drop trigger if exists tournament_teams_assign_seed on public.tournament_teams;
create trigger tournament_teams_assign_seed
before insert on public.tournament_teams
for each row execute procedure public.assign_tournament_team_seed();

-- Backfill: le iscrizioni già esistenti senza numero lo ricevono in ordine di creazione.
with numbered as (
  select t.id,
    (coalesce((select max(seed) from public.tournament_teams s where s.tournament_id = t.tournament_id), 0)
      + row_number() over (partition by t.tournament_id order by t.created_at, t.id))::smallint as next_seed
  from public.tournament_teams t
  where t.seed is null
)
update public.tournament_teams t set seed = numbered.next_seed
from numbered where numbered.id = t.id;

-- ---- 2) Rimozione e smembramento di una coppia ----
create or replace function public.organizer_remove_tournament_team(
  p_tournament_id uuid, p_team_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
begin
  if not exists (select 1 from public.tournament_teams
    where id = p_team_id and tournament_id = p_tournament_id and status <> 'withdrawn')
  then raise exception 'Iscrizione non disponibile'; end if;
  if exists (
    select 1 from public.tournament_games
    where tournament_id = p_tournament_id and status in ('completed', 'pending_confirmation', 'walkover')
      and (team1_id = p_team_id or team2_id = p_team_id)
  ) then raise exception 'La coppia ha gia disputato una partita'; end if;

  delete from public.tournament_group_teams where team_id = p_team_id;
  update public.tournament_games set team1_id = null
    where tournament_id = p_tournament_id and team1_id = p_team_id;
  update public.tournament_games set team2_id = null
    where tournament_id = p_tournament_id and team2_id = p_team_id;
  update public.tournament_teams set status = 'withdrawn', waitlist_position = null where id = p_team_id;
end;
$$;

-- Smembra una coppia: il primo membro resta sull'iscrizione originale, il secondo
-- passa a una nuova iscrizione singola. Entrambi restano assegnabili a nuovi compagni.
create or replace function public.organizer_split_tournament_team(
  p_tournament_id uuid, p_team_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
  actor uuid := (select auth.uid());
  moved_profile uuid;
  created_team uuid;
begin
  if not exists (select 1 from public.tournament_teams
    where id = p_team_id and tournament_id = p_tournament_id and status <> 'withdrawn')
  then raise exception 'Iscrizione non disponibile'; end if;
  if (select count(*) from public.tournament_team_members where team_id = p_team_id and status <> 'rejected') < 2
  then raise exception 'L''iscrizione non e una coppia'; end if;
  if exists (
    select 1 from public.tournament_games
    where tournament_id = p_tournament_id and status in ('completed', 'pending_confirmation', 'walkover')
      and (team1_id = p_team_id or team2_id = p_team_id)
  ) then raise exception 'La coppia ha gia disputato una partita'; end if;

  -- il secondo membro in ordine di ingresso è quello che viene spostato
  select profile_id into moved_profile
  from public.tournament_team_members
  where team_id = p_team_id and status <> 'rejected'
  order by created_at desc, profile_id desc limit 1;

  insert into public.tournament_teams(tournament_id, status, created_by)
  values (p_tournament_id, 'proposed', actor)
  returning id into created_team;

  update public.tournament_team_members
    set team_id = created_team, status = 'accepted', responded_at = now()
  where team_id = p_team_id and profile_id = moved_profile;

  -- entrambe le iscrizioni tornano singole: fuori dai gironi e dagli slot partita
  delete from public.tournament_group_teams where team_id = p_team_id;
  update public.tournament_games set team1_id = null
    where tournament_id = p_tournament_id and team1_id = p_team_id;
  update public.tournament_games set team2_id = null
    where tournament_id = p_tournament_id and team2_id = p_team_id;
  update public.tournament_teams set status = 'proposed', waitlist_position = null where id = p_team_id;

  return created_team;
end;
$$;

-- ---- 3) Campo dell'incontro assegnabile da solo ----
create or replace function public.set_tournament_game_court(p_game_id uuid, p_court_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  game public.tournament_games;
  target public.tournaments;
  game_minutes integer;
begin
  select * into game from public.tournament_games where id = p_game_id for update;
  if not found then raise exception 'Incontro non trovato'; end if;
  select * into target from public.tournaments where id = game.tournament_id;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then
    raise exception 'Permesso organizzatore richiesto';
  end if;

  if p_court_id is null then
    update public.tournament_games set court_id = null where id = p_game_id;
    return;
  end if;

  if not exists (
    select 1 from public.tournament_courts
    where tournament_id = target.id and court_id = p_court_id
  ) then raise exception 'Campo non associato al torneo'; end if;

  -- il controllo di sovrapposizione vale solo per gli incontri già calendarizzati
  if game.scheduled_at is not null then
    game_minutes := case when game.phase = 'group' then 30 else 50 end;
    if exists (
      select 1 from public.tournament_games other
      where other.tournament_id = target.id and other.id <> game.id
        and other.court_id = p_court_id and other.scheduled_at is not null
        and other.status not in ('cancelled', 'walkover')
        and game.scheduled_at < other.scheduled_at + make_interval(mins => case when other.phase = 'group' then 30 else 50 end)
        and other.scheduled_at < game.scheduled_at + make_interval(mins => game_minutes)
    ) then raise exception 'Campo già occupato in questa fascia oraria'; end if;
  end if;

  update public.tournament_games set court_id = p_court_id where id = p_game_id;
end;
$$;

revoke all on function public.assign_tournament_team_seed() from public;
revoke all on function public.organizer_remove_tournament_team(uuid, uuid) from public;
revoke all on function public.organizer_split_tournament_team(uuid, uuid) from public;
revoke all on function public.set_tournament_game_court(uuid, uuid) from public;

grant execute on function
  public.organizer_remove_tournament_team(uuid, uuid),
  public.organizer_split_tournament_team(uuid, uuid),
  public.set_tournament_game_court(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
