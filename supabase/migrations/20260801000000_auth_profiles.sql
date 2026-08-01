create type public.user_role as enum ('admin', 'giocatore');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  cognome text not null check (char_length(cognome) between 1 and 80),
  email text not null,
  ruolo public.user_role not null default 'giocatore',
  attivo boolean not null default false,
  livello smallint not null default 1 check (livello between 1 and 7),
  affidabilita numeric(3, 2) not null default 5.00 check (affidabilita between 1 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and ruolo = 'admin'
      and attivo = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id or public.is_admin());

create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, update on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nome, cognome, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), 'Giocatore'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'cognome'), ''), 'Beach Volley'),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create or replace function public.update_my_profile(
  p_nome text,
  p_cognome text,
  p_livello smallint
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_profile public.profiles;
begin
  if (select auth.uid()) is null then
    raise exception 'Autenticazione richiesta';
  end if;

  if char_length(trim(p_nome)) not between 1 and 80
     or char_length(trim(p_cognome)) not between 1 and 80
     or p_livello not between 1 and 7 then
    raise exception 'Dati profilo non validi';
  end if;

  update public.profiles
  set nome = trim(p_nome),
      cognome = trim(p_cognome),
      livello = p_livello
  where id = (select auth.uid())
  returning * into updated_profile;

  return updated_profile;
end;
$$;

revoke all on function public.update_my_profile(text, text, smallint) from public;
grant execute on function public.update_my_profile(text, text, smallint) to authenticated;
