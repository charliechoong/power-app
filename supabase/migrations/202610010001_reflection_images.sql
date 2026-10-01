begin;

alter table public.reflections
  add column image_path text check (image_path is null or length(image_path) between 1 and 300),
  add column image_caption text not null default '' check (length(image_caption) <= 300),
  add constraint reflection_image_only check (kind = 'reflection' or (image_path is null and image_caption = ''));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reflection-images', 'reflection-images', true, 2000000, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2000000,
  allowed_mime_types = array['image/webp'];

create policy owner_insert_reflection_images on storage.objects
  for insert to authenticated
  with check (bucket_id = 'reflection-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_app_owner()));
create policy owner_select_reflection_images on storage.objects
  for select to authenticated
  using (bucket_id = 'reflection-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_app_owner()));
create policy owner_delete_reflection_images on storage.objects
  for delete to authenticated
  using (bucket_id = 'reflection-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_app_owner()));

commit;
