begin;

select plan(8);

create or replace function public.test_storage_bucket_public(bucket_id_input text)
returns boolean
language plpgsql
as $$
declare
  result boolean;
begin
  if to_regclass('storage.buckets') is null then
    return true;
  end if;

  execute 'select exists (select 1 from storage.buckets where id = $1 and public = true)'
  using bucket_id_input
  into result;

  return result;
end;
$$;

select ok(
  public.test_storage_bucket_public('animal-photos'),
  'animal photos bucket is public when storage schema is available'
);

select ok(
  to_regclass('storage.objects') is null
  or exists (
      select 1
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname = 'animal_photos_public_read'
    ),
  'animal photos have a public read policy when storage schema is available'
);

select ok(
  to_regclass('storage.objects') is null
  or exists (
      select 1
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname = 'animal_photos_owner_insert'
    ),
  'animal photos have owner-scoped insert policy when storage schema is available'
);

select ok(
  to_regclass('storage.objects') is null
  or exists (
      select 1
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname = 'animal_photos_owner_delete'
    ),
  'animal photos have owner-scoped delete policy when storage schema is available'
);

select has_function(
  'public',
  'delete_owner_animal_profile',
  ARRAY['uuid'],
  'owner animal delete RPC exists'
);

select lives_ok(
  $$
  set local role authenticated;
  set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';

  select public.delete_owner_animal_profile('50000000-0000-4000-8000-000000000002');
  $$,
  'owner can delete own animal profile through RPC'
);

reset role;

select ok(
  not exists (
    select 1
    from public.owner_animal_profiles
    where id = '50000000-0000-4000-8000-000000000002'
  ),
  'deleted animal profile is gone'
);

select throws_ok(
  $$
  set local role authenticated;
  set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';

  select public.delete_owner_animal_profile('50000000-0000-4000-8000-000000000001');
  $$,
  'Animal profile not found',
  'wrong owner cannot delete animal profile through RPC'
);

select * from finish();

rollback;
