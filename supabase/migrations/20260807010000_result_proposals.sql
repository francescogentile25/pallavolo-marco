-- Risultati proposti dai giocatori e validati dall'organizzatore.
--
-- Finora solo l'organizzatore poteva registrare un risultato. Ora chi gioca la
-- partita puo proporlo: la proposta resta in attesa, l'organizzatore riceve un
-- avviso e solo quando accetta il risultato diventa effettivo. Il punteggio non
-- tocca mai la partita finche non e validato.

create table if not exists public.tournament_result_proposals (
  id bigint generated always as identity primary key,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  game_id uuid not null references public.tournament_games(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id) on delete cascade,
  team1_scores smallint[] not null,
  team2_scores smallint[] not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- una sola proposta in attesa per partita: la nuova sostituisce la precedente
create unique index if not exists tournament_result_proposals_one_pending
  on public.tournament_result_proposals (game_id) where status = 'pending';
create index if not exists tournament_result_proposals_game_idx
  on public.tournament_result_proposals (game_id, status);

alter table public.tournament_result_proposals enable row level security;

drop policy if exists "result_proposals_select_visible" on public.tournament_result_proposals;
create policy "result_proposals_select_visible" on public.tournament_result_proposals
for select to authenticated using (
  exists (
    select 1 from public.tournaments t
    where t.id = tournament_id
      and (t.organizer_id = (select auth.uid()) or public.is_admin()
        or public.is_tournament_participant(t.id))
  )
);
grant select on public.tournament_result_proposals to authenticated;

-- ---- Chi gioca la partita propone il risultato ----
create or replace function public.propose_tournament_result(
  p_game_id uuid, p_team1_scores smallint[], p_team2_scores smallint[]
) returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  game public.tournament_games;
  target public.tournaments;
  score_index integer;
  recipients uuid[];
begin
  if actor is null then raise exception 'Autenticazione richiesta'; end if;
  select * into game from public.tournament_games where id = p_game_id for update;
  if not found then raise exception 'Incontro non trovato'; end if;
  select * into target from public.tournaments where id = game.tournament_id;
  if target.status in ('cancelled', 'archived') then raise exception 'Il torneo non accetta questa operazione'; end if;
  if game.team1_id is null or game.team2_id is null then raise exception 'Risultato incompleto'; end if;
  if game.status <> 'scheduled' then raise exception 'Il risultato di questa partita e gia stato registrato'; end if;

  -- deve giocarla: solo i membri delle due coppie in campo possono proporre
  if not exists (
    select 1 from public.tournament_team_members m
    where m.profile_id = actor and m.status = 'accepted'
      and m.team_id in (game.team1_id, game.team2_id)
  ) then raise exception 'Solo chi disputa la partita puo proporre il risultato'; end if;

  if array_length(p_team1_scores, 1) is distinct from array_length(p_team2_scores, 1)
     or coalesce(array_length(p_team1_scores, 1), 0) = 0 then
    raise exception 'Risultato incompleto';
  end if;
  for score_index in 1..array_length(p_team1_scores, 1) loop
    if p_team1_scores[score_index] < 0 or p_team2_scores[score_index] < 0
       or p_team1_scores[score_index] = p_team2_scores[score_index] then
      raise exception 'Il pareggio non e consentito';
    end if;
  end loop;

  -- la proposta precedente ancora in attesa viene sostituita
  update public.tournament_result_proposals
    set status = 'rejected', reviewed_at = now()
  where game_id = p_game_id and status = 'pending';

  insert into public.tournament_result_proposals(tournament_id, game_id, proposed_by, team1_scores, team2_scores)
  values (game.tournament_id, p_game_id, actor, p_team1_scores, p_team2_scores);

  -- avviso all'organizzatore, che deve validare
  recipients := array[target.organizer_id];
  perform public.create_notifications(recipients, 'tournament_result_pending',
    null, game.tournament_id, actor, jsonb_build_object('gameId', p_game_id));
end;
$$;

-- ---- L'organizzatore valida o rifiuta ----
create or replace function public.review_tournament_result(p_game_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  game public.tournament_games;
  target public.tournaments;
  proposal public.tournament_result_proposals;
begin
  select * into game from public.tournament_games where id = p_game_id;
  if not found then raise exception 'Incontro non trovato'; end if;
  select * into target from public.tournaments where id = game.tournament_id;
  if actor is null or (target.organizer_id <> actor and not public.is_admin()) then
    raise exception 'Permesso organizzatore richiesto';
  end if;

  select * into proposal from public.tournament_result_proposals
  where game_id = p_game_id and status = 'pending' for update;
  if not found then raise exception 'Nessuna proposta da validare'; end if;

  if p_accept then
    -- solo qui il punteggio entra davvero in partita, con tutte le sue verifiche
    perform public.submit_tournament_result(p_game_id, proposal.team1_scores, proposal.team2_scores);
    update public.tournament_result_proposals
      set status = 'accepted', reviewed_by = actor, reviewed_at = now()
    where id = proposal.id;
    perform public.create_notifications(array[proposal.proposed_by], 'tournament_result_recorded',
      null, game.tournament_id, actor, jsonb_build_object('gameId', p_game_id));
  else
    update public.tournament_result_proposals
      set status = 'rejected', reviewed_by = actor, reviewed_at = now()
    where id = proposal.id;
    perform public.create_notifications(array[proposal.proposed_by], 'tournament_result_rejected',
      null, game.tournament_id, actor, jsonb_build_object('gameId', p_game_id));
  end if;
end;
$$;

revoke all on function public.propose_tournament_result(uuid, smallint[], smallint[]) from public;
revoke all on function public.review_tournament_result(uuid, boolean) from public;
grant execute on function
  public.propose_tournament_result(uuid, smallint[], smallint[]),
  public.review_tournament_result(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
