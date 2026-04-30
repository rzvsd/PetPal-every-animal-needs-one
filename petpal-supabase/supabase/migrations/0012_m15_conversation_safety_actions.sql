drop view if exists public.my_conversations_view;

create view public.my_conversations_view as
select
  c.id as conversation_id,
  c.application_id,
  app.status as application_status,
  l.id as listing_id,
  l.mode,
  l.title,
  l.city,
  l.coarse_area,
  a.name as animal_name,
  o.name as organization_name,
  o.verification_status as organization_verification_status,
  c.created_at,
  (
    select string_agg(p.display_name, ', ' order by p.display_name)
    from public.conversation_participants cp_other
    join public.profiles p on p.id = cp_other.profile_id
    where cp_other.conversation_id = c.id
      and cp_other.profile_id <> auth.uid()
  ) as other_participants,
  (
    select array_agg(cp_other.profile_id order by cp_other.profile_id)
    from public.conversation_participants cp_other
    where cp_other.conversation_id = c.id
      and cp_other.profile_id <> auth.uid()
  ) as other_participant_ids,
  (
    select exists (
      select 1
      from public.blocks b
      join public.conversation_participants cp_other
        on cp_other.conversation_id = c.id
       and cp_other.profile_id = b.blocked_id
      where b.blocker_id = auth.uid()
    )
  ) as blocked_by_me,
  (
    select exists (
      select 1
      from public.reports r
      where r.reporter_id = auth.uid()
        and r.details like '%' || c.id::text || '%'
    )
  ) as reported_by_me,
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

grant select on public.my_conversations_view to authenticated;

create or replace function public.report_conversation(
  conversation_id_input uuid,
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
  latest_message_id_result uuid;
  normalized_category text;
  normalized_details text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_conversation_participant(conversation_id_input) then
    raise exception 'Conversation not found or not accessible';
  end if;

  select cp.profile_id into reported_profile_id_result
  from public.conversation_participants cp
  where cp.conversation_id = conversation_id_input
    and cp.profile_id <> auth.uid()
  order by cp.created_at asc, cp.profile_id asc
  limit 1;

  if reported_profile_id_result is null then
    raise exception 'Conversation has no reportable participant';
  end if;

  select m.id into latest_message_id_result
  from public.messages m
  where m.conversation_id = conversation_id_input
    and m.sender_id <> auth.uid()
  order by m.created_at desc
  limit 1;

  normalized_category := coalesce(nullif(trim(category_input), ''), 'CONVERSATION_SAFETY');
  normalized_details := concat(
    'Conversation ID: ',
    conversation_id_input::text,
    E'\n',
    coalesce(nullif(trim(details_input), ''), 'Conversation reported from mobile safety menu.')
  );

  insert into public.reports (
    reporter_id,
    reported_profile_id,
    message_id,
    category,
    details
  )
  values (
    auth.uid(),
    reported_profile_id_result,
    latest_message_id_result,
    normalized_category,
    normalized_details
  )
  returning id into report_id_result;

  return report_id_result;
end;
$$;

create or replace function public.block_conversation(
  conversation_id_input uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  blocked_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_conversation_participant(conversation_id_input) then
    raise exception 'Conversation not found or not accessible';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  select auth.uid(), cp.profile_id
  from public.conversation_participants cp
  where cp.conversation_id = conversation_id_input
    and cp.profile_id <> auth.uid()
  on conflict do nothing;

  get diagnostics blocked_count = row_count;

  if blocked_count = 0 and not exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversation_id_input
      and cp.profile_id <> auth.uid()
  ) then
    raise exception 'Conversation has no blockable participant';
  end if;

  return blocked_count;
end;
$$;
