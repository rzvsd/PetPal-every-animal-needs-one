begin;

select plan(21);

select has_function(
  'public',
  'has_admin_role',
  ARRAY['text'],
  'admin role helper exists'
);

select has_view('public', 'admin_profile_view', 'admin profile view exists');
select has_view('public', 'admin_document_queue', 'admin document queue view exists');

select has_function(
  'public',
  'admin_review_verification_document',
  ARRAY['uuid', 'public.verification_status', 'text'],
  'document review admin RPC exists'
);

select has_function(
  'public',
  'admin_close_suspension',
  ARRAY['uuid', 'text'],
  'suspension closure admin RPC exists'
);

insert into public.admin_roles (profile_id, role)
values ('10000000-0000-4000-8000-000000000001', 'SUPER_ADMIN')
on conflict (profile_id) do update set role = excluded.role;

insert into public.verification_documents (
  id,
  organization_id,
  storage_path,
  document_type,
  status
)
values (
  '71000000-0000-4000-8000-000000000101',
  '20000000-0000-4000-8000-000000000001',
  'verification-documents/m11-review-proof.pdf',
  'REGISTRATION_PROOF',
  'PENDING'
)
on conflict (id) do update
set status = excluded.status,
    reviewed_by = null,
    reviewed_at = null;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

select is(
  (select count(*)::integer from public.admin_profile_view),
  0,
  'non-admin cannot see admin profile view'
);

select is(
  (select count(*)::integer from public.admin_document_queue),
  0,
  'non-document-reviewer cannot see document queue'
);

select throws_ok(
  'select public.admin_review_verification_document(''71000000-0000-4000-8000-000000000101''::uuid, ''VERIFIED''::public.verification_status, ''non-admin attempt'')',
  'P0001',
  'Document reviewer role required',
  'non-admin cannot review verification documents'
);

select throws_ok(
  'select public.admin_close_suspension(''90000000-0000-4000-8000-000000000001''::uuid, ''non-admin attempt'')',
  'P0001',
  'Admin role required',
  'non-admin cannot close suspensions'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select ok(public.has_admin_role('DOCUMENT_REVIEWER'), 'super admin satisfies document reviewer role');

select is(
  (
    select role
    from public.admin_profile_view
    where profile_id = '10000000-0000-4000-8000-000000000001'
  ),
  'SUPER_ADMIN',
  'admin profile view exposes current admin role'
);

select ok(
  exists (
    select 1
    from public.admin_document_queue
    where document_id = '71000000-0000-4000-8000-000000000101'
      and document_type = 'REGISTRATION_PROOF'
  ),
  'document reviewer sees pending document queue item'
);

select throws_ok(
  'select public.admin_review_verification_document(''71000000-0000-4000-8000-000000000101''::uuid, ''PENDING''::public.verification_status, ''invalid target'')',
  'P0001',
  'Unsupported document review target status',
  'document review target status is constrained'
);

select throws_ok(
  'select public.admin_review_verification_document(''71000000-0000-4000-8000-000000000101''::uuid, ''VERIFIED''::public.verification_status, '''')',
  'P0001',
  'Document review notes are required',
  'document review notes are required'
);

select public.admin_review_verification_document(
  '71000000-0000-4000-8000-000000000101',
  'VERIFIED',
  'M11 document review approval.'
);

select is(
  (
    select status::text
    from public.verification_documents
    where id = '71000000-0000-4000-8000-000000000101'
  ),
  'VERIFIED',
  'admin document review updates document status'
);

select is(
  (
    select reviewed_by
    from public.verification_documents
    where id = '71000000-0000-4000-8000-000000000101'
  ),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'admin document review stores reviewer id'
);

select ok(
  exists (
    select 1
    from public.moderation_actions
    where action = 'VERIFICATION_DOCUMENT_VERIFIED'
      and notes = 'M11 document review approval.'
  ),
  'document review writes moderation action'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'VERIFICATION_DOCUMENT_STATUS_CHANGED'
      and target_id = '71000000-0000-4000-8000-000000000101'
  ),
  'document review writes audit log'
);

select public.admin_close_suspension(
  '90000000-0000-4000-8000-000000000001',
  'M11 suspension closure proof.'
);

select ok(
  exists (
    select 1
    from public.user_suspensions
    where id = '90000000-0000-4000-8000-000000000001'
      and ends_at is not null
  ),
  'admin can close active suspension'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'SUSPENSION_CLOSED'
      and target_id = '90000000-0000-4000-8000-000000000001'
  ),
  'suspension closure writes audit log'
);

select throws_ok(
  'select public.admin_close_suspension(''90000000-0000-4000-8000-000000000001''::uuid, ''second close'')',
  'P0001',
  'Suspension is already closed',
  'already closed suspension cannot be closed twice'
);

select * from finish();

rollback;
