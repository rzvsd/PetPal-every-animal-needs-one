-- Home helpers who can really help (pilot list item 7).
-- A helper who "helps with care" (an active CARER of a home) now:
--   * joins the chat of every animal accepted by that home, and leaves those
--     chats when they stop helping (view-only helpers never join);
--   * gets the same foster pushes as the home owner once an animal is agreed;
--   * can leave a home on their own.
-- Phones and vet stay masked for helpers, as decided in 0038 (#27).

-- Active helpers of a home who help with care.
create or replace function public.foster_home_carers(home_input uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select m.profile_id from public.foster_home_members m
  where m.home_id = home_input and m.status = 'ACTIVE' and m.role = 'CARER'
    and public.foster_actor_active(m.profile_id);
$$;
revoke all on function public.foster_home_carers(uuid) from public,anon,authenticated;

-- A helper blocked with anyone already in a chat (the animal's side, or the
-- original owner of a transferred animal) is never added to it.
create or replace function public.blocked_with_chat(conversation_input uuid,profile_input uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.conversation_participants cp where cp.conversation_id = conversation_input
    and cp.profile_id <> profile_input and public.is_profile_blocked_between(profile_input,cp.profile_id));
$$;
revoke all on function public.blocked_with_chat(uuid,uuid) from public,anon,authenticated;

-- Adds one helper to (or removes them from) the chats of a home's agreed animals.
create or replace function public.sync_helper_chats(home_input uuid,profile_input uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists(select 1 from public.foster_home_members m where m.home_id = home_input and m.profile_id = profile_input
      and m.status = 'ACTIVE' and m.role = 'CARER') then
    insert into public.conversation_participants(conversation_id,profile_id)
    select c.id,profile_input from public.foster_requests r join public.conversations c on c.foster_request_id = r.id
    where r.home_id = home_input and r.status = 'ACCEPTED'
      and not public.blocked_with_chat(c.id,profile_input)
    on conflict do nothing;
  else
    delete from public.conversation_participants cp
    using public.conversations c, public.foster_requests r
    where c.foster_request_id = r.id and cp.conversation_id = c.id and r.home_id = home_input
      and cp.profile_id = profile_input
      and cp.profile_id not in (r.sender_id,r.recipient_id)
      and cp.profile_id is distinct from r.consent_owner_id;
  end if;
end $$;
revoke all on function public.sync_helper_chats(uuid,uuid) from public,anon,authenticated;

create or replace function public.helper_membership_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_helper_chats(new.home_id,new.profile_id);
  return new;
end $$;
revoke all on function public.helper_membership_changed() from public,anon,authenticated;
create trigger helper_membership_changed after insert or update of status,role on public.foster_home_members
  for each row execute function public.helper_membership_changed();

-- When a home accepts an animal, its helpers join that chat.
create or replace function public.helpers_join_accepted_chat()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ACCEPTED' and old.status is distinct from 'ACCEPTED' then
    insert into public.conversation_participants(conversation_id,profile_id)
    select c.id,h.id from public.conversations c, public.foster_home_carers(new.home_id) h(id)
    where c.foster_request_id = new.id
      and not public.blocked_with_chat(c.id,h.id)
    on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function public.helpers_join_accepted_chat() from public,anon,authenticated;
create trigger helpers_join_accepted_chat after update of status on public.foster_requests
  for each row execute function public.helpers_join_accepted_chat();

-- Helpers already active today join the chats of animals already agreed.
select public.sync_helper_chats(m.home_id,m.profile_id)
from public.foster_home_members m where m.status = 'ACTIVE' and m.role = 'CARER';

-- Placement pushes (arrival, ending, problems) also reach the home's helpers.
create or replace function public.foster_alert(placement_input uuid,urgent_input boolean,title_input text,body_input text)
returns void language plpgsql security definer set search_path = public as $$
declare p public.foster_placements; r public.foster_requests; conv uuid;
begin
  select * into p from public.foster_placements where id = placement_input;
  select * into r from public.foster_requests where id = p.request_id;
  select id into conv from public.conversations where foster_request_id = r.id;
  perform public.enqueue_push_notification(who.id,case when urgent_input then 'FOSTER_URGENT' else 'FOSTER_UPDATE' end,
      jsonb_build_object('placementId',p.id,'requestId',r.id,'conversationId',conv),title_input,body_input)
    from (select distinct x.id from (values
      ((select profile_id from public.foster_home_profiles where id = p.home_id)),
      (r.sender_id),(r.recipient_id),(r.consent_owner_id),
      ((select responsible_id from public.animals where id = p.animal_id))) x(id)
      union select h.id from public.foster_home_carers(p.home_id) h(id)) who
    where who.id is not null and who.id is distinct from auth.uid();
end $$;
revoke all on function public.foster_alert(uuid,boolean,text,text) from public,anon,authenticated;

-- Request pushes: helpers hear when an animal is agreed or the reservation is
-- cancelled, not about every offer.
create or replace function public.foster_notify(request_input uuid,event_input text,body_input text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.foster_requests; notification_conversation uuid; animal_name text; actor_name text; push_body text := body_input;
begin
  select * into r from public.foster_requests where id = request_input;
  select id into notification_conversation from public.conversations where foster_request_id = r.id;
  select a.name into animal_name from public.animal_listings l join public.animals a on a.id = l.animal_id where l.id = r.case_id;
  select display_name into actor_name from public.profiles where id = auth.uid();
  actor_name := coalesce(nullif(trim(actor_name),''),'Someone');
  animal_name := coalesce(animal_name,'The animal');
  push_body := case
    when event_input = 'CREATED' and r.kind = 'APPLICATION' then actor_name || ' offered a home for ' || animal_name || '. Open PetPal to answer.'
    when event_input = 'CREATED' then actor_name || ' asks if you can host ' || animal_name || '. Open PetPal to answer.'
    when event_input = 'ACCEPTED' and r.kind = 'APPLICATION' then actor_name || ' accepted. ' || animal_name || ' is reserved for your home.'
    when event_input = 'ACCEPTED' then actor_name || ' accepted. ' || animal_name || ' will come to their home.'
    when event_input = 'DECLINED' and body_input like 'Request status:%' then actor_name || ' declined this time.'
    when event_input = 'WITHDRAWN' and body_input like 'Request status:%' then actor_name || ' withdrew the offer.'
    when event_input = 'CANCELLED' and body_input like 'Request status:%' then actor_name || ' cancelled the reservation.'
    else body_input end;
  perform public.enqueue_push_notification(p.id,'FOSTER_UPDATE',jsonb_build_object('requestId',r.id,'conversationId',notification_conversation),
    animal_name,push_body)
  from (select x.id from (values(r.sender_id),(r.recipient_id)) x(id)
    union select h.id from public.foster_home_carers(r.home_id) h(id) where event_input in ('ACCEPTED','CANCELLED')) p
  where p.id <> auth.uid();
  insert into public.foster_request_events(request_id,actor_id,event,body) values(r.id,auth.uid(),event_input,body_input);
  update public.conversation_participants cp set last_read_seq = cp.last_read_seq where cp.conversation_id = notification_conversation;
end $$;
revoke all on function public.foster_notify(uuid,text,text) from public,anon,authenticated;

-- A helper can leave a home on their own (LEAVE). Everything else is as in 0020.
create or replace function public.manage_foster_member(home_id_input uuid, profile_id_input uuid, action_input text, role_input text default 'CARER')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  perform 1 from public.foster_home_profiles where id = home_id_input for update;
  if action_input in ('ACCEPT','DECLINE') then
    if profile_id_input <> auth.uid() then raise exception 'Only the invited person can respond'; end if;
    update public.foster_home_members set status = case when action_input = 'ACCEPT' then 'ACTIVE' else 'DECLINED' end,updated_at = now()
      where home_id = home_id_input and profile_id = auth.uid() and status = 'INVITED';
    if not found then raise exception 'Invitation is no longer pending'; end if;
  elsif action_input = 'LEAVE' then
    if profile_id_input <> auth.uid() then raise exception 'Only the helper can leave'; end if;
    update public.foster_home_members set status = 'REVOKED',updated_at = now()
      where home_id = home_id_input and profile_id = auth.uid() and status = 'ACTIVE';
    if not found then raise exception 'You are not helping this home'; end if;
    update public.foster_placements set carer_id = null where home_id = home_id_input and carer_id = auth.uid();
    update public.foster_tasks t set assignee_id = null from public.foster_placements p
      where p.id = t.placement_id and p.home_id = home_id_input and t.assignee_id = auth.uid();
  else
    if public.foster_home_role(home_id_input) is distinct from 'OWNER' then raise exception 'Only the home owner can manage members'; end if;
    if exists(select 1 from public.foster_home_profiles where id = home_id_input and profile_id = profile_id_input) then
      raise exception 'The owner cannot be changed here'; end if;
    if action_input = 'INVITE' then
      if not exists(select 1 from public.profiles where id = profile_id_input) then raise exception 'Member account not found'; end if;
      if public.is_profile_blocked_between(auth.uid(),profile_id_input) then raise exception 'Contact is blocked'; end if;
      insert into public.foster_home_members(home_id,profile_id,role,invited_by)
        values(home_id_input,profile_id_input,role_input,auth.uid()) on conflict(home_id,profile_id)
        do update set role = excluded.role,status = 'INVITED',invited_by = auth.uid(),updated_at = now();
      perform public.enqueue_push_notification(profile_id_input,'FOSTER_TEAM_INVITE',jsonb_build_object('homeId',home_id_input),
        'Foster team invitation','Open Foster to review a team invitation.');
    elsif action_input = 'REVOKE' then
      update public.foster_home_members set status = 'REVOKED',updated_at = now() where home_id = home_id_input and profile_id = profile_id_input;
      update public.foster_placements set carer_id = null where home_id = home_id_input and carer_id = profile_id_input;
      update public.foster_tasks t set assignee_id = null from public.foster_placements p
        where p.id = t.placement_id and p.home_id = home_id_input and t.assignee_id = profile_id_input;
    else raise exception 'Unsupported member action'; end if;
  end if;
end $$;

-- With helpers in a chat, a report names the other side of the arrangement,
-- never a helper: someone at the receiving home (owner or helper) reports the
-- animal's side (who posted the animal); anyone else (who posted it, or the
-- original owner of a transferred animal) reports the receiving home's owner.
-- Other chats, and a target who is no longer in the chat, fall back to 0045.
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
  home_owner uuid;
  case_owner uuid;
  request_row public.foster_requests;
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

  select r.* into request_row from public.conversations c join public.foster_requests r on r.id = c.foster_request_id
  where c.id = conversation_id_input;
  select h.profile_id into home_owner from public.foster_home_profiles h where h.id = request_row.home_id;
  select l.responsible_id into case_owner from public.animal_listings l where l.id = request_row.case_id;

  if request_row.id is not null then
    select cp.profile_id into reported_profile_id_result
    from public.conversation_participants cp
    where cp.conversation_id = conversation_id_input and cp.profile_id <> auth.uid()
      and cp.profile_id = case when auth.uid() = home_owner or exists(select 1 from public.foster_home_members m
          where m.home_id = request_row.home_id and m.profile_id = auth.uid() and m.status = 'ACTIVE')
        then case_owner else home_owner end;
  end if;
  if reported_profile_id_result is null then
    select cp.profile_id into reported_profile_id_result
    from public.conversation_participants cp
    where cp.conversation_id = conversation_id_input and cp.profile_id <> auth.uid()
    order by cp.created_at asc, cp.profile_id asc
    limit 1;
  end if;
  if reported_profile_id_result is null then
    raise exception 'Conversation has no reportable participant';
  end if;

  select m.id into latest_message_id_result
  from public.messages m
  where m.conversation_id = conversation_id_input and m.sender_id = reported_profile_id_result
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

notify pgrst, 'reload schema';
