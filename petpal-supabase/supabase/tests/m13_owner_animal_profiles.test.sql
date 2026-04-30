begin;

select plan(18);

select has_table('public', 'owner_animal_profiles', 'owner animal profile table exists');
select has_view('public', 'my_animal_profiles_view', 'my animal profiles view exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.owner_animal_profiles'::regclass),
  'owner animal profiles have RLS enabled'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'owner_animal_profiles'
      and policyname = 'owner_animal_profiles_self_read'
  ),
  'owner animal profile read policy is self-scoped'
);

select has_function(
  'public',
  'upsert_owner_animal_profile',
  ARRAY[
    'uuid',
    'text',
    'public.species',
    'text',
    'boolean',
    'integer',
    'text',
    'text',
    'numeric',
    'text',
    'text',
    'text[]',
    'text',
    'boolean',
    'boolean',
    'boolean',
    'text',
    'text',
    'text[]',
    'text[]'
  ],
  'owner animal profile upsert RPC exists'
);

select is(
  (
    select count(*)::integer
    from public.owner_animal_profiles
    where owner_id = '10000000-0000-4000-8000-000000000002'
  ),
  2,
  'seed includes two owner animal profiles for demo adopter'
);

select ok(
  exists (
    select 1
    from public.owner_animal_profiles
    where owner_id = '10000000-0000-4000-8000-000000000002'
      and name = 'Max'
      and active_match_modes @> array['PLAY', 'SOCIAL', 'VERIFIED_MATE']
  ),
  'demo Max profile has match modes'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'my_animal_profiles_view'
      and column_name in ('exact_location', 'private_notes', 'internal_health_notes')
  ),
  'my animal profile view excludes private rescue/listing fields'
);

select ok(
  exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'my_animal_profiles_view'
      and grantee = 'authenticated'
      and privilege_type = 'SELECT'
  ),
  'authenticated role can select from my animal profiles view'
);

select lives_ok(
  $$
  set local role authenticated;
  set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';

  select public.upsert_owner_animal_profile(
    null,
    'Milo',
    'CAT',
    'European Shorthair',
    false,
    14,
    'MALE',
    'SMALL',
    4.2,
    'YES',
    'UP_TO_DATE',
    array['calm', 'clean'],
    'LOW',
    false,
    true,
    true,
    'Bucharest',
    'Sector 6',
    array['https://example.com/milo.jpg'],
    array['SOCIAL']
  );
  $$,
  'authenticated owner can create own animal profile through RPC'
);

select ok(
  exists (
    select 1
    from public.owner_animal_profiles
    where owner_id = '10000000-0000-4000-8000-000000000002'
      and name = 'Milo'
      and profile_completeness >= 90
  ),
  'RPC calculates completeness for created profile'
);

select lives_ok(
  $$
  set local role authenticated;
  set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';

  update public.owner_animal_profiles
  set name = 'Max Updated'
  where id = '50000000-0000-4000-8000-000000000001';
  $$,
  'owner can update own animal profile'
);

select lives_ok(
  $$
  set local role authenticated;
  set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';

  update public.owner_animal_profiles
  set name = 'Wrong Owner Update'
  where id = '50000000-0000-4000-8000-000000000002';
  $$,
  'wrong owner update attempts do not raise, but RLS affects zero rows'
);

reset role;

select is(
  (
    select name
    from public.owner_animal_profiles
    where id = '50000000-0000-4000-8000-000000000002'
  ),
  'Bella',
  'wrong owner did not mutate Bella'
);

select throws_ok(
  $$
  set local role authenticated;
  set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';

  select public.upsert_owner_animal_profile(
    '50000000-0000-4000-8000-000000000002',
    'Bella Stolen',
    'CAT',
    'European Shorthair',
    false,
    18,
    'FEMALE',
    'SMALL',
    4,
    'YES',
    'UP_TO_DATE',
    array['calm'],
    'LOW',
    false,
    true,
    true,
    'Bucharest',
    'Sector 6',
    array[]::text[],
    array['SOCIAL']
  );
  $$,
  'Animal profile not found',
  'RPC cannot update another owner animal'
);

select is(
  (
    select count(*)::integer
    from public.my_animal_profiles_view
  ),
  0,
  'my animal profiles view returns no rows without auth context'
);

select lives_ok(
  $$
  set local role authenticated;
  set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';

  select *
  from public.my_animal_profiles_view
  where name = 'Max Updated';
  $$,
  'authenticated owner can read own animal profile view'
);

select ok(
  exists (
    select 1
    from public.owner_animal_profiles
    where name = 'Max Updated'
      and owner_id = '10000000-0000-4000-8000-000000000002'
  ),
  'self update persisted for Max'
);

select * from finish();

rollback;
