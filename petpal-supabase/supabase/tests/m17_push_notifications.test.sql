begin;

select plan(17);

select has_function(
  'public',
  'register_push_token',
  ARRAY['text', 'text', 'text', 'text'],
  'mobile push token registration RPC exists'
);

select has_function(
  'public',
  'claim_pending_push_notifications',
  ARRAY['integer'],
  'server-side push claim RPC exists'
);

select has_function(
  'public',
  'mark_push_notification_sent',
  ARRAY['uuid'],
  'server-side sent marker RPC exists'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notification_events'
      and column_name = 'delivery_status'
  ),
  'notification events track delivery status'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'push_tokens'
      and column_name = 'last_seen_at'
  ),
  'push tokens track refresh time'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

select public.register_push_token(
  'ExponentPushToken-not-used-fcm-token-1',
  'ANDROID',
  'device-a',
  '1.0.0'
);

select is(
  (
    select count(*)::integer
    from public.push_tokens
    where profile_id = '10000000-0000-4000-8000-000000000002'
      and token = 'ExponentPushToken-not-used-fcm-token-1'
      and platform = 'ANDROID'
      and provider = 'FCM'
      and enabled = true
      and disabled_at is null
  ),
  1,
  'Android push token is stored for the current user'
);

select public.register_push_token(
  'ExponentPushToken-not-used-fcm-token-2',
  'ANDROID',
  'device-a',
  '1.0.1'
);

select ok(
  exists (
    select 1
    from public.push_tokens
    where profile_id = '10000000-0000-4000-8000-000000000002'
      and token = 'ExponentPushToken-not-used-fcm-token-1'
      and enabled = false
      and disabled_at is not null
  ),
  'token refresh disables the previous token for the same device'
);

select ok(
  exists (
    select 1
    from public.push_tokens
    where profile_id = '10000000-0000-4000-8000-000000000002'
      and token = 'ExponentPushToken-not-used-fcm-token-2'
      and enabled = true
      and app_version = '1.0.1'
  ),
  'token refresh stores the new active token'
);

create temp table m17_application as
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
  (select application_id from m17_application),
  'ACCEPTED',
  'Approved for M17 push notification smoke.'
);

select ok(
  exists (
    select 1
    from public.notification_events
    where profile_id = '10000000-0000-4000-8000-000000000002'
      and event_type = 'FOSTER_APPLICATION_ACCEPTED'
      and delivery_status = 'QUEUED'
      and title = 'Foster request accepted'
  ),
  'accepted foster application queues a push notification event'
);

create temp table m17_conversation as
select c.id as conversation_id
from public.conversations c
join m17_application app on app.application_id = c.application_id;

select public.send_conversation_message(
  (select conversation_id from m17_conversation),
  'We can coordinate transport on Friday.'
);

select ok(
  exists (
    select 1
    from public.notification_events
    where profile_id = '10000000-0000-4000-8000-000000000002'
      and event_type = 'NEW_MESSAGE'
      and delivery_status = 'QUEUED'
      and payload ? 'conversationId'
  ),
  'new message queues a push notification for the other participant'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

create temp table m17_access_request as
select (public.request_rescuer_access()).id as request_id;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select public.admin_set_organization_verification_status(
  (select request_id from m17_access_request),
  'REJECTED',
  'Demo moderation decision for push notification.'
);

select ok(
  exists (
    select 1
    from public.notification_events
    where profile_id = '10000000-0000-4000-8000-000000000002'
      and event_type = 'MODERATION_DECISION'
      and delivery_status = 'QUEUED'
      and payload ->> 'kind' = 'ORGANIZATION_VERIFICATION'
  ),
  'moderation decision queues a push notification event'
);

create temp table m17_claimed as
select *
from public.claim_pending_push_notifications(10);

select ok(
  exists (
    select 1
    from m17_claimed
    where profile_id = '10000000-0000-4000-8000-000000000002'
      and token = 'ExponentPushToken-not-used-fcm-token-2'
      and event_type in ('FOSTER_APPLICATION_ACCEPTED', 'NEW_MESSAGE', 'MODERATION_DECISION')
  ),
  'server-side claim returns queued events with active push token'
);

select ok(
  exists (
    select 1
    from public.notification_events ne
    join m17_claimed claimed on claimed.event_id = ne.id
    where ne.delivery_status = 'PROCESSING'
      and ne.attempts = 1
  ),
  'claim marks events as processing and increments attempts'
);

select public.mark_push_notification_sent(
  (select event_id from m17_claimed limit 1)
);

select is(
  (
    select delivery_status
    from public.notification_events
    where id = (select event_id from m17_claimed limit 1)
  ),
  'SENT',
  'server-side sent marker records delivery success'
);

create temp table m17_failed as
select event_id
from m17_claimed
where event_id <> (select event_id from m17_claimed limit 1)
limit 1;

select public.mark_push_notification_failed(
  (select event_id from m17_failed),
  'FCM test failure'
);

select is(
  (
    select delivery_status
    from public.notification_events
    where id = (select event_id from m17_failed)
  ),
  'RETRY',
  'server-side failure marker schedules retry before attempt limit'
);

select throws_ok(
  $$select public.register_push_token('', 'ANDROID', null, null)$$,
  'P0001',
  'Push token is required',
  'empty push tokens are rejected'
);

select throws_ok(
  $$select public.register_push_token('bad-platform-token', 'DESKTOP', null, null)$$,
  'P0001',
  'Unsupported push platform',
  'unsupported push platforms are rejected'
);

select * from finish();

rollback;
