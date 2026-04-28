begin;

select plan(12);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.organizations'::regclass),
  'organizations has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.animals'::regclass),
  'animals has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.animal_listings'::regclass),
  'animal_listings has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.applications'::regclass),
  'applications has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.messages'::regclass),
  'messages has RLS enabled'
);

select ok(
  exists (select 1 from pg_views where schemaname = 'public' and viewname = 'listing_public_view'),
  'safe public listing view exists'
);

select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'applications'),
  'applications has RLS policies'
);

select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'verification_documents'),
  'verification_documents has RLS policies'
);

select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reports'),
  'reports has RLS policies'
);

select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conversation_participants'),
  'conversation_participants has RLS policies'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listing_public_view'
      and column_name like '%exact%'
  ),
  'public listing view does not expose exact location'
);

select * from finish();

rollback;

