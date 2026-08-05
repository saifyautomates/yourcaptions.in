drop policy if exists "hero-media public read" on storage.objects;
create policy "hero-media public read" on storage.objects for select to anon, authenticated
using (bucket_id = 'hero-media');

drop policy if exists "hero-media admin write" on storage.objects;
create policy "hero-media admin write" on storage.objects for insert to authenticated
with check (bucket_id = 'hero-media' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "hero-media admin update" on storage.objects;
create policy "hero-media admin update" on storage.objects for update to authenticated
using (bucket_id = 'hero-media' and public.has_role(auth.uid(), 'admin'))
with check (bucket_id = 'hero-media' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "hero-media admin delete" on storage.objects;
create policy "hero-media admin delete" on storage.objects for delete to authenticated
using (bucket_id = 'hero-media' and public.has_role(auth.uid(), 'admin'));