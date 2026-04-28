begin;

select plan(21);

select has_view('public', 'admin_moderation_queue', 'admin moderation queue view exists');

select has_function(
  'public',
  'admin_set_organization_verification_status',
  ARRAY['uuid', 'public.verification_status', 'text'],
  'organization verification admin RPC exists'
);

select has_function(
  'public',
  'admin_resolve_report',
  ARRAY['uuid', 'text', 'text'],
  'report resolution admin RPC exists'
);

select has_function(
  'public',
  'admin_suspend_profile',
  ARRAY['uuid', 'text', 'timestamp with time zone'],
  'user suspension admin RPC exists'
);

select ok(
  exists (
    select 1
    from information_schema.views
    where table_schema = 'public'
      and table_name = 'admin_moderation_queue'
  ),
  'admin queue is registered as a database view'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

select is(
  (select count(*)::integer from public.admin_moderation_queue),
  0,
  'non-admin cannot see admin moderation queue items'
);

select throws_ok(
  'select public.admin_suspend_profile(''10000000-0000-4000-8000-000000000001''::uuid, ''non-admin attempt'', null::timestamptz)',
  'P0001',
  'Admin role required',
  'non-admin cannot suspend users'
);

insert into public.admin_roles (profile_id, role)
values ('10000000-0000-4000-8000-000000000001', 'SUPER_ADMIN')
on conflict (profile_id) do update set role = excluded.role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

create temp table m9_pending_org as
select public.submit_organization_verification(
  'RESCUE_GROUP',
  'M9 Rescue Review',
  'M9 Coordinator',
  'm9-rescue@petpal.local',
  null,
  'Bucharest',
  'https://example.com/m9-rescue',
  null,
  null,
  'M9 pending organization used to prove admin moderation workflows.'
) as organization_id;

create temp table m9_pending_request as
select id as request_id
from public.organization_verification_requests
where organization_id = (select organization_id from m9_pending_org);

create temp table m9_report as
with inserted_report as (
  insert into public.reports (
    reporter_id,
    reported_profile_id,
    listing_id,
    category,
    details
  )
  values (
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'SAFETY_CONCERN',
    'M9 report review smoke.'
  )
  returning id
)
select id as report_id
from inserted_report;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select ok(public.is_admin(), 'seeded rescue user is admin for M9 test');

select ok(
  exists (
    select 1
    from public.admin_moderation_queue
    where queue_type = 'ORGANIZATION_VERIFICATION'
      and item_id = (select request_id from m9_pending_request)
  ),
  'admin queue includes pending organization verification request'
);

select ok(
  exists (
    select 1
    from public.admin_moderation_queue
    where queue_type = 'REPORT'
      and item_id = (select report_id from m9_report)
  ),
  'admin queue includes open report'
);

select public.admin_set_organization_verification_status(
  (select request_id from m9_pending_request),
  'VERIFIED',
  'M9 admin verification approval.'
);

select is(
  (
    select status::text
    from public.organization_verification_requests
    where id = (select request_id from m9_pending_request)
  ),
  'VERIFIED',
  'admin approval updates organization verification request'
);

select is(
  (
    select verification_status::text
    from public.organizations
    where id = (select organization_id from m9_pending_org)
  ),
  'VERIFIED',
  'admin approval updates organization verification status'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'ORGANIZATION_VERIFICATION_STATUS_CHANGED'
      and target_id = (select request_id from m9_pending_request)
  ),
  'organization verification writes audit log'
);

select public.admin_resolve_report(
  (select report_id from m9_report),
  'RESOLVED',
  'M9 report resolved by moderator.'
);

select is(
  (
    select status
    from public.reports
    where id = (select report_id from m9_report)
  ),
  'RESOLVED',
  'admin report review resolves report'
);

select ok(
  exists (
    select 1
    from public.moderation_actions
    where action = 'REPORT_RESOLVED'
      and report_id = (select report_id from m9_report)
  ),
  'report resolution writes moderation action'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'REPORT_STATUS_CHANGED'
      and target_id = (select report_id from m9_report)
  ),
  'report resolution writes audit log'
);

create temp table m9_suspension as
select public.admin_suspend_profile(
  '10000000-0000-4000-8000-000000000002',
  'M9 safety suspension smoke.',
  now() + interval '7 days'
) as suspension;

select ok(
  exists (
    select 1
    from public.user_suspensions
    where profile_id = '10000000-0000-4000-8000-000000000002'
      and reason = 'M9 safety suspension smoke.'
  ),
  'admin can suspend a user'
);

select ok(
  exists (
    select 1
    from public.moderation_actions
    where action = 'USER_SUSPENDED'
      and profile_id = '10000000-0000-4000-8000-000000000002'
  ),
  'user suspension writes moderation action'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'USER_SUSPENDED'
      and target_id = '10000000-0000-4000-8000-000000000002'
  ),
  'user suspension writes audit log'
);

select throws_ok(
  'select public.admin_suspend_profile(''10000000-0000-4000-8000-000000000001''::uuid, ''self suspension'', null::timestamptz)',
  'P0001',
  'Admins cannot suspend their own account',
  'admin cannot suspend self'
);

select is(
  (
    select count(*)::integer
    from public.admin_moderation_queue
    where item_id in ((select request_id from m9_pending_request), (select report_id from m9_report))
  ),
  0,
  'resolved and verified items leave active admin queue'
);

select * from finish();

rollback;
