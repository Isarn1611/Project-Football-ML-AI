insert into storage.buckets (id, name, public)
values ('club-logos', 'club-logos', true)
on conflict (id) do update
  set public = true,
      name = excluded.name;

drop policy if exists "Public read access for club-logos" on storage.objects;

create policy "Public read access for club-logos"
  on storage.objects
  for select
  to public
  using (bucket_id = 'club-logos');
