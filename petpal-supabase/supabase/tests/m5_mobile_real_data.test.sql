begin;

select plan(19);

select is(
  (select count(*)::integer from public.discovery_listings_view),
  2,
  'seed exposes two active mobile discovery listings'
);

select is(
  (
    select count(*)::integer
    from public.discovery_listings_view
    where mode in ('ADOPT', 'FOSTER')
      and species in ('DOG', 'CAT')
      and city in ('Bucharest', 'Ilfov')
  ),
  2,
  'mobile discovery seed stays inside v1 launch boundaries'
);

select ok(
  exists (
    select 1
    from public.discovery_listings_view
    where animal_name = 'Luna'
      and mode = 'ADOPT'
      and organization_name = 'PetPal Rescue Demo'
  ),
  'Luna adoption listing is available for mobile discovery'
);

select ok(
  exists (
    select 1
    from public.discovery_listings_view
    where animal_name = 'Bruno'
      and mode = 'FOSTER'
      and organization_name = 'PetPal Rescue Demo'
  ),
  'Bruno foster listing is available for mobile discovery'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'discovery_listings_view'
      and column_name in (
        'exact_location',
        'private_handover_notes',
        'private_notes',
        'internal_health_notes',
        'contact_email',
        'contact_phone'
      )
  ),
  'mobile discovery view excludes private location, notes, and contact fields'
);

select ok(
  not coalesce(
    (
      select reloptions::text[] @> array['security_invoker=true']
      from pg_class
      where oid = 'public.discovery_listings_view'::regclass
    ),
    false
  ),
  'mobile discovery view is not security_invoker, so anon REST can read safe active rows'
);

select ok(
  not coalesce(
    (
      select reloptions::text[] @> array['security_invoker=true']
      from pg_class
      where oid = 'public.my_applications_view'::regclass
    ),
    false
  ),
  'my applications view is not security_invoker, so applicants can read safe joined summaries'
);

select ok(
  not coalesce(
    (
      select reloptions::text[] @> array['security_invoker=true']
      from pg_class
      where oid = 'public.organization_applications_inbox_view'::regclass
    ),
    false
  ),
  'organization inbox view is not security_invoker, so org reviewers can read gated joined answers'
);

select ok(
  exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'discovery_listings_view'
      and grantee = 'anon'
      and privilege_type = 'SELECT'
  ),
  'anon role has select grant on mobile discovery view'
);

select ok(
  exists (
    select 1
    from auth.users
    where id = '10000000-0000-4000-8000-000000000001'
      and email = 'rescue@petpal.local'
  ),
  'seed includes demo rescue auth user'
);

select ok(
  exists (
    select 1
    from auth.users
    where id = '10000000-0000-4000-8000-000000000002'
      and email = 'adopter@petpal.local'
  ),
  'seed includes demo adopter auth user'
);

select ok(
  not exists (
    select 1
    from auth.users
    where email in ('rescue@petpal.local', 'adopter@petpal.local')
      and (
        confirmation_token is null
        or recovery_token is null
        or email_change_token_current is null
        or reauthentication_token is null
      )
  ),
  'seeded auth users use GoTrue-safe empty token fields instead of null tokens'
);

select is(
  (
    select count(*)::integer
    from auth.identities
    where provider = 'email'
      and identity_data->>'email' in ('rescue@petpal.local', 'adopter@petpal.local')
  ),
  2,
  'seed includes email identities for demo auth users'
);

select ok(
  exists (
    select 1
    from public.profiles
    where id = '10000000-0000-4000-8000-000000000002'
      and age_confirmed = true
  ),
  'demo adopter profile is application-ready'
);

select ok(
  exists (
    select 1
    from public.organization_members
    where organization_id = '20000000-0000-4000-8000-000000000001'
      and profile_id = '10000000-0000-4000-8000-000000000001'
      and role = 'OWNER'
  ),
  'demo rescue user owns the seeded organization'
);

select ok(
  exists (
    select 1
    from public.profile_roles
    where profile_id = '10000000-0000-4000-8000-000000000001'
      and role = 'RESCUER'
  ),
  'demo rescue user has rescuer role'
);

select ok(
  exists (
    select 1
    from public.profile_roles
    where profile_id = '10000000-0000-4000-8000-000000000002'
      and role = 'ADOPTER'
  ),
  'demo adopter user has adopter role'
);

select ok(
  not exists (
    select 1
    from public.animal_listings
    where status = 'ACTIVE'
      and mode not in ('ADOPT', 'FOSTER')
  ),
  'active seed listings do not expose future modes'
);

select ok(
  (
    select prosecdef
    from pg_proc
    where oid = 'public.submit_adoption_foster_application(uuid,text,text,text,text,text,text)'::regprocedure
  ),
  'application submit RPC is security definer so it can validate active listings behind raw-table RLS'
);

select * from finish();

rollback;
