create or replace view public.admin_moderation_queue
with (security_invoker = true)
as
select
  'ORGANIZATION_VERIFICATION'::text as queue_type,
  ovr.id as item_id,
  ovr.status::text as status,
  ovr.organization_name as title,
  ovr.city,
  ovr.created_at,
  jsonb_build_object(
    'organizationId', ovr.organization_id,
    'organizationType', ovr.organization_type,
    'representativeName', ovr.representative_name,
    'contactEmail', ovr.contact_email
  ) as payload
from public.organization_verification_requests ovr
where public.is_admin()
  and ovr.status = 'PENDING'
union all
select
  'LISTING_REVIEW'::text as queue_type,
  l.id as item_id,
  l.status::text as status,
  l.title,
  l.city,
  coalesce(l.submitted_at, l.created_at) as created_at,
  jsonb_build_object(
    'listingId', l.id,
    'animalId', l.animal_id,
    'organizationId', l.organization_id,
    'mode', l.mode,
    'coarseArea', l.coarse_area
  ) as payload
from public.animal_listings l
where public.is_admin()
  and l.status = 'PENDING_REVIEW'
union all
select
  'REPORT'::text as queue_type,
  r.id as item_id,
  r.status,
  r.category as title,
  null::text as city,
  r.created_at,
  jsonb_build_object(
    'reporterId', r.reporter_id,
    'reportedProfileId', r.reported_profile_id,
    'listingId', r.listing_id,
    'messageId', r.message_id
  ) as payload
from public.reports r
where public.is_admin()
  and r.status in ('OPEN', 'IN_REVIEW');

grant select on public.admin_moderation_queue to authenticated;

create or replace function public.admin_set_organization_verification_status(
  request_id_input uuid,
  target_status_input public.verification_status,
  reason_input text
)
returns public.organization_verification_requests
language plpgsql
security invoker
set search_path = public
as $$
declare
  request_before public.organization_verification_requests;
  updated_request public.organization_verification_requests;
begin
  if not public.is_admin() then
    raise exception 'Admin role required';
  end if;

  if target_status_input not in ('VERIFIED', 'REJECTED') then
    raise exception 'Unsupported organization verification target status';
  end if;

  select * into request_before
  from public.organization_verification_requests
  where id = request_id_input;

  if request_before.id is null then
    raise exception 'Organization verification request not found';
  end if;

  update public.organization_verification_requests
  set status = target_status_input,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      rejection_reason = case when target_status_input = 'REJECTED' then reason_input else null end,
      updated_at = now()
  where id = request_id_input
  returning * into updated_request;

  update public.organizations
  set verification_status = target_status_input,
      updated_at = now()
  where id = updated_request.organization_id;

  insert into public.moderation_actions (
    actor_id,
    action,
    profile_id,
    notes
  )
  values (
    auth.uid(),
    'ORGANIZATION_VERIFICATION_' || target_status_input::text,
    updated_request.submitted_by,
    reason_input
  );

  insert into public.audit_logs (
    actor_id,
    action,
    target_table,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    'ORGANIZATION_VERIFICATION_STATUS_CHANGED',
    'organization_verification_requests',
    request_id_input,
    jsonb_build_object(
      'organization_id', updated_request.organization_id,
      'from_status', request_before.status,
      'to_status', target_status_input,
      'reason', reason_input
    )
  );

  return updated_request;
end;
$$;

create or replace function public.admin_resolve_report(
  report_id_input uuid,
  target_status_input text,
  notes_input text
)
returns public.reports
language plpgsql
security invoker
set search_path = public
as $$
declare
  report_before public.reports;
  updated_report public.reports;
begin
  if not public.is_admin() then
    raise exception 'Admin role required';
  end if;

  if target_status_input not in ('IN_REVIEW', 'RESOLVED', 'DISMISSED') then
    raise exception 'Unsupported report target status';
  end if;

  select * into report_before
  from public.reports
  where id = report_id_input;

  if report_before.id is null then
    raise exception 'Report not found';
  end if;

  update public.reports
  set status = target_status_input,
      resolved_at = case when target_status_input in ('RESOLVED', 'DISMISSED') then now() else resolved_at end
  where id = report_id_input
  returning * into updated_report;

  insert into public.moderation_actions (
    actor_id,
    action,
    report_id,
    listing_id,
    profile_id,
    notes
  )
  values (
    auth.uid(),
    'REPORT_' || target_status_input,
    report_id_input,
    updated_report.listing_id,
    updated_report.reported_profile_id,
    notes_input
  );

  insert into public.audit_logs (
    actor_id,
    action,
    target_table,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    'REPORT_STATUS_CHANGED',
    'reports',
    report_id_input,
    jsonb_build_object(
      'from_status', report_before.status,
      'to_status', target_status_input,
      'notes', notes_input
    )
  );

  return updated_report;
end;
$$;

create or replace function public.admin_suspend_profile(
  profile_id_input uuid,
  reason_input text,
  ends_at_input timestamptz default null
)
returns public.user_suspensions
language plpgsql
security invoker
set search_path = public
as $$
declare
  suspension_result public.user_suspensions;
begin
  if not public.is_admin() then
    raise exception 'Admin role required';
  end if;

  if profile_id_input = auth.uid() then
    raise exception 'Admins cannot suspend their own account';
  end if;

  if nullif(trim(reason_input), '') is null then
    raise exception 'Suspension reason is required';
  end if;

  insert into public.user_suspensions (
    profile_id,
    suspended_by,
    reason,
    ends_at
  )
  values (
    profile_id_input,
    auth.uid(),
    reason_input,
    ends_at_input
  )
  returning * into suspension_result;

  insert into public.moderation_actions (
    actor_id,
    action,
    profile_id,
    notes
  )
  values (
    auth.uid(),
    'USER_SUSPENDED',
    profile_id_input,
    reason_input
  );

  insert into public.audit_logs (
    actor_id,
    action,
    target_table,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    'USER_SUSPENDED',
    'profiles',
    profile_id_input,
    jsonb_build_object(
      'suspension_id', suspension_result.id,
      'reason', reason_input,
      'ends_at', ends_at_input
    )
  );

  return suspension_result;
end;
$$;
