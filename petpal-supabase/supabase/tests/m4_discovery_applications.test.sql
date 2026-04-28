begin;

select plan(16);

select has_view('public', 'discovery_listings_view', 'discovery view exists');
select has_view('public', 'my_applications_view', 'my applications view exists');
select has_view('public', 'organization_applications_inbox_view', 'organization inbox view exists');

select has_column('public', 'applications', 'reviewed_by', 'applications include reviewer');
select has_column('public', 'applications', 'reviewed_at', 'applications include review timestamp');
select has_column('public', 'applications', 'review_note', 'applications include review note');

select has_function(
  'public',
  'submit_adoption_foster_application',
  ARRAY['uuid', 'text', 'text', 'text', 'text', 'text', 'text'],
  'application submission RPC exists'
);

select has_function(
  'public',
  'set_application_review_status',
  ARRAY['uuid', 'public.application_status', 'text'],
  'application review RPC exists'
);

select ok(
  exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'applications'
      and constraint_name = 'applications_unique_applicant_listing'
  ),
  'duplicate applications are blocked per applicant and listing'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'discovery_listings_view'
      and column_name in ('exact_location', 'private_handover_notes', 'private_notes', 'internal_health_notes')
  ),
  'discovery view excludes private fields'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'discovery_listings_view'
      and column_name = 'public_health_summary'
  ),
  'discovery view exposes public health summary'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_applications_inbox_view'
      and column_name = 'motivation'
  ),
  'organization inbox includes application answers'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'my_applications_view'
      and column_name in ('motivation', 'animal_experience', 'landlord_approval')
  ),
  'my applications view keeps application answers out of list summary'
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
  'anonymous users can read discovery view'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'applications_insert_for_active_listing'
  ),
  'applications still require active listings for direct inserts'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'applications_org_update'
  ),
  'organizations can review applications through policy boundary'
);

select * from finish();

rollback;

