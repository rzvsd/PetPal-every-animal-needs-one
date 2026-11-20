begin;
select no_plan();

-- Storage cleanup queue (0032). Deleting a verification document row queues
-- its file in the same transaction, so a failed Storage call can never lose
-- the path. Fixtures as postgres; everything rolls back.
insert into public.verification_documents(id,profile_id,storage_path,document_type)
values
  ('58000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000005/id-front.jpg','ID_CARD'),
  ('58000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000005/id-back.jpg','ID_CARD'),
  ('58000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000004/id-front.jpg','ID_CARD');

-- The queue is service-only.
select ok(not has_table_privilege('anon','public.storage_cleanup_queue','select')
  and not has_table_privilege('authenticated','public.storage_cleanup_queue','select')
  and not has_table_privilege('authenticated','public.storage_cleanup_queue','insert')
  and not has_table_privilege('authenticated','public.storage_cleanup_queue','delete'),
  'clients cannot read or change the cleanup queue');
select ok(has_table_privilege('service_role','public.storage_cleanup_queue','select')
  and has_table_privilege('service_role','public.storage_cleanup_queue','insert')
  and has_table_privilege('service_role','public.storage_cleanup_queue','delete'),
  'the service role drains the queue');
select ok(not has_function_privilege('anon','public.record_storage_cleanup_failure(bigint[],text)','execute')
  and not has_function_privilege('authenticated','public.record_storage_cleanup_failure(bigint[],text)','execute'),
  'clients cannot record cleanup failures');
select ok(has_function_privilege('service_role','public.record_storage_cleanup_failure(bigint[],text)','execute'),
  'the service role records cleanup failures');

-- A blocked deletion keeps the documents and queues nothing.
insert into public.foster_requests(id,case_id,home_id,created_by,sender_id,recipient_id,kind,status,message)
values('57000000-0000-4000-8000-000000000032','40000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001',
  'APPLICATION','PENDING','M32 pending request');
select is(public.delete_account_data('10000000-0000-4000-8000-000000000005')->>'deleted','false','fixture: deletion is blocked');
select is((select count(*)::integer from public.storage_cleanup_queue),0,'a blocked deletion queues no files');
delete from public.foster_requests where id='57000000-0000-4000-8000-000000000032';

-- Account deletion removes the rows and queues every file in the same step.
select is(public.delete_account_data('10000000-0000-4000-8000-000000000005')->>'deleted','true','account data is deleted');
select is((select count(*)::integer from public.verification_documents where profile_id='10000000-0000-4000-8000-000000000005'),0,
  'document rows are removed');
select set_eq($$select bucket_id, object_path, profile_id from public.storage_cleanup_queue$$,
  $$values ('verification-documents','10000000-0000-4000-8000-000000000005/id-front.jpg','10000000-0000-4000-8000-000000000005'::uuid),
           ('verification-documents','10000000-0000-4000-8000-000000000005/id-back.jpg','10000000-0000-4000-8000-000000000005'::uuid)$$,
  'both ID document files are queued for removal, and only this user''s');

-- Running deletion again (a retried request) is harmless.
select lives_ok($$select public.delete_account_data('10000000-0000-4000-8000-000000000005')$$,'a retried deletion still succeeds');
select is((select count(*)::integer from public.storage_cleanup_queue),2,'a retry does not duplicate or lose queue entries');

-- Any other removal of a document row is covered too.
delete from public.verification_documents where id='58000000-0000-4000-8000-000000000003';
select is((select count(*)::integer from public.storage_cleanup_queue
  where object_path='10000000-0000-4000-8000-000000000004/id-front.jpg'),1,'deleting a document row directly queues its file');

-- A rolled back deletion queues nothing.
savepoint before_failed_delete;
insert into public.verification_documents(id,profile_id,storage_path,document_type)
values('58000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000004/rolled-back.jpg','ID_CARD');
delete from public.verification_documents where id='58000000-0000-4000-8000-000000000004';
rollback to savepoint before_failed_delete;
select is((select count(*)::integer from public.storage_cleanup_queue where object_path like '%rolled-back.jpg'),0,
  'queue entries share the deleting transaction');

-- Failures are recorded on the entry, which stays queued for the next run.
set local role service_role;
select lives_ok($$select public.record_storage_cleanup_failure(array(select id from public.storage_cleanup_queue
  where profile_id='10000000-0000-4000-8000-000000000005'),'Storage unavailable')$$,'the service role records a failure');
select ok((select bool_and(attempts = 1 and last_error = 'Storage unavailable' and last_attempt_at is not null)
  from public.storage_cleanup_queue where profile_id='10000000-0000-4000-8000-000000000005'),
  'failed entries keep their path with the attempt and error recorded');

set local role postgres;
select * from finish();
rollback;
