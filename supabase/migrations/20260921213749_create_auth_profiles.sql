-- Recovered from applied Supabase migration history on 2026-10-04.
begin;

create schema if not exists private;
revoke all on schema private from public;

-- Application roles are deliberately separate from Supabase's/Postgres's
-- built-in authenticated role.
do $enum$
begin
  create type public.app_role as enum (
    'pending',
    'admin',
    'business_development',
    'clinical',
    'finance',
    'read_only',
    'client'
  );
exception
  when duplicate_object then null;
end
$enum$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role public.app_role not null default 'pending'::public.app_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (
    full_name is null or char_length(full_name) <= 200
  )
);

comment on table public.profiles is
  'Clinical SOS application profiles. Role is server-managed authorization data.';
comment on column public.profiles.role is
  'Server-managed application role; never accepted from user metadata or browser writes.';

alter table public.profiles enable row level security;

-- Table SELECT plus RLS permits self-read. Column-level UPDATE permits editing
-- full_name, while role and other protected fields remain server-owned.
revoke all privileges on table public.profiles from public, anon, authenticated;
revoke update (id, email, full_name, role, created_at, updated_at)
  on public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

revoke all privileges on type public.app_role from public;
grant usage on type public.app_role to authenticated, service_role;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists profiles_update_own_name on public.profiles;
create policy profiles_update_own_name
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function private.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function private.set_profile_updated_at() from public, anon, authenticated;

drop trigger if exists clinical_sos_profile_updated_at on public.profiles;
create trigger clinical_sos_profile_updated_at
  before update on public.profiles
  for each row
  execute function private.set_profile_updated_at();

-- Signup runs against auth.users, so the internal trigger must bypass profile
-- RLS. The empty search path and fully qualified names keep it constrained.
create or replace function private.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(
      left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 200),
      ''
    ),
    'pending'::public.app_role
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$function$;

revoke all on function private.sync_profile_from_auth() from public, anon, authenticated;

drop trigger if exists clinical_sos_auth_user_created on auth.users;
create trigger clinical_sos_auth_user_created
  after insert on auth.users
  for each row
  execute function private.sync_profile_from_auth();

drop trigger if exists clinical_sos_auth_user_email_changed on auth.users;
create trigger clinical_sos_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_profile_from_auth();

-- Backfill users that predate this migration without overwriting role/name.
insert into public.profiles (id, email, full_name, role, created_at, updated_at)
select
  u.id,
  u.email,
  nullif(
    left(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), 200),
    ''
  ),
  'pending'::public.app_role,
  coalesce(u.created_at, now()),
  now()
from auth.users as u
on conflict (id) do update
  set email = excluded.email;

commit;

