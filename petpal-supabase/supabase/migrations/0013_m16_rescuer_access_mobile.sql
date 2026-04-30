create or replace view public.my_rescuer_access_view
with (security_invoker = true)
as
select
  p.id as profile_id,
  case
    when exists (
      select 1
      from public.profile_roles pr
      where pr.profile_id = p.id
        and pr.role in ('RESCUER', 'SHELTER_MEMBER')
    ) then 'VERIFIED'
    when access_request.status is not null then access_request.status::text
    else 'NOT_REQUESTED'
  end as access_status,
  access_request.id as request_id,
  access_request.organization_id,
  access_request.organization_type::text as organization_type,
  access_request.organization_name,
  access_request.rejection_reason,
  access_request.created_at,
  access_request.updated_at
from public.profiles p
left join lateral (
  select ovr.*
  from public.organization_verification_requests ovr
  where ovr.submitted_by = p.id
  order by
    case ovr.status
      when 'PENDING' then 0
      when 'VERIFIED' then 1
      when 'REJECTED' then 2
      else 3
    end,
    ovr.created_at desc
  limit 1
) access_request on true
where p.id = auth.uid();

grant select on public.my_rescuer_access_view to authenticated;

drop policy if exists profile_roles_admin_manage on public.profile_roles;
create policy profile_roles_admin_manage
on public.profile_roles for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.request_rescuer_access()
returns public.organization_verification_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles;
  existing_request public.organization_verification_requests;
  organization_id_result uuid;
  request_result public.organization_verification_requests;
  requester_email text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into current_profile
  from public.profiles
  where id = auth.uid();

  if current_profile.id is null then
    raise exception 'Profile not found';
  end if;

  if exists (
    select 1
    from public.profile_roles pr
    where pr.profile_id = auth.uid()
      and pr.role in ('RESCUER', 'SHELTER_MEMBER')
  ) then
    select ovr.* into existing_request
    from public.organization_verification_requests ovr
    where ovr.submitted_by = auth.uid()
      and ovr.status = 'VERIFIED'
    order by ovr.updated_at desc
    limit 1;

    if existing_request.id is not null then
      return existing_request;
    end if;
  end if;

  select ovr.* into existing_request
  from public.organization_verification_requests ovr
  where ovr.submitted_by = auth.uid()
    and ovr.status = 'PENDING'
  order by ovr.created_at desc
  limit 1;

  if existing_request.id is not null then
    return existing_request;
  end if;

  select email into requester_email
  from auth.users
  where id = auth.uid();

  insert into public.organizations (
    name,
    city,
    website_url,
    social_url,
    verification_status,
    created_by,
    organization_type,
    representative_name,
    contact_email,
    contact_phone,
    registration_number,
    activity_summary
  )
  values (
    coalesce(nullif(current_profile.display_name, ''), 'PetPal user') || ' rescuer access request',
    coalesce(nullif(current_profile.city, ''), 'Unknown'),
    null,
    null,
    'PENDING',
    auth.uid(),
    'INDEPENDENT_RESCUER',
    coalesce(nullif(current_profile.display_name, ''), 'PetPal user'),
    coalesce(nullif(requester_email, ''), 'unknown@petpal.local'),
    null,
    null,
    'Mobile request for rescuer or shelter management access. PetPal must review identity, organization details, and animal welfare suitability before tools unlock.'
  )
  returning id into organization_id_result;

  insert into public.organization_verification_requests (
    organization_id,
    submitted_by,
    status,
    organization_type,
    organization_name,
    representative_name,
    contact_email,
    contact_phone,
    city,
    website_url,
    social_url,
    registration_number,
    activity_summary
  )
  values (
    organization_id_result,
    auth.uid(),
    'PENDING',
    'INDEPENDENT_RESCUER',
    coalesce(nullif(current_profile.display_name, ''), 'PetPal user') || ' rescuer access request',
    coalesce(nullif(current_profile.display_name, ''), 'PetPal user'),
    coalesce(nullif(requester_email, ''), 'unknown@petpal.local'),
    null,
    coalesce(nullif(current_profile.city, ''), 'Unknown'),
    null,
    null,
    null,
    'Mobile request for rescuer or shelter management access. PetPal must review identity, organization details, and animal welfare suitability before tools unlock.'
  )
  returning * into request_result;

  insert into public.audit_logs (
    actor_id,
    action,
    target_table,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    'RESCUER_ACCESS_REQUESTED',
    'organization_verification_requests',
    request_result.id,
    jsonb_build_object(
      'organization_id', organization_id_result,
      'source', 'mobile'
    )
  );

  return request_result;
end;
$$;

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

  if target_status_input = 'VERIFIED' then
    insert into public.profile_roles (profile_id, role)
    values (updated_request.submitted_by, 'RESCUER')
    on conflict do nothing;
  end if;

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
