begin;

select plan(20);

select has_view('public', 'my_conversations_view', 'my conversations view exists');
select has_view('public', 'conversation_messages_view', 'conversation messages view exists');

select has_function(
  'public',
  'send_conversation_message',
  ARRAY['uuid', 'text'],
  'send message RPC exists'
);

select has_function(
  'public',
  'report_message',
  ARRAY['uuid', 'text', 'text'],
  'report message RPC exists'
);

select has_function(
  'public',
  'block_profile',
  ARRAY['uuid'],
  'block profile RPC exists'
);

select ok(
  (
    select prosecdef
    from pg_proc
    where oid = 'public.set_application_review_status(uuid,public.application_status,text)'::regprocedure
  ),
  'application review RPC is security definer for accepted-chat side effects'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'messages'
      and policyname = 'messages_participant_insert'
      and with_check like '%is_conversation_blocked%'
  ),
  'direct message insert policy blocks blocked conversations'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

create temp table m6_pending_application as
select public.submit_adoption_foster_application(
  '40000000-0000-4000-8000-000000000002',
  'Apartment',
  'I have fostered recovering dogs and can support quiet walks and vet follow-up.',
  'No other pets.',
  'No children.',
  'Not applicable.',
  'I can temporarily foster Bruno during recovery and coordinate closely with the rescue.'
) as application_id;

select is(
  (
    select count(*)::integer
    from public.conversations c
    join m6_pending_application app on app.application_id = c.application_id
  ),
  0,
  'conversation is not created before application acceptance'
);

create temp table m6_application as
select public.submit_adoption_foster_application(
  '40000000-0000-4000-8000-000000000001',
  'Apartment, owned by applicant',
  'I have cared for cats before and can support slow introductions and routine vet visits.',
  'No other pets.',
  'No children.',
  'Not applicable.',
  'I want to adopt Luna because I can offer a quiet apartment and patient long-term care.'
) as application_id;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select public.set_application_review_status(
  (select application_id from m6_application),
  'ACCEPTED',
  'Approved for M6 chat smoke.'
);

create temp table m6_conversation as
select c.id as conversation_id
from public.conversations c
join m6_application app on app.application_id = c.application_id;

select is(
  (
    select status::text
    from public.applications
    where id = (select application_id from m6_application)
  ),
  'ACCEPTED',
  'application is accepted by organization reviewer'
);

select is(
  (select count(*)::integer from m6_conversation),
  1,
  'accepted application opens exactly one conversation'
);

select is(
  (
    select count(*)::integer
    from public.conversation_participants cp
    join m6_conversation c on c.conversation_id = cp.conversation_id
  ),
  2,
  'conversation has applicant and organization participant'
);

select ok(
  exists (
    select 1
    from public.notification_events
    where profile_id = '10000000-0000-4000-8000-000000000002'
      and event_type = 'CONVERSATION_OPENED'
  ),
  'conversation opened notification is queued for applicant'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

select is(
  (select count(*)::integer from public.my_conversations_view),
  1,
  'applicant can see accepted conversation summary'
);

create temp table m6_message as
select public.send_conversation_message(
  (select conversation_id from m6_conversation),
  'Hello, I am available to coordinate Luna next steps.'
) as message_id;

select ok(
  exists (
    select 1
    from public.messages m
    join m6_message msg on msg.message_id = m.id
    where m.sender_id = '10000000-0000-4000-8000-000000000002'
  ),
  'participant message is inserted through RPC'
);

select is(
  (select count(*)::integer from public.conversation_messages_view),
  1,
  'participant can read conversation messages before block'
);

select ok(
  exists (
    select 1
    from public.notification_events
    where profile_id = '10000000-0000-4000-8000-000000000001'
      and event_type = 'MESSAGE_RECEIVED'
  ),
  'message received notification is queued for organization participant'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

create temp table m6_report as
select public.report_message(
  (select message_id from m6_message),
  'SAFETY_CONCERN',
  'M6 smoke report for moderation workflow.'
) as report_id;

select ok(
  exists (
    select 1
    from public.reports r
    join m6_report report on report.report_id = r.id
    where r.reporter_id = '10000000-0000-4000-8000-000000000001'
      and r.reported_profile_id = '10000000-0000-4000-8000-000000000002'
  ),
  'message report stores reporter and reported participant'
);

select public.block_profile('10000000-0000-4000-8000-000000000002');

select ok(
  exists (
    select 1
    from public.blocks
    where blocker_id = '10000000-0000-4000-8000-000000000001'
      and blocked_id = '10000000-0000-4000-8000-000000000002'
  ),
  'organization participant can block shared conversation participant'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

select throws_ok(
  format(
    'select public.send_conversation_message(%L::uuid, %L::text)',
    (select conversation_id from m6_conversation),
    'Are messages still open?'
  ),
  'P0001',
  'Messaging is blocked for this conversation',
  'blocked participant cannot send another message'
);

select is(
  (select count(*)::integer from public.conversation_messages_view),
  0,
  'blocked conversation hides messages from blocked participant'
);

select * from finish();

rollback;
