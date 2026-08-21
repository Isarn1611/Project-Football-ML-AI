alter table public.player_search_history
  add column if not exists search_count integer not null default 1,
  add column if not exists last_searched_at timestamptz;

update public.player_search_history
set last_searched_at = created_at
where last_searched_at is null;

alter table public.player_search_history
  alter column last_searched_at set default now(),
  alter column last_searched_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_search_history_search_count_check'
      and conrelid = 'public.player_search_history'::regclass
  ) then
    alter table public.player_search_history
      add constraint player_search_history_search_count_check
      check (search_count > 0);
  end if;
end;
$$;

create index if not exists player_search_history_last_searched_idx
  on public.player_search_history (last_searched_at desc);

create or replace function public.record_player_search(
  p_query text,
  p_status text default 'searched',
  p_result_count integer default null,
  p_error_message text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.player_search_history
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid;
  cleaned_query text;
  cleaned_status text;
  saved_row public.player_search_history%rowtype;
begin
  current_user_id := auth.uid();
  cleaned_query := btrim(coalesce(p_query, ''));
  cleaned_status := coalesce(p_status, 'searched');

  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = 'P0001';
  end if;

  if cleaned_query = '' then
    raise exception 'SEARCH_QUERY_REQUIRED' using errcode = 'P0001';
  end if;

  if cleaned_status not in ('searched', 'success', 'error') then
    raise exception 'INVALID_SEARCH_STATUS' using errcode = 'P0001';
  end if;

  insert into public.player_search_history (
    user_id,
    query,
    status,
    result_count,
    error_message,
    metadata,
    search_count,
    created_at,
    last_searched_at
  ) values (
    current_user_id,
    cleaned_query,
    cleaned_status,
    p_result_count,
    nullif(btrim(coalesce(p_error_message, '')), ''),
    coalesce(p_metadata, '{}'::jsonb),
    1,
    now(),
    now()
  )
  on conflict (user_id, query)
  do update set
    status = excluded.status,
    result_count = excluded.result_count,
    error_message = excluded.error_message,
    metadata = excluded.metadata,
    search_count = public.player_search_history.search_count + 1,
    last_searched_at = now()
  returning * into saved_row;

  return saved_row;
end;
$$;

revoke execute on function public.record_player_search(text, text, integer, text, jsonb)
  from public, anon;

grant execute on function public.record_player_search(text, text, integer, text, jsonb)
  to authenticated;
