begin;

select plan(10);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profile_roles'::regclass),
  'profile_roles has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.organization_verification_requests'::regclass),
  'organization_verification_requests has RLS enabled'
);

select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profile_roles'),
  'profile_roles has RLS policies'
);

select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'organization_verification_requests'),
  'organization_verification_requests has RLS policies'
);

select has_column('public', 'profiles', 'age_confirmed', 'profiles include age gate flag');
select has_column('public', 'profiles', 'onboarding_completed_at', 'profiles include onboarding completion timestamp');
select has_column('public', 'organizations', 'organization_type', 'organizations include organization type');
select has_column('public', 'organizations', 'representative_name', 'organizations include representative name');

select has_function(
  'public',
  'complete_profile_onboarding',
  ARRAY['text', 'text', 'text', 'public.user_role[]'],
  'profile onboarding RPC exists'
);

select has_function(
  'public',
  'submit_organization_verification',
  ARRAY[
    'public.organization_type',
    'text',
    'text',
    'text',
    'text',
    'text',
    'text',
    'text',
    'text',
    'text'
  ],
  'organization verification RPC exists'
);

select * from finish();

rollback;

