begin;

select plan(12);

select has_column('public', 'animals', 'public_health_summary', 'animals include public health summary');
select has_column('public', 'animal_listings', 'submitted_at', 'listings include submitted timestamp');
select has_column('public', 'animal_photos', 'is_primary', 'photos include primary marker');
select has_column('public', 'animal_photos', 'public_url', 'photos include public URL field');

select has_function(
  'public',
  'create_animal_listing_draft',
  ARRAY[
    'uuid',
    'text',
    'public.species',
    'text',
    'integer',
    'text',
    'text',
    'text',
    'text',
    'text',
    'public.petpal_mode',
    'text',
    'text',
    'text',
    'text',
    'text',
    'text',
    'boolean'
  ],
  'animal listing draft RPC exists'
);

select has_function(
  'public',
  'submit_listing_for_review',
  ARRAY['uuid'],
  'submit listing RPC exists'
);

select has_function(
  'public',
  'admin_set_listing_review_status',
  ARRAY['uuid', 'public.listing_status', 'text'],
  'admin listing review RPC exists'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'animal_listings'
      and policyname = 'animal_listings_org_member_insert_draft_or_review'
  ),
  'organization listing insert policy is draft or review only'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'animal_listings'
      and policyname = 'animal_listings_admin_manage'
  ),
  'admin listing management policy exists'
);

select ok(
  exists (
    select 1
    from information_schema.check_constraints
    where constraint_name = 'animal_listings_review_status_requires_submit'
  ),
  'pending review listings require submitted_at'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listing_public_view'
      and column_name in ('exact_location', 'private_handover_notes', 'private_notes')
  ),
  'public listing view excludes private location and handover fields'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'listing_private_details'
  ),
  'listing private details remain covered by RLS policies'
);

select * from finish();

rollback;

