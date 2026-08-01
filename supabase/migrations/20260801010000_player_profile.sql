create type public.preferred_side as enum ('sinistra', 'destra', 'indifferente');

alter table public.profiles
  add column lato_preferito public.preferred_side not null default 'indifferente',
  add column avatar_url text,
  add column autovalutazione smallint not null default 1
    check (autovalutazione between 1 and 7),
  add constraint profiles_avatar_url_check check (
    avatar_url is null
    or (char_length(avatar_url) <= 2048 and avatar_url ~* '^https://')
  );

update public.profiles
set autovalutazione = livello;

comment on column public.profiles.livello is
  'Livello calcolato corrente. Non e modificabile dal giocatore.';
comment on column public.profiles.autovalutazione is
  'Livello dichiarato dal giocatore, da 1 a 7.';

create table public.profile_level_history (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  autovalutazione smallint not null check (autovalutazione between 1 and 7),
  livello_calcolato numeric(3, 2) not null check (livello_calcolato between 1 and 7),
  motivo text not null default 'aggiornamento_profilo'
    check (char_length(motivo) between 1 and 120),
  created_at timestamptz not null default now()
);

create index profile_level_history_profile_created_idx
  on public.profile_level_history (profile_id, created_at desc);

create table public.profile_reliability_history (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  affidabilita numeric(3, 2) not null check (affidabilita between 1 and 7),
  variazione numeric(3, 2) not null default 0,
  motivo text not null default 'valore_iniziale'
    check (char_length(motivo) between 1 and 120),
  created_at timestamptz not null default now()
);

create index profile_reliability_history_profile_created_idx
  on public.profile_reliability_history (profile_id, created_at desc);

insert into public.profile_level_history (
  profile_id,
  autovalutazione,
  livello_calcolato,
  motivo,
  created_at
)
select id, autovalutazione, livello, 'valore_iniziale', created_at
from public.profiles;

insert into public.profile_reliability_history (
  profile_id,
  affidabilita,
  variazione,
  motivo,
  created_at
)
select id, affidabilita, 0, 'valore_iniziale', created_at
from public.profiles;

alter table public.profile_level_history enable row level security;
alter table public.profile_reliability_history enable row level security;

create policy "profile_level_history_select_own_or_admin"
on public.profile_level_history
for select
to authenticated
using ((select auth.uid()) = profile_id or public.is_admin());

create policy "profile_reliability_history_select_own_or_admin"
on public.profile_reliability_history
for select
to authenticated
using ((select auth.uid()) = profile_id or public.is_admin());

grant select on public.profile_level_history to authenticated;
grant select on public.profile_reliability_history to authenticated;

create or replace function public.initialize_profile_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile_level_history (
    profile_id,
    autovalutazione,
    livello_calcolato,
    motivo
  ) values (new.id, new.autovalutazione, new.livello, 'valore_iniziale');

  insert into public.profile_reliability_history (
    profile_id,
    affidabilita,
    variazione,
    motivo
  ) values (new.id, new.affidabilita, 0, 'valore_iniziale');

  return new;
end;
$$;

create trigger profiles_initialize_history
after insert on public.profiles
for each row execute procedure public.initialize_profile_history();

revoke all on function public.initialize_profile_history() from public;

revoke update on public.profiles from authenticated;

drop function if exists public.update_my_profile(text, text, smallint);

create or replace function public.update_my_profile(
  p_nome text,
  p_cognome text,
  p_lato_preferito public.preferred_side,
  p_avatar_url text,
  p_autovalutazione smallint
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile public.profiles;
  updated_profile public.profiles;
  normalized_avatar_url text := nullif(trim(p_avatar_url), '');
begin
  if (select auth.uid()) is null then
    raise exception 'Autenticazione richiesta';
  end if;

  if p_nome is null
     or p_cognome is null
     or p_autovalutazione is null
     or char_length(trim(p_nome)) not between 1 and 80
     or char_length(trim(p_cognome)) not between 1 and 80
     or p_lato_preferito is null
     or p_autovalutazione not between 1 and 7
     or (normalized_avatar_url is not null and (
       char_length(normalized_avatar_url) > 2048
       or normalized_avatar_url !~* '^https://'
     )) then
    raise exception 'Dati profilo non validi';
  end if;

  select *
  into current_profile
  from public.profiles
  where id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Profilo non trovato';
  end if;

  update public.profiles
  set nome = trim(p_nome),
      cognome = trim(p_cognome),
      lato_preferito = p_lato_preferito,
      avatar_url = normalized_avatar_url,
      autovalutazione = p_autovalutazione
  where id = (select auth.uid())
  returning * into updated_profile;

  if current_profile.autovalutazione is distinct from p_autovalutazione then
    insert into public.profile_level_history (
      profile_id,
      autovalutazione,
      livello_calcolato,
      motivo
    ) values (
      updated_profile.id,
      updated_profile.autovalutazione,
      updated_profile.livello,
      'autovalutazione_aggiornata'
    );
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.update_my_profile(
  text,
  text,
  public.preferred_side,
  text,
  smallint
) from public;
grant execute on function public.update_my_profile(
  text,
  text,
  public.preferred_side,
  text,
  smallint
) to authenticated;
