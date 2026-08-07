-- Logo della societa organizzante, mostrato nella testata del torneo.
alter table public.tournaments
  add column if not exists organizer_logo_url text;
alter table public.tournaments drop constraint if exists tournaments_logo_url_check;
alter table public.tournaments
  add constraint tournaments_logo_url_check
  check (organizer_logo_url is null or organizer_logo_url ~* '^https://.+');

create or replace function public.set_tournament_logo(p_tournament_id uuid, p_logo_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.tournaments := public.assert_tournament_organizer(p_tournament_id);
begin
  update public.tournaments
    set organizer_logo_url = nullif(btrim(coalesce(p_logo_url, '')), '')
  where id = p_tournament_id;
end;
$$;

revoke all on function public.set_tournament_logo(uuid, text) from public;
grant execute on function public.set_tournament_logo(uuid, text) to authenticated;

-- Bucket pubblico per i loghi: scrittura solo a chi puo organizzare tornei.
insert into storage.buckets (id, name, public)
values ('tournament-logos', 'tournament-logos', true)
on conflict (id) do nothing;

drop policy if exists "tournament_logos_read" on storage.objects;
create policy "tournament_logos_read" on storage.objects
for select to public using (bucket_id = 'tournament-logos');

drop policy if exists "tournament_logos_write" on storage.objects;
create policy "tournament_logos_write" on storage.objects
for insert to authenticated
with check (bucket_id = 'tournament-logos' and public.can_organize_tournaments());

drop policy if exists "tournament_logos_update" on storage.objects;
create policy "tournament_logos_update" on storage.objects
for update to authenticated
using (bucket_id = 'tournament-logos' and public.can_organize_tournaments())
with check (bucket_id = 'tournament-logos' and public.can_organize_tournaments());

notify pgrst, 'reload schema';
