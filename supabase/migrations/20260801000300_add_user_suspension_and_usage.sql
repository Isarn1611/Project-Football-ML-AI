alter table public.user_roles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references auth.users(id) on delete set null,
  add column if not exists suspension_reason text;

create index if not exists user_roles_suspended_idx
  on public.user_roles (suspended_at)
  where suspended_at is not null;

create table if not exists public.api_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  method text not null,
  endpoint text not null,
  status_code integer not null,
  duration_ms integer not null default 0,
  ai_provider text,
  ai_model text,
  prompt_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint api_usage_events_status_check
    check (status_code between 100 and 599),
  constraint api_usage_events_duration_check
    check (duration_ms >= 0),
  constraint api_usage_events_token_check
    check (
      prompt_tokens >= 0
      and output_tokens >= 0
      and total_tokens >= 0
    )
);

create index if not exists api_usage_events_user_created_idx
  on public.api_usage_events (user_id, created_at desc);

create index if not exists api_usage_events_endpoint_created_idx
  on public.api_usage_events (endpoint, created_at desc);

alter table public.api_usage_events enable row level security;

revoke all on table public.api_usage_events
  from anon, authenticated;

grant select, insert on table public.api_usage_events
  to service_role;

grant select, update on table public.user_roles
  to service_role;

create or replace function public.admin_set_user_suspension(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_suspended boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_access public.user_roles%rowtype;
  previous_access public.user_roles%rowtype;
  changed_access public.user_roles%rowtype;
  cleaned_reason text;
begin
  select *
  into actor_access
  from public.user_roles
  where user_id = p_actor_user_id;

  if actor_access.role is distinct from 'admin'::public.app_role
    or actor_access.suspended_at is not null then
    raise exception 'ACTOR_NOT_ADMIN' using errcode = 'P0001';
  end if;

  if p_actor_user_id = p_target_user_id and p_suspended then
    raise exception 'CANNOT_SUSPEND_SELF' using errcode = 'P0001';
  end if;

  cleaned_reason := nullif(btrim(coalesce(p_reason, '')), '');

  if cleaned_reason is not null and char_length(cleaned_reason) > 500 then
    raise exception 'INVALID_SUSPENSION_REASON' using errcode = 'P0001';
  end if;

  select *
  into previous_access
  from public.user_roles
  where user_id = p_target_user_id
  for update;

  if not found then
    raise exception 'USER_ROLE_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.user_roles
  set
    suspended_at = case when p_suspended then now() else null end,
    suspended_by = case when p_suspended then p_actor_user_id else null end,
    suspension_reason = case when p_suspended then cleaned_reason else null end
  where user_id = p_target_user_id
  returning * into changed_access;

  if row(
    previous_access.suspended_at,
    previous_access.suspension_reason
  ) is distinct from row(
    changed_access.suspended_at,
    changed_access.suspension_reason
  ) then
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
      case when p_suspended then 'user.suspended' else 'user.reactivated' end,
      'user',
      p_target_user_id::text,
      jsonb_build_object(
        'suspendedAt', previous_access.suspended_at,
        'reason', previous_access.suspension_reason
      ),
      jsonb_build_object(
        'suspendedAt', changed_access.suspended_at,
        'reason', changed_access.suspension_reason
      ),
      jsonb_build_object('source', 'admin_api')
    );
  end if;

  return jsonb_build_object(
    'userId', changed_access.user_id,
    'role', changed_access.role,
    'suspendedAt', changed_access.suspended_at,
    'suspensionReason', changed_access.suspension_reason
  );
end;
$$;

revoke execute on function public.admin_set_user_suspension(uuid, uuid, boolean, text)
  from public, anon, authenticated;

grant execute on function public.admin_set_user_suspension(uuid, uuid, boolean, text)
  to service_role;

create or replace function public.admin_get_user_usage(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_days integer default 30
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  actor_access public.user_roles%rowtype;
  period_days integer;
  period_start timestamptz;
begin
  select *
  into actor_access
  from public.user_roles
  where user_id = p_actor_user_id;

  if actor_access.role is distinct from 'admin'::public.app_role
    or actor_access.suspended_at is not null then
    raise exception 'ACTOR_NOT_ADMIN' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.user_roles where user_id = p_target_user_id
  ) then
    raise exception 'USER_ROLE_NOT_FOUND' using errcode = 'P0001';
  end if;

  period_days := least(greatest(coalesce(p_days, 30), 1), 365);
  period_start := now() - make_interval(days => period_days);

  return (
    with lifetime as (
      select
        count(*) as request_count,
        count(*) filter (where ai_provider is not null) as ai_request_count,
        coalesce(sum(prompt_tokens), 0) as prompt_tokens,
        coalesce(sum(output_tokens), 0) as output_tokens,
        coalesce(sum(total_tokens), 0) as total_tokens,
        max(created_at) as last_active_at
      from public.api_usage_events
      where user_id = p_target_user_id
    ),
    period as (
      select
        count(*) as request_count,
        count(*) filter (where ai_provider is not null) as ai_request_count,
        coalesce(sum(prompt_tokens), 0) as prompt_tokens,
        coalesce(sum(output_tokens), 0) as output_tokens,
        coalesce(sum(total_tokens), 0) as total_tokens,
        coalesce(round(avg(duration_ms)), 0) as average_duration_ms
      from public.api_usage_events
      where user_id = p_target_user_id
        and created_at >= period_start
    ),
    endpoint_rows as (
      select
        endpoint,
        count(*) as request_count,
        coalesce(sum(total_tokens), 0) as total_tokens
      from public.api_usage_events
      where user_id = p_target_user_id
        and created_at >= period_start
      group by endpoint
      order by request_count desc, endpoint
    ),
    daily_rows as (
      select
        date_trunc('day', created_at) as day,
        count(*) as request_count,
        coalesce(sum(total_tokens), 0) as total_tokens
      from public.api_usage_events
      where user_id = p_target_user_id
        and created_at >= period_start
      group by date_trunc('day', created_at)
      order by day
    ),
    recent_rows as (
      select
        endpoint,
        method,
        status_code,
        duration_ms,
        ai_provider,
        ai_model,
        prompt_tokens,
        output_tokens,
        total_tokens,
        created_at
      from public.api_usage_events
      where user_id = p_target_user_id
      order by created_at desc
      limit 25
    )
    select jsonb_build_object(
      'userId', p_target_user_id,
      'periodDays', period_days,
      'periodStart', period_start,
      'lifetime', jsonb_build_object(
        'requests', lifetime.request_count,
        'aiRequests', lifetime.ai_request_count,
        'promptTokens', lifetime.prompt_tokens,
        'outputTokens', lifetime.output_tokens,
        'totalTokens', lifetime.total_tokens,
        'lastActiveAt', lifetime.last_active_at
      ),
      'period', jsonb_build_object(
        'requests', period.request_count,
        'aiRequests', period.ai_request_count,
        'promptTokens', period.prompt_tokens,
        'outputTokens', period.output_tokens,
        'totalTokens', period.total_tokens,
        'averageDurationMs', period.average_duration_ms
      ),
      'endpoints', coalesce((
        select jsonb_agg(jsonb_build_object(
          'endpoint', endpoint,
          'requests', request_count,
          'totalTokens', total_tokens
        )) from endpoint_rows
      ), '[]'::jsonb),
      'daily', coalesce((
        select jsonb_agg(jsonb_build_object(
          'date', to_char(day, 'YYYY-MM-DD'),
          'requests', request_count,
          'totalTokens', total_tokens
        )) from daily_rows
      ), '[]'::jsonb),
      'recent', coalesce((
        select jsonb_agg(jsonb_build_object(
          'endpoint', endpoint,
          'method', method,
          'statusCode', status_code,
          'durationMs', duration_ms,
          'provider', ai_provider,
          'model', ai_model,
          'promptTokens', prompt_tokens,
          'outputTokens', output_tokens,
          'totalTokens', total_tokens,
          'createdAt', created_at
        )) from recent_rows
      ), '[]'::jsonb)
    )
    from lifetime, period
  );
end;
$$;

revoke execute on function public.admin_get_user_usage(uuid, uuid, integer)
  from public, anon, authenticated;

grant execute on function public.admin_get_user_usage(uuid, uuid, integer)
  to service_role;

