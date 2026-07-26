alter table public.player_search_history enable row level security;

grant usage on schema public to authenticated;
grant select, insert, delete
  on public.player_search_history to authenticated;

alter table public.player_search_history
  alter column user_id set default (auth.uid());

create or replace function public.set_search_history_user_id()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id = auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists set_player_search_history_user_id
  on public.player_search_history;

create trigger set_player_search_history_user_id
before insert on public.player_search_history
for each row
execute function public.set_search_history_user_id();

drop policy if exists "Users can read their own search history"
  on public.player_search_history;
drop policy if exists "Users can add their own search history"
  on public.player_search_history;
drop policy if exists "Users can delete their own search history"
  on public.player_search_history;

create policy "Users can read their own search history"
on public.player_search_history
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can add their own search history"
on public.player_search_history
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own search history"
on public.player_search_history
for delete
to authenticated
using ((select auth.uid()) = user_id);
