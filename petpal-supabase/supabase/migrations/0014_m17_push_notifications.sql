alter table public.push_tokens
  add column if not exists provider text not null default 'FCM',
  add column if not exists device_id text,
  add column if not exists app_version text,
  add column if not exists enabled boolean not null default true,
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists disabled_at timestamptz;

alter table public.push_tokens
  drop constraint if exists push_tokens_provider_check,
  add constraint push_tokens_provider_check
    check (provider in ('FCM', 'APNS', 'WEB_PUSH'));

create index if not exists push_tokens_profile_enabled_idx
  on public.push_tokens (profile_id, enabled)
  where disabled_at is null;

drop index if exists public.push_tokens_profile_device_idx;
create unique index if not exists push_tokens_profile_device_idx
  on public.push_tokens (profile_id, device_id)
  where device_id is not null
    and disabled_at is null;

alter table public.notification_events
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists delivery_status text not null default 'QUEUED',
  add column if not exists attempts integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists delivered_at timestamptz,
  add column if not exists error_message text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.notification_events
  drop constraint if exists notification_events_delivery_status_check,
  add constraint notification_events_delivery_status_check
    check (delivery_status in ('QUEUED', 'PROCESSING', 'SENT', 'RETRY', 'FAILED', 'SKIPPED'));

create index if not exists notification_events_delivery_queue_idx
  on public.notification_events (delivery_status, next_attempt_at, created_at)
  where delivery_status in ('QUEUED', 'RETRY');

create or replace function public.default_push_title(event_type_input text)
returns text
language sql
immutable
as $$
  select case event_type_input
    when 'FOSTER_APPLICATION_ACCEPTED' then 'Foster request accepted'
    when 'NEW_MESSAGE' then 'New PetPal message'
    when 'MODERATION_DECISION' then 'PetPal review update'
    else 'PetPal update'
  end;
$$;

create or replace function public.default_push_body(event_type_input text)
returns text
language sql
immutable
as $$
  select case event_type_input
    when 'FOSTER_APPLICATION_ACCEPTED' then 'Your foster request was accepted. Chat is now open.'
    when 'NEW_MESSAGE' then 'You have a new message in PetPal.'
    when 'MODERATION_DECISION' then 'A PetPal review decision is ready.'
    else 'Open PetPal for the latest update.'
  end;
$$;

create or replace function public.enqueue_push_notification(
  profile_id_input uuid,
  event_type_input text,
  payload_input jsonb default '{}'::jsonb,
  title_input text default null,
  body_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  event_id_result uuid;
begin
  if profile_id_input is null then
    raise exception 'Notification profile id is required';
  end if;

  insert into public.notification_events (
    profile_id,
    event_type,
    payload,
    title,
    body,
    delivery_status,
    next_attempt_at
  )
  values (
    profile_id_input,
    event_type_input,
    coalesce(payload_input, '{}'::jsonb),
    coalesce(nullif(trim(title_input), ''), public.default_push_title(event_type_input)),
    coalesce(nullif(trim(body_input), ''), public.default_push_body(event_type_input)),
    'QUEUED',
    now()
  )
  returning id into event_id_result;

  return event_id_result;
end;
$$;

create or replace function public.register_push_token(
  token_input text,
  platform_input text default 'ANDROID',
  device_id_input text default null,
  app_version_input text default null
)
returns public.push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_platform text;
  saved_token public.push_tokens;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(token_input), '') is null then
    raise exception 'Push token is required';
  end if;

  normalized_platform := upper(coalesce(nullif(trim(platform_input), ''), 'ANDROID'));

  if normalized_platform not in ('IOS', 'ANDROID', 'WEB') then
    raise exception 'Unsupported push platform';
  end if;

  if nullif(trim(device_id_input), '') is not null then
    update public.push_tokens
    set enabled = false,
        disabled_at = now(),
        updated_at = now()
    where profile_id = auth.uid()
      and device_id = trim(device_id_input)
      and token <> trim(token_input)
      and disabled_at is null;
  end if;

  insert into public.push_tokens (
    profile_id,
    token,
    platform,
    provider,
    device_id,
    app_version,
    enabled,
    disabled_at,
    last_seen_at,
    updated_at
  )
  values (
    auth.uid(),
    trim(token_input),
    normalized_platform,
    case when normalized_platform = 'IOS' then 'APNS' else 'FCM' end,
    nullif(trim(device_id_input), ''),
    nullif(trim(app_version_input), ''),
    true,
    null,
    now(),
    now()
  )
  on conflict (token) do update
  set profile_id = excluded.profile_id,
      platform = excluded.platform,
      provider = excluded.provider,
      device_id = excluded.device_id,
      app_version = excluded.app_version,
      enabled = true,
      disabled_at = null,
      last_seen_at = now(),
      updated_at = now()
  returning * into saved_token;

  return saved_token;
end;
$$;

create or replace function public.disable_push_token(token_input text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.push_tokens
  set enabled = false,
      disabled_at = now(),
      updated_at = now()
  where profile_id = auth.uid()
    and token = trim(token_input);
end;
$$;

create or replace function public.claim_pending_push_notifications(batch_size_input integer default 25)
returns table (
  event_id uuid,
  profile_id uuid,
  token_id uuid,
  token text,
  platform text,
  provider text,
  event_type text,
  title text,
  body text,
  payload jsonb,
  attempt integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select ne.id
    from public.notification_events ne
    where ne.delivery_status in ('QUEUED', 'RETRY')
      and ne.next_attempt_at <= now()
      and exists (
        select 1
        from public.push_tokens pt
        where pt.profile_id = ne.profile_id
          and pt.enabled = true
          and pt.disabled_at is null
      )
    order by ne.created_at asc
    limit greatest(1, least(coalesce(batch_size_input, 25), 100))
    for update skip locked
  ),
  updated as (
    update public.notification_events ne
    set delivery_status = 'PROCESSING',
        attempts = ne.attempts + 1,
        last_attempt_at = now(),
        updated_at = now()
    from claimed
    where ne.id = claimed.id
    returning ne.*
  )
  select
    u.id as event_id,
    u.profile_id,
    pt.id as token_id,
    pt.token,
    pt.platform,
    pt.provider,
    u.event_type,
    coalesce(u.title, public.default_push_title(u.event_type)) as title,
    coalesce(u.body, public.default_push_body(u.event_type)) as body,
    u.payload,
    u.attempts as attempt
  from updated u
  join public.push_tokens pt
    on pt.profile_id = u.profile_id
   and pt.enabled = true
   and pt.disabled_at is null
  order by u.created_at asc, pt.last_seen_at desc;
end;
$$;

create or replace function public.mark_push_notification_sent(event_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_events
  set delivery_status = 'SENT',
      sent_at = now(),
      delivered_at = now(),
      error_message = null,
      updated_at = now()
  where id = event_id_input;
end;
$$;

create or replace function public.mark_push_notification_failed(
  event_id_input uuid,
  error_message_input text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_attempts integer;
begin
  select attempts into current_attempts
  from public.notification_events
  where id = event_id_input;

  update public.notification_events
  set delivery_status = case when coalesce(current_attempts, 0) >= 3 then 'FAILED' else 'RETRY' end,
      error_message = left(coalesce(error_message_input, 'Unknown push delivery error'), 1000),
      next_attempt_at = case
        when coalesce(current_attempts, 0) >= 3 then next_attempt_at
        else now() + make_interval(mins => greatest(1, coalesce(current_attempts, 1) * 5))
      end,
      updated_at = now()
  where id = event_id_input;
end;
$$;

revoke all on function public.claim_pending_push_notifications(integer) from public, anon, authenticated;
revoke all on function public.mark_push_notification_sent(uuid) from public, anon, authenticated;
revoke all on function public.mark_push_notification_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_pending_push_notifications(integer) to service_role;
grant execute on function public.mark_push_notification_sent(uuid) to service_role;
grant execute on function public.mark_push_notification_failed(uuid, text) to service_role;

grant execute on function public.register_push_token(text, text, text, text) to authenticated;
grant execute on function public.disable_push_token(text) to authenticated;

create or replace function public.set_application_review_status(
  application_id_input uuid,
  target_status_input public.application_status,
  review_note_input text
)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_status public.application_status;
  updated_application public.applications;
  conversation_id_result uuid;
  listing_title_result text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if target_status_input not in ('IN_REVIEW', 'ACCEPTED', 'REJECTED') then
    raise exception 'Unsupported application review status';
  end if;

  select app.status, l.title into previous_status, listing_title_result
  from public.applications app
  join public.animal_listings l on l.id = app.listing_id
  where app.id = application_id_input
    and (public.is_listing_org_member(app.listing_id) or public.is_admin());

  if previous_status is null then
    raise exception 'Application not found or not reviewable';
  end if;

  update public.applications
  set status = target_status_input,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = review_note_input,
      updated_at = now()
  where id = application_id_input
  returning * into updated_application;

  insert into public.application_status_history (
    application_id,
    from_status,
    to_status,
    changed_by,
    reason
  )
  values (
    application_id_input,
    previous_status,
    target_status_input,
    auth.uid(),
    review_note_input
  );

  if target_status_input = 'ACCEPTED' then
    insert into public.conversations (application_id)
    values (application_id_input)
    on conflict (application_id) do update
    set application_id = excluded.application_id
    returning id into conversation_id_result;

    insert into public.conversation_participants (conversation_id, profile_id)
    values (conversation_id_result, updated_application.applicant_id)
    on conflict do nothing;

    insert into public.conversation_participants (conversation_id, profile_id)
    select conversation_id_result, om.profile_id
    from public.applications app
    join public.animal_listings l on l.id = app.listing_id
    join public.organization_members om on om.organization_id = l.organization_id
    where app.id = application_id_input
    on conflict do nothing;

    perform public.enqueue_push_notification(
      updated_application.applicant_id,
      'FOSTER_APPLICATION_ACCEPTED',
      jsonb_build_object(
        'applicationId', updated_application.id,
        'listingId', updated_application.listing_id,
        'conversationId', conversation_id_result,
        'status', target_status_input
      ),
      'Foster request accepted',
      coalesce(listing_title_result, 'Your foster request') || ' was accepted. Chat is now open.'
    );

    insert into public.notification_events (
      profile_id,
      event_type,
      payload,
      title,
      body,
      delivery_status
    )
    values (
      updated_application.applicant_id,
      'CONVERSATION_OPENED',
      jsonb_build_object(
        'applicationId', updated_application.id,
        'conversationId', conversation_id_result
      ),
      'Conversation opened',
      'Your accepted foster request opened a conversation.',
      'SKIPPED'
    );
  end if;

  return updated_application;
end;
$$;

create or replace function public.send_conversation_message(
  conversation_id_input uuid,
  body_input text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  message_id_result uuid;
  sender_name_result text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(trim(body_input)) < 1 or char_length(body_input) > 4000 then
    raise exception 'Message body must be between 1 and 4000 characters';
  end if;

  if not public.is_conversation_participant(conversation_id_input) then
    raise exception 'Conversation not found or not accessible';
  end if;

  if public.is_conversation_blocked(conversation_id_input, auth.uid()) then
    raise exception 'Messaging is blocked for this conversation';
  end if;

  select display_name into sender_name_result
  from public.profiles
  where id = auth.uid();

  insert into public.messages (conversation_id, sender_id, body)
  values (conversation_id_input, auth.uid(), trim(body_input))
  returning id into message_id_result;

  perform public.enqueue_push_notification(
    cp.profile_id,
    'NEW_MESSAGE',
    jsonb_build_object(
      'conversationId', conversation_id_input,
      'messageId', message_id_result,
      'senderId', auth.uid()
    ),
    'New message from ' || coalesce(sender_name_result, 'PetPal'),
    left(trim(body_input), 140)
  )
  from public.conversation_participants cp
  where cp.conversation_id = conversation_id_input
    and cp.profile_id <> auth.uid();

  insert into public.notification_events (
    profile_id,
    event_type,
    payload,
    title,
    body,
    delivery_status
  )
  select
    cp.profile_id,
    'MESSAGE_RECEIVED',
    jsonb_build_object(
      'conversationId', conversation_id_input,
      'messageId', message_id_result,
      'senderId', auth.uid()
    ),
    'Message received',
    'A conversation message was received.',
    'SKIPPED'
  from public.conversation_participants cp
  where cp.conversation_id = conversation_id_input
    and cp.profile_id <> auth.uid();

  return message_id_result;
end;
$$;

create or replace function public.admin_set_listing_review_status(
  listing_id_input uuid,
  target_status_input public.listing_status,
  reason_input text
)
returns public.animal_listings
language plpgsql
security invoker
set search_path = public
as $$
declare
  previous_status public.listing_status;
  updated_listing public.animal_listings;
begin
  if not public.is_admin() then
    raise exception 'Admin role required';
  end if;

  if target_status_input not in ('ACTIVE', 'REJECTED', 'PAUSED', 'ARCHIVED') then
    raise exception 'Unsupported admin review target status';
  end if;

  select status into previous_status
  from public.animal_listings
  where id = listing_id_input;

  update public.animal_listings
  set status = target_status_input,
      reviewed_at = case when target_status_input in ('ACTIVE', 'REJECTED') then now() else reviewed_at end,
      reviewed_by = case when target_status_input in ('ACTIVE', 'REJECTED') then auth.uid() else reviewed_by end,
      updated_at = now()
  where id = listing_id_input
  returning * into updated_listing;

  if updated_listing.id is null then
    raise exception 'Listing not found';
  end if;

  insert into public.listing_status_history (
    listing_id,
    from_status,
    to_status,
    changed_by,
    reason
  )
  values (
    listing_id_input,
    previous_status,
    target_status_input,
    auth.uid(),
    reason_input
  );

  perform public.enqueue_push_notification(
    om.profile_id,
    'MODERATION_DECISION',
    jsonb_build_object(
      'kind', 'LISTING_REVIEW',
      'listingId', listing_id_input,
      'status', target_status_input,
      'reason', reason_input
    ),
    'Listing review update',
    'Your listing review status is ' || target_status_input::text || '.'
  )
  from public.organization_members om
  where om.organization_id = updated_listing.organization_id;

  insert into public.audit_logs (
    actor_id,
    action,
    target_table,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    'LISTING_REVIEW_STATUS_CHANGED',
    'animal_listings',
    listing_id_input,
    jsonb_build_object('from_status', previous_status, 'to_status', target_status_input, 'reason', reason_input)
  );

  return updated_listing;
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

  perform public.enqueue_push_notification(
    updated_request.submitted_by,
    'MODERATION_DECISION',
    jsonb_build_object(
      'kind', 'ORGANIZATION_VERIFICATION',
      'organizationId', updated_request.organization_id,
      'requestId', updated_request.id,
      'status', target_status_input,
      'reason', reason_input
    ),
    'Rescuer access review update',
    'Your rescuer access request was ' || lower(target_status_input::text) || '.'
  );

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

  perform public.enqueue_push_notification(
    updated_report.reporter_id,
    'MODERATION_DECISION',
    jsonb_build_object(
      'kind', 'REPORT',
      'reportId', report_id_input,
      'status', target_status_input,
      'notes', notes_input
    ),
    'Report review update',
    'Your report status is ' || target_status_input || '.'
  );

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

  perform public.enqueue_push_notification(
    profile_id_input,
    'MODERATION_DECISION',
    jsonb_build_object(
      'kind', 'USER_SUSPENSION',
      'suspensionId', suspension_result.id,
      'reason', reason_input,
      'endsAt', ends_at_input
    ),
    'Account safety update',
    'A PetPal moderation decision was applied to your account.'
  );

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

  perform public.enqueue_push_notification(
    coalesce(updated_document.profile_id, auth.uid()),
    'MODERATION_DECISION',
    jsonb_build_object(
      'kind', 'VERIFICATION_DOCUMENT',
      'documentId', document_id_input,
      'status', target_status_input,
      'notes', notes_input
    ),
    'Verification document update',
    'Your verification document was ' || lower(target_status_input::text) || '.'
  );

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
