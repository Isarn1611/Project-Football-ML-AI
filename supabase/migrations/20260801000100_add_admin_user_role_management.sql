grant select, update on table public.user_roles
  to service_role;

grant select, insert on table public.admin_audit_logs
  to service_role;

create or replace function public.admin_set_user_role(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_role public.app_role
)
returns public.user_roles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_role public.app_role;
  previous_role public.user_roles%rowtype;
  changed_role public.user_roles%rowtype;
begin
  select role
  into actor_role
  from public.user_roles
  where user_id = p_actor_user_id;

  if actor_role is distinct from 'admin'::public.app_role then
    raise exception 'ACTOR_NOT_ADMIN' using errcode = 'P0001';
  end if;

  if p_actor_user_id = p_target_user_id
    and p_role <> 'admin'::public.app_role then
    raise exception 'CANNOT_CHANGE_OWN_ROLE' using errcode = 'P0001';
  end if;

  select *
  into previous_role
  from public.user_roles
  where user_id = p_target_user_id
  for update;

  if not found then
    raise exception 'USER_ROLE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if previous_role.role = p_role then
    return previous_role;
  end if;

  update public.user_roles
  set role = p_role
  where user_id = p_target_user_id
  returning * into changed_role;

  insert into public.admin_audit_logs (
    admin_user_id,
    action,
    target_type,
    target_id,
    before_data,
    after_data,
    metadata
  )
  values (
    p_actor_user_id,
    'user.role_updated',
    'user',
    p_target_user_id::text,
    jsonb_build_object('role', previous_role.role),
    jsonb_build_object('role', changed_role.role),
    jsonb_build_object('source', 'admin_api')
  );

  return changed_role;
end;
$$;

revoke execute on function public.admin_set_user_role(uuid, uuid, public.app_role)
  from public, anon, authenticated;

grant execute on function public.admin_set_user_role(uuid, uuid, public.app_role)
  to service_role;

comment on function public.admin_set_user_role(uuid, uuid, public.app_role) is
  'Atomically changes an application role and records the admin action.';

