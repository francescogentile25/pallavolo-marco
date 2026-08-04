-- Partite e tornei pubblici/privati + storage per le foto profilo.

create type public.match_visibility as enum ('public', 'private');

alter table public.matches add column visibility public.match_visibility not null default 'public';
alter table public.tournaments add column visibility public.match_visibility not null default 'public';

-- ---- Visibilità partite ----
create or replace function public.set_match_visibility(p_match_id uuid, p_visibility public.match_visibility)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  update public.matches set visibility = p_visibility, updated_at = now()
  where id = p_match_id and creator_id = v_uid;
  if not found then raise exception 'Solo il creatore puo cambiare la visibilita'; end if;
end;
$$;

drop policy if exists "matches_select_visible" on public.matches;
create policy "matches_select_visible" on public.matches for select to authenticated
using (
  public.is_active_user() and (
    public.is_admin()
    or creator_id = (select auth.uid())
    or public.is_match_participant(id)
    or (visibility = 'public' and status <> 'draft')
  )
);

-- ---- Visibilità tornei ----
create or replace function public.is_tournament_participant(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tournament_team_members tm
    join public.tournament_teams tt on tt.id = tm.team_id
    where tt.tournament_id = p_tournament_id and tm.profile_id = (select auth.uid()) and tm.status <> 'rejected'
  ) or exists (
    select 1 from public.tournament_free_players fp
    where fp.tournament_id = p_tournament_id and fp.profile_id = (select auth.uid()) and fp.status in ('active', 'waitlisted')
  );
$$;

create or replace function public.set_tournament_visibility(p_tournament_id uuid, p_visibility public.match_visibility)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  update public.tournaments set visibility = p_visibility, updated_at = now()
  where id = p_tournament_id and (organizer_id = v_uid or public.is_admin());
  if not found then raise exception 'Solo l''organizzatore puo cambiare la visibilita'; end if;
end;
$$;

drop policy if exists "tournaments_select_visible" on public.tournaments;
create policy "tournaments_select_visible" on public.tournaments for select to authenticated
using (
  public.is_active_user() and (
    public.is_admin()
    or organizer_id = (select auth.uid())
    or public.is_tournament_participant(id)
    or (visibility = 'public' and status <> 'draft')
  )
);

revoke all on function public.set_match_visibility(uuid, public.match_visibility) from public;
revoke all on function public.is_tournament_participant(uuid) from public;
revoke all on function public.set_tournament_visibility(uuid, public.match_visibility) from public;
grant execute on function public.set_match_visibility(uuid, public.match_visibility),
  public.set_tournament_visibility(uuid, public.match_visibility),
  public.is_tournament_participant(uuid) to authenticated;

-- ---- Storage: bucket foto profilo ----
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

do $$ begin
  create policy "avatars_public_read" on storage.objects for select using (bucket_id = 'avatars');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "avatars_insert_own" on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "avatars_update_own" on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "avatars_delete_own" on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
