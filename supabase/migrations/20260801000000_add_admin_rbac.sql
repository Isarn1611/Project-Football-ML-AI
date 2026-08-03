do $$
begin
  create type public.app_role as enum ('user', 'admin');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_logs_action_not_blank
    check (char_length(btrim(action)) > 0),
  constraint admin_audit_logs_target_type_not_blank
    check (char_length(btrim(target_type)) > 0)
);

create index if not exists user_roles_role_idx
  on public.user_roles (role);

create index if not exists admin_audit_logs_admin_created_idx
  on public.admin_audit_logs (admin_user_id, created_at desc);

create index if not exists admin_audit_logs_target_created_idx
  on public.admin_audit_logs (target_type, target_id, created_at desc);

drop trigger if exists set_user_roles_updated_at
  on public.user_roles;

create trigger set_user_roles_updated_at
before update on public.user_roles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user_role()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_created_add_role
  on auth.users;

create trigger on_auth_user_created_add_role
after insert on auth.users
for each row
execute function public.handle_new_user_role();

insert into public.user_roles (user_id, role)
select id, 'user'
from auth.users
on conflict (user_id) do nothing;

alter table public.user_roles enable row level security;
alter table public.admin_audit_logs enable row level security;

revoke all on table public.user_roles
  from anon, authenticated;

revoke all on table public.admin_audit_logs
  from anon, authenticated;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb;
  assigned_role public.app_role;
begin
  select role
  into assigned_role
  from public.user_roles
  where user_id = (event->>'user_id')::uuid;

  assigned_role := coalesce(assigned_role, 'user'::public.app_role);
  claims := coalesce(event->'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{user_role}', to_jsonb(assigned_role));

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant usage on type public.app_role to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb)
  to supabase_auth_admin;
grant select on table public.user_roles
  to supabase_auth_admin;

revoke execute on function public.custom_access_token_hook(jsonb)
  from public, anon, authenticated;

drop policy if exists "Auth hook can read user roles"
  on public.user_roles;

create policy "Auth hook can read user roles"
on public.user_roles
for select
to supabase_auth_admin
using (true);

comment on table public.user_roles is
  'Application role for each Supabase Auth user.';

comment on table public.admin_audit_logs is
  'Immutable audit trail written by trusted admin backend operations.';

