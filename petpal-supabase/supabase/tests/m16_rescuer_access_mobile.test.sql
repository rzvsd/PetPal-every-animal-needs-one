begin;

select plan(12);

select has_view('public', 'my_rescuer_access_view', 'my rescuer access view exists');

select has_function(
  'public',
  'request_rescuer_access',
  ARRAY[]::text[],
  'mobile rescuer access request RPC exists'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

select is(
  (
    select access_status
    from public.my_rescuer_access_view
  ),
  'NOT_REQUESTED',
  'adopter starts without rescuer management access'
);

create temp table m16_request as
select (public.request_rescuer_access()).id as request_id;

select is(
  (
    select access_status
    from public.my_rescuer_access_view
  ),
  'PENDING',
  'mobile request changes visible access status to pending'
);

select ok(
  exists (
    select 1
    from public.organization_verification_requests ovr
    join m16_request req on req.request_id = ovr.id
    where ovr.submitted_by = '10000000-0000-4000-8000-000000000002'
      and ovr.status = 'PENDING'
      and ovr.organization_type = 'INDEPENDENT_RESCUER'
  ),
  'mobile request creates pending independent rescuer verification request'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'RESCUER_ACCESS_REQUESTED'
      and target_id = (select request_id from m16_request)
  ),
  'mobile rescuer request writes audit log'
);

select public.request_rescuer_access();

select is(
  (
    select count(*)::integer
    from public.organization_verification_requests
    where submitted_by = '10000000-0000-4000-8000-000000000002'
      and status = 'PENDING'
  ),
  1,
  'request RPC is idempotent while pending'
);

select ok(
  not exists (
    select 1
    from public.profile_roles
    where profile_id = '10000000-0000-4000-8000-000000000002'
      and role in ('RESCUER', 'SHELTER_MEMBER')
  ),
  'pending request does not grant rescuer role'
);

insert into public.admin_roles (profile_id, role)
values ('10000000-0000-4000-8000-000000000001', 'SUPER_ADMIN')
on conflict (profile_id) do update set role = excluded.role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select public.admin_set_organization_verification_status(
  (select request_id from m16_request),
  'VERIFIED',
  'M16 mobile request approval.'
);

select ok(
  exists (
    select 1
    from public.profile_roles
    where profile_id = '10000000-0000-4000-8000-000000000002'
      and role = 'RESCUER'
  ),
  'admin approval grants rescuer role'
);

select is(
  (
    select verification_status::text
    from public.organizations o
    join public.organization_verification_requests ovr on ovr.organization_id = o.id
    where ovr.id = (select request_id from m16_request)
  ),
  'VERIFIED',
  'admin approval verifies organization'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

select is(
  (
    select access_status
    from public.my_rescuer_access_view
  ),
  'VERIFIED',
  'approved user sees verified rescuer access'
);

select ok(
  exists (
    select 1
    from public.admin_moderation_queue
    where item_id = (select request_id from m16_request)
  ) = false,
  'verified request leaves active moderation queue'
);

select * from finish();

rollback;
