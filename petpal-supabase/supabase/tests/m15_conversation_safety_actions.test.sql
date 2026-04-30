begin;

select plan(11);

select has_function(
  'public',
  'report_conversation',
  ARRAY['uuid', 'text', 'text'],
  'conversation report RPC exists'
);

select has_function(
  'public',
  'block_conversation',
  ARRAY['uuid'],
  'conversation block RPC exists'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'my_conversations_view'
      and column_name = 'other_participant_ids'
  ),
  'conversation summary exposes other participant ids for safety state'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'my_conversations_view'
      and column_name = 'blocked_by_me'
  ),
  'conversation summary exposes blocked-by-me state'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'my_conversations_view'
      and column_name = 'reported_by_me'
  ),
  'conversation summary exposes reported-by-me state'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

create temp table m15_application as
select public.submit_adoption_foster_application(
  '40000000-0000-4000-8000-000000000001',
  'Apartment, owned by applicant',
  'I have cared for cats before and can support slow introductions and routine vet visits.',
  'No other pets.',
  'No children.',
  'Not applicable.',
  'I can foster Luna and coordinate safely with the rescue.'
) as application_id;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select public.set_application_review_status(
  (select application_id from m15_application),
  'ACCEPTED',
  'Approved for M15 safety smoke.'
);

create temp table m15_conversation as
select c.id as conversation_id
from public.conversations c
join m15_application app on app.application_id = c.application_id;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

create temp table m15_message as
select public.send_conversation_message(
  (select conversation_id from m15_conversation),
  'We can coordinate safe handover details here.'
) as message_id;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

select is(
  (
    select cardinality(other_participant_ids)::integer
    from public.my_conversations_view
    where conversation_id = (select conversation_id from m15_conversation)
  ),
  1,
  'mobile conversation summary includes one other participant id'
);

create temp table m15_report as
select public.report_conversation(
  (select conversation_id from m15_conversation),
  'SAFETY_CONCERN',
  'Mobile safety menu report.'
) as report_id;

select ok(
  exists (
    select 1
    from public.reports r
    join m15_report report on report.report_id = r.id
    where r.reporter_id = '10000000-0000-4000-8000-000000000002'
      and r.reported_profile_id = '10000000-0000-4000-8000-000000000001'
      and r.message_id = (select message_id from m15_message)
      and r.details like '%' || (select conversation_id::text from m15_conversation) || '%'
  ),
  'conversation report stores reporter, other participant, latest other message, and conversation id'
);

select ok(
  (
    select reported_by_me
    from public.my_conversations_view
    where conversation_id = (select conversation_id from m15_conversation)
  ),
  'conversation summary marks conversation as reported by current user'
);

select public.block_conversation((select conversation_id from m15_conversation));

select ok(
  exists (
    select 1
    from public.blocks
    where blocker_id = '10000000-0000-4000-8000-000000000002'
      and blocked_id = '10000000-0000-4000-8000-000000000001'
  ),
  'conversation block stores a block against the other participant'
);

select ok(
  (
    select blocked_by_me
    from public.my_conversations_view
    where conversation_id = (select conversation_id from m15_conversation)
  ),
  'conversation summary marks conversation as blocked by current user'
);

select throws_ok(
  format(
    'select public.send_conversation_message(%L::uuid, %L::text)',
    (select conversation_id from m15_conversation),
    'This should not send after block.'
  ),
  'P0001',
  'Messaging is blocked for this conversation',
  'blocking the conversation prevents later messages'
);

select * from finish();

rollback;
