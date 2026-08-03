insert into storage.buckets (id, name, public)
values ('player-images', 'player-images', true)
on conflict (id) do update
  set public = true,
      name = excluded.name;

drop policy if exists "Public read access for player-images" on storage.objects;

create policy "Public read access for player-images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'player-images');

