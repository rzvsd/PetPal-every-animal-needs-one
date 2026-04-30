do $$
begin
  if to_regclass('storage.buckets') is not null
     and to_regclass('storage.objects') is not null then
    execute $storage$
      update storage.buckets
      set public = true
      where id = 'animal-photos'
    $storage$;

    execute $storage$
      drop policy if exists animal_photos_public_read on storage.objects
    $storage$;

    execute $storage$
      drop policy if exists animal_photos_owner_insert on storage.objects
    $storage$;

    execute $storage$
      drop policy if exists animal_photos_owner_update on storage.objects
    $storage$;

    execute $storage$
      drop policy if exists animal_photos_owner_delete on storage.objects
    $storage$;

    execute $storage$
      create policy animal_photos_public_read
      on storage.objects for select to anon, authenticated
      using (bucket_id = 'animal-photos')
    $storage$;

    execute $storage$
      create policy animal_photos_owner_insert
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'animal-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    $storage$;

    execute $storage$
      create policy animal_photos_owner_update
      on storage.objects for update to authenticated
      using (
        bucket_id = 'animal-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'animal-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    $storage$;

    execute $storage$
      create policy animal_photos_owner_delete
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'animal-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    $storage$;
  end if;
end $$;

create or replace function public.delete_owner_animal_profile(
  animal_id_input uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  deleted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.owner_animal_profiles
  where id = animal_id_input
    and owner_id = auth.uid()
  returning id into deleted_id;

  if deleted_id is null then
    raise exception 'Animal profile not found';
  end if;
end;
$$;
