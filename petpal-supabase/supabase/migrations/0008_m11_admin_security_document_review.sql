create or replace function public.has_admin_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_roles ar
    where ar.profile_id = auth.uid()
      and (
        ar.role = 'SUPER_ADMIN'
        or ar.role = required_role
      )
  );
$$;

create or replace view public.admin_profile_view
with (security_invoker = true)
as
select
  p.id as profile_id,
  p.display_name,
  ar.role,
  ar.created_at as admin_since
from public.admin_roles ar
join public.profiles p on p.id = ar.profile_id
where public.is_admin()
  and ar.profile_id = auth.uid();

grant select on public.admin_profile_view to authenticated;

create or replace view public.admin_document_queue
with (security_invoker = true)
as
select
  vd.id as document_id,
  vd.status::text as status,
  vd.document_type,
  vd.storage_path,
  vd.profile_id,
  p.display_name as profile_display_name,
  vd.organization_id,
  o.name as organization_name,
  o.city,
  vd.created_at
from public.verification_documents vd
left join public.profiles p on p.id = vd.profile_id
left join public.organizations o on o.id = vd.organization_id
where public.has_admin_role('DOCUMENT_REVIEWER')
  and vd.status = 'PENDING';

grant select on public.admin_document_queue to authenticated;

create or replace function public.admin_review_verification_document(
  document_id_input uuid,
  target_status_input public.verification_status,
  notes_input text
)
returns public.verification_documents
language plpgsql
security invoker
set search_path = public
as $$
declare
  document_before public.verification_documents;
  updated_document public.verification_documents;
begin
  if not public.has_admin_role('DOCUMENT_REVIEWER') then
    raise exception 'Document reviewer role required';
  end if;

  if target_status_input not in ('VERIFIED', 'REJECTED') then
    raise exception 'Unsupported document review target status';
  end if;

  if nullif(trim(notes_input), '') is null then
    raise exception 'Document review notes are required';
  end if;

  select * into document_before
  from public.verification_documents
  where id = document_id_input;

  if document_before.id is null then
    raise exception 'Verification document not found';
  end if;

  update public.verification_documents
  set status = target_status_input,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = document_id_input
  returning * into updated_document;

  insert into public.moderation_actions (
    actor_id,
    action,
    profile_id,
    notes
  )
  values (
    auth.uid(),
    'VERIFICATION_DOCUMENT_' || target_status_input::text,
    coalesce(updated_document.profile_id, auth.uid()),
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
    'VERIFICATION_DOCUMENT_STATUS_CHANGED',
    'verification_documents',
    document_id_input,
    jsonb_build_object(
      'from_status', document_before.status,
      'to_status', target_status_input,
      'notes', notes_input,
      'document_type', updated_document.document_type,
      'organization_id', updated_document.organization_id,
      'profile_id', updated_document.profile_id
    )
  );

  return updated_document;
end;
$$;

create or replace function public.admin_close_suspension(
  suspension_id_input uuid,
  notes_input text
)
returns public.user_suspensions
language plpgsql
security invoker
set search_path = public
as $$
declare
  suspension_before public.user_suspensions;
  updated_suspension public.user_suspensions;
begin
  if not public.is_admin() then
    raise exception 'Admin role required';
  end if;

  if nullif(trim(notes_input), '') is null then
    raise exception 'Suspension closure notes are required';
  end if;

  select * into suspension_before
  from public.user_suspensions
  where id = suspension_id_input;

  if suspension_before.id is null then
    raise exception 'Suspension not found';
  end if;

  if suspension_before.ends_at is not null then
    raise exception 'Suspension is already closed';
  end if;

  update public.user_suspensions
  set ends_at = now()
  where id = suspension_id_input
  returning * into updated_suspension;

  insert into public.moderation_actions (
    actor_id,
    action,
    profile_id,
    notes
  )
  values (
    auth.uid(),
    'SUSPENSION_CLOSED',
    updated_suspension.profile_id,
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
    'SUSPENSION_CLOSED',
    'user_suspensions',
    suspension_id_input,
    jsonb_build_object(
      'profile_id', updated_suspension.profile_id,
      'notes', notes_input
    )
  );

  return updated_suspension;
end;
$$;
