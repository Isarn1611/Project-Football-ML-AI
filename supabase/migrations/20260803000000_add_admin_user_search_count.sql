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
    search_lifetime as (
      select count(*) as search_count
      from public.player_search_history
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
        'searches', search_lifetime.search_count,
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
    from lifetime, search_lifetime, period
  );
end;
$$;

revoke execute on function public.admin_get_user_usage(uuid, uuid, integer)
  from public, anon, authenticated;

grant execute on function public.admin_get_user_usage(uuid, uuid, integer)
  to service_role;
