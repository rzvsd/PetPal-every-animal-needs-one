create or replace function public.is_profile_blocked_between(
  first_profile_id uuid,
  second_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.blocks b
    where (b.blocker_id = first_profile_id and b.blocked_id = second_profile_id)
       or (b.blocker_id = second_profile_id and b.blocked_id = first_profile_id)
  );
$$;

create or replace function public.is_conversation_blocked(
  target_conversation_id uuid,
  actor_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = target_conversation_id
      and cp.profile_id <> actor_profile_id
      and public.is_profile_blocked_between(cp.profile_id, actor_profile_id)
  );
$$;

drop policy if exists messages_participant_insert on public.messages;

create policy messages_participant_insert
on public.messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.is_conversation_participant(conversation_id)
  and not public.is_conversation_blocked(conversation_id, auth.uid())
);

create or replace view public.my_conversations_view as
select
  c.id as conversation_id,
  c.application_id,
  app.status as application_status,
  l.id as listing_id,
  l.mode,
  l.title,
  a.name as animal_name,
  o.name as organization_name,
  c.created_at,
  (
    select string_agg(p.display_name, ', ' order by p.display_name)
    from public.conversation_participants cp_other
    join public.profiles p on p.id = cp_other.profile_id
    where cp_other.conversation_id = c.id
      and cp_other.profile_id <> auth.uid()
  ) as other_participants,
  (
    select m.body
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) as last_message_body,
  (
    select m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) as last_message_at
from public.conversations c
join public.conversation_participants cp on cp.conversation_id = c.id
join public.applications app on app.id = c.application_id
join public.animal_listings l on l.id = app.listing_id
join public.animals a on a.id = l.animal_id
join public.organizations o on o.id = l.organization_id
where cp.profile_id = auth.uid()
  and app.status = 'ACCEPTED';

create or replace view public.conversation_messages_view as
select
  m.id as message_id,
  m.conversation_id,
  m.sender_id,
  p.display_name as sender_display_name,
  m.body,
  m.created_at,
  (m.sender_id = auth.uid()) as is_mine
from public.messages m
join public.profiles p on p.id = m.sender_id
where public.is_conversation_participant(m.conversation_id)
  and not public.is_conversation_blocked(m.conversation_id, auth.uid());

grant select on public.my_conversations_view to authenticated;
grant select on public.conversation_messages_view to authenticated;

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
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if target_status_input not in ('IN_REVIEW', 'ACCEPTED', 'REJECTED') then
    raise exception 'Unsupported application review status';
  end if;

  select app.status into previous_status
  from public.applications app
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

  insert into public.notification_events (profile_id, event_type, payload)
  values (
    updated_application.applicant_id,
    'APPLICATION_' || target_status_input::text,
    jsonb_build_object(
      'applicationId', updated_application.id,
      'listingId', updated_application.listing_id,
      'status', target_status_input
    )
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

    insert into public.notification_events (profile_id, event_type, payload)
    values (
      updated_application.applicant_id,
      'CONVERSATION_OPENED',
      jsonb_build_object(
        'applicationId', updated_application.id,
        'conversationId', conversation_id_result
      )
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

  insert into public.messages (conversation_id, sender_id, body)
  values (conversation_id_input, auth.uid(), trim(body_input))
  returning id into message_id_result;

  insert into public.notification_events (profile_id, event_type, payload)
  select
    cp.profile_id,
    'MESSAGE_RECEIVED',
    jsonb_build_object(
      'conversationId', conversation_id_input,
      'messageId', message_id_result,
      'senderId', auth.uid()
    )
  from public.conversation_participants cp
  where cp.conversation_id = conversation_id_input
    and cp.profile_id <> auth.uid();

  return message_id_result;
end;
$$;

create or replace function public.report_message(
  message_id_input uuid,
  category_input text,
  details_input text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  report_id_result uuid;
  reported_profile_id_result uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select m.sender_id into reported_profile_id_result
  from public.messages m
  where m.id = message_id_input
    and public.is_conversation_participant(m.conversation_id);

  if reported_profile_id_result is null then
    raise exception 'Message not found or not reportable';
  end if;

  insert into public.reports (
    reporter_id,
    reported_profile_id,
    message_id,
    category,
    details
  )
  values (
    auth.uid(),
    nullif(reported_profile_id_result, auth.uid()),
    message_id_input,
    category_input,
    details_input
  )
  returning id into report_id_result;

  return report_id_result;
end;
$$;

create or replace function public.block_profile(blocked_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if blocked_id_input = auth.uid() then
    raise exception 'Users cannot block themselves';
  end if;

  if not exists (
    select 1
    from public.conversation_participants mine
    join public.conversation_participants theirs
      on theirs.conversation_id = mine.conversation_id
     and theirs.profile_id = blocked_id_input
    where mine.profile_id = auth.uid()
  ) then
    raise exception 'Users can only block profiles they have a shared conversation with';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (auth.uid(), blocked_id_input)
  on conflict do nothing;
end;
$$;
