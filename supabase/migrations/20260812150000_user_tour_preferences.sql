create table if not exists public.user_tour_preferences (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tour_id text not null check (char_length(tour_id) between 1 and 100),
  has_seen boolean not null default false,
  seen_at timestamptz,
  primary key (profile_id, tour_id)
);

alter table public.user_tour_preferences enable row level security;

create policy "Users can read their tour preferences" on public.user_tour_preferences
for select to authenticated using (profile_id = auth.uid());
create policy "Users can create their tour preferences" on public.user_tour_preferences
for insert to authenticated with check (profile_id = auth.uid());
create policy "Users can update their tour preferences" on public.user_tour_preferences
for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

grant select, insert, update on public.user_tour_preferences to authenticated;
