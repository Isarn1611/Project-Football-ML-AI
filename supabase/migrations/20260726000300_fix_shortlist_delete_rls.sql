grant delete on table public.player_shortlist to authenticated;

drop policy if exists "Users can delete their own shortlist"
  on public.player_shortlist;

create policy "Users can delete their own shortlist"
on public.player_shortlist
for delete
to authenticated
using ((select auth.uid()) = user_id);
