create table public.profile_admin_audit (
  id bigint generated always as identity primary key,
  target_profile_id uuid not null references public.profiles(id) on delete restrict,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  previous_role public.user_role not null,
  new_role public.user_role not null,
  previous_active boolean not null,
  new_active boolean not null,
  created_at timestamptz not null default now()
);

create index profile_admin_audit_created_idx
  on public.profile_admin_audit (created_at desc);

create index profile_admin_audit_target_created_idx
  on public.profile_admin_audit (target_profile_id, created_at desc);

alter table public.profile_admin_audit enable row level security;

create policy "profile_admin_audit_select_admin"
on public.profile_admin_audit
for select
to authenticated
using (public.is_admin());

grant select on public.profile_admin_audit to authenticated;

create or replace function public.admin_update_profile_access(
  p_profile_id uuid,
  p_attivo boolean,
  p_ruolo public.user_role
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_profile public.profiles;
  updated_profile public.profiles;
begin
  if actor_id is null or not public.is_admin() then
    raise exception 'Operazione riservata agli amministratori';
  end if;

  if p_profile_id is null or p_attivo is null or p_ruolo is null then
    raise exception 'Dati amministrativi non validi';
  end if;

  select *
  into current_profile
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'Profilo non trovato';
  end if;

  if p_profile_id = actor_id
     and (current_profile.attivo is distinct from p_attivo
       or current_profile.ruolo is distinct from p_ruolo) then
    raise exception 'Non puoi modificare il tuo accesso amministrativo';
  end if;

  if current_profile.attivo is not distinct from p_attivo
     and current_profile.ruolo is not distinct from p_ruolo then
    return current_profile;
  end if;

  update public.profiles
  set attivo = p_attivo,
      ruolo = p_ruolo
  where id = p_profile_id
  returning * into updated_profile;

  insert into public.profile_admin_audit (
    target_profile_id,
    actor_profile_id,
    previous_role,
    new_role,
    previous_active,
    new_active
  ) values (
    p_profile_id,
    actor_id,
    current_profile.ruolo,
    updated_profile.ruolo,
    current_profile.attivo,
    updated_profile.attivo
  );

  return updated_profile;
end;
$$;

revoke all on function public.admin_update_profile_access(
  uuid,
  boolean,
  public.user_role
) from public;
grant execute on function public.admin_update_profile_access(
  uuid,
  boolean,
  public.user_role
) to authenticated;

comment on function public.admin_update_profile_access(uuid, boolean, public.user_role) is
  'Aggiorna attivazione e ruolo tramite un amministratore, impedisce il self-lockout e registra un audit immutabile.';
