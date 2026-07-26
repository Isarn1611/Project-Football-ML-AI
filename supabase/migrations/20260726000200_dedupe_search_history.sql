with ranked_search_history as (
  select
    id,
    row_number() over (
      partition by user_id, query
      order by created_at desc, id desc
    ) as row_number
  from public.player_search_history
)
delete from public.player_search_history as history
using ranked_search_history as ranked
where history.id = ranked.id
  and ranked.row_number > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_search_history_user_query_key'
      and conrelid = 'public.player_search_history'::regclass
  ) then
    alter table public.player_search_history
      add constraint player_search_history_user_query_key
      unique (user_id, query);
  end if;
end;
$$;

grant select, insert, update, delete
  on public.player_search_history to authenticated;

drop policy if exists "Users can update their own search history"
  on public.player_search_history;

create policy "Users can update their own search history"
on public.player_search_history
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
