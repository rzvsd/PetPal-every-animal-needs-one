-- Storage cleanup queue (0032).
--
-- Files in Storage are not removed by a database transaction, so a deleted
-- row could leave its file behind forever if the follow-up storage call
-- failed: once the row is gone nothing remembers the path. Every file that
-- must be removed is now written to this queue in the same transaction that
-- deletes its row, and stays there until Storage confirms the removal. The
-- delete-account and storage-cleanup Edge Functions drain it.

create table public.storage_cleanup_queue (
  id bigint generated always as identity primary key,
  bucket_id text not null,
  object_path text not null,
  -- No foreign key: the profile may be gone long before the file is.
  profile_id uuid,
  reason text not null,
  attempts integer not null default 0,
  last_error text,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);

create index storage_cleanup_queue_profile_idx on public.storage_cleanup_queue (profile_id);
create index storage_cleanup_queue_due_idx on public.storage_cleanup_queue (last_attempt_at nulls first, id);

-- Service-only: clients never see or change the queue.
alter table public.storage_cleanup_queue enable row level security;
revoke all on table public.storage_cleanup_queue from public, anon, authenticated;
grant select, insert, update, delete on table public.storage_cleanup_queue to service_role;

-- Any removal of a verification document row, whether by account deletion,
-- an organisation cascade or an admin, queues its file in the same transaction.
create or replace function private.queue_verification_document_file()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(old.storage_path), '') is not null then
    insert into public.storage_cleanup_queue (bucket_id, object_path, profile_id, reason)
    values ('verification-documents', old.storage_path, old.profile_id, 'verification_document_deleted')
    on conflict (bucket_id, object_path) do nothing;
  end if;
  return old;
end;
$$;

revoke all on function private.queue_verification_document_file() from public, anon, authenticated;

create trigger verification_documents_queue_file_cleanup
after delete on public.verification_documents
for each row execute function private.queue_verification_document_file();

-- Records a failed storage removal so the entry is retried later, oldest
-- attempt first, and stuck files are visible to operators.
create or replace function public.record_storage_cleanup_failure(queue_ids bigint[], error_input text)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.storage_cleanup_queue
  set attempts = attempts + 1,
      last_error = left(coalesce(error_input, 'unknown error'), 500),
      last_attempt_at = now()
  where id = any(queue_ids);
$$;

revoke all on function public.record_storage_cleanup_failure(bigint[], text) from public, anon, authenticated;
grant execute on function public.record_storage_cleanup_failure(bigint[], text) to service_role;
