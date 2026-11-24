-- Reports with context (pilot list item 2).
-- A chat report now records which conversation it is about in its own column
-- and keeps a snapshot of the last messages, so a moderator sees what was said
-- without opening the chat. Details hold only what the reporter wrote.

alter table public.reports add column conversation_id uuid references public.conversations(id) on delete set null;
alter table public.reports add column context jsonb;
create index reports_conversation_idx on public.reports(reporter_id, conversation_id) where conversation_id is not null;

-- Older chat reports kept the conversation id as the first line of details.
update public.reports r
set conversation_id = c.id,
    details = nullif(trim(regexp_replace(r.details, '^Conversation ID: [0-9a-f-]{36}\s*', '')), '')
from public.conversations c
where r.details ~ '^Conversation ID: [0-9a-f-]{36}'
  and c.id = substring(r.details from '^Conversation ID: ([0-9a-f-]{36})')::uuid;

-- "Reported by me" now reads the column instead of searching the text.
do $$
declare
  definition text := pg_get_viewdef('public.my_conversations_view'::regclass, true);
  options text[] := (select reloptions from pg_class where oid = 'public.my_conversations_view'::regclass);
  old_check text := $q$r.details ~~ (('%'::text || c.conversation_id::text) || '%'::text)$q$;
  old_check_parens text := $q$r.details ~~ (('%'::text || (c.conversation_id)::text) || '%'::text)$q$;
begin
  if position(old_check_parens in definition) > 0 then
    definition := replace(definition, old_check_parens, 'r.conversation_id = c.conversation_id');
  elsif position(old_check in definition) > 0 then
    definition := replace(definition, old_check, 'r.conversation_id = c.conversation_id');
  else
    raise exception 'my_conversations_view: reported_by_me check not found';
  end if;
  execute 'create or replace view public.my_conversations_view'
    || case when options is null then '' else ' with (' || array_to_string(options, ', ') || ')' end
    || ' as ' || definition;
end $$;

-- Context can only be written by PetPal's own functions, never by a direct insert.
create or replace function public.guard_report_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  new.status := 'OPEN';
  new.resolved_at := null;
  if current_user in ('authenticated', 'anon') then
    new.context := null;
    new.conversation_id := null;
  end if;
  if new.reporter_id is not null and (new.reported_profile_id = new.reporter_id
    or exists(select 1 from public.messages m where m.id = new.message_id and m.sender_id = new.reporter_id)) then
    raise exception 'You cannot report yourself'; end if;
  if new.reporter_id is not null and new.reporter_id = auth.uid() and (
    select count(*) from public.reports r where r.reporter_id = auth.uid() and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'Report limit reached. Please try again later.'; end if;
  return new;
end $$;
revoke all on function public.guard_report_insert() from public, anon, authenticated;

-- The last 10 messages the reporter can see, oldest first, with names.
create or replace function public.report_chat_snapshot(conversation_id_input uuid, reporter_id_input uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    -- The view answers for the caller (auth.uid()), who is the reporter.
    'animal', (select v.animal_name from public.my_conversations_view v where v.conversation_id = conversation_id_input),
    'messages', coalesce((select jsonb_agg(jsonb_build_object(
        'from', coalesce(p.display_name, 'Deleted account'),
        'reporter', m.sender_id = reporter_id_input,
        'body', left(m.body, 500),
        'at', m.created_at) order by m.message_seq)
      from (select * from public.messages
        where conversation_id = conversation_id_input
          and not public.conversation_hidden(conversation_id_input, reporter_id_input)
        order by message_seq desc limit 10) m
      left join public.profiles p on p.id = m.sender_id), '[]'::jsonb));
$$;
revoke all on function public.report_chat_snapshot(uuid, uuid) from public, anon, authenticated;

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
  normalized_category text := upper(coalesce(nullif(trim(category_input), ''), 'CONVERSATION_SAFETY'));
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_conversation_participant(conversation_id_input) then
    raise exception 'Conversation not found or not accessible';
  end if;
  if normalized_category not in ('ANIMAL_DANGER', 'SPAM', 'ABUSE', 'MISLEADING', 'OTHER', 'CONVERSATION_SAFETY', 'SAFETY_CONCERN') then
    raise exception 'Choose why you are reporting';
  end if;
  if char_length(coalesce(details_input, '')) > 2000 then
    raise exception 'Report details are too long';
  end if;

  select cp.profile_id into reported_profile_id_result
  from public.conversation_participants cp
  where cp.conversation_id = conversation_id_input and cp.profile_id <> auth.uid()
  order by cp.created_at asc, cp.profile_id asc
  limit 1;
  if reported_profile_id_result is null then
    raise exception 'Conversation has no reportable participant';
  end if;

  select m.id into latest_message_id_result
  from public.messages m
  where m.conversation_id = conversation_id_input and m.sender_id <> auth.uid()
  order by m.message_seq desc
  limit 1;

  insert into public.reports (reporter_id, reported_profile_id, message_id, conversation_id, category, details, context)
  values (auth.uid(), reported_profile_id_result, latest_message_id_result, conversation_id_input, normalized_category,
    nullif(trim(coalesce(details_input, '')), ''), public.report_chat_snapshot(conversation_id_input, auth.uid()))
  returning id into report_id_result;

  return report_id_result;
end;
$$;
revoke all on function public.report_conversation(uuid, text, text) from public, anon;
grant execute on function public.report_conversation(uuid, text, text) to authenticated;

-- Moderators see the conversation and the snapshot next to the names.
create or replace view public.platform_reports_view as
select r.id,r.category,r.details,r.status,r.priority,r.created_at,r.updated_at,r.listing_id,r.message_id,
  r.reporter_id,coalesce(rp.display_name,'Automatic flag') as reporter_name,
  r.reported_profile_id,tp.display_name as reported_name,l.title as listing_title,
  r.conversation_id,r.context
from public.reports r left join public.profiles rp on rp.id = r.reporter_id
left join public.profiles tp on tp.id = r.reported_profile_id left join public.animal_listings l on l.id = r.listing_id
where public.has_admin_role('MODERATOR') or public.has_admin_role('SUPER_ADMIN');
grant select on public.platform_reports_view to authenticated;

notify pgrst, 'reload schema';
