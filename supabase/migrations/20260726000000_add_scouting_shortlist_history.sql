create table if not exists public.player_shortlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  player_key text not null,
  player_uid text,
  player_name text not null,
  club text,
  position text,
  age integer,
  nationality text,
  market_value numeric,
  score numeric,
  source text not null default 'manual',
  notes text not null default '',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_shortlist_user_player_key_key unique (user_id, player_key)
);

create table if not exists public.player_search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  status text not null default 'searched',
  result_count integer,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint player_search_history_status_check
    check (status in ('searched', 'success', 'error'))
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_player_shortlist_updated_at
  on public.player_shortlist;

create trigger set_player_shortlist_updated_at
before update on public.player_shortlist
for each row
execute function public.set_updated_at();

create index if not exists player_shortlist_user_updated_idx
  on public.player_shortlist (user_id, updated_at desc);

create index if not exists player_shortlist_user_player_key_idx
  on public.player_shortlist (user_id, player_key);

create index if not exists player_search_history_user_created_idx
  on public.player_search_history (user_id, created_at desc);

alter table public.player_shortlist enable row level security;
alter table public.player_search_history enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.player_shortlist to authenticated;
grant select, insert, delete
  on public.player_search_history to authenticated;

drop policy if exists "Users can read their own shortlist"
  on public.player_shortlist;
drop policy if exists "Users can add their own shortlist"
  on public.player_shortlist;
drop policy if exists "Users can update their own shortlist"
  on public.player_shortlist;
drop policy if exists "Users can delete their own shortlist"
  on public.player_shortlist;

create policy "Users can read their own shortlist"
on public.player_shortlist
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can add their own shortlist"
on public.player_shortlist
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own shortlist"
on public.player_shortlist
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own shortlist"
on public.player_shortlist
for delete
to authenticated
using ((select auth.uid()) = user_id);

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
