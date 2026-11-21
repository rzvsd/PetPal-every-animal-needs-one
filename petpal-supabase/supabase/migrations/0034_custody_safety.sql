-- Custody safety from the product review (items 1 to 3, 6 and 9) and the
-- stress test: two-sided endings with an outcome, the owner kept in every
-- transfer, a block that cannot erase the placement chat, the owner's own
-- notes and tasks, contacts for emergencies, and a vet alert that reaches the owner.

-- Endings, contacts and the post-care chat window live on the placement.
alter table public.foster_placements
  add column outcome text check (outcome in ('RETURNED','ADOPTED_BY_FOSTER','ADOPTED_ELSEWHERE','MOVED','LOST','DIED','OTHER')),
  add column ended_by uuid references public.profiles(id),
  add column end_confirmed_at timestamptz,
  add column contest_until timestamptz,
  add column chat_open_until timestamptz,
  add column emergency_phone text check (char_length(emergency_phone) <= 40),
  add column vet_contact text check (char_length(vet_contact) <= 200),
  add column foster_phone text check (char_length(foster_phone) <= 40);

-- The person who first posted the animal is asked before it moves to another home.
alter table public.foster_requests
  add column consent_owner_id uuid references public.profiles(id),
  add column owner_consent text check (owner_consent in ('PENDING','APPROVED','REFUSED','NO_ANSWER')),
  add column consent_asked_at timestamptz;

-- The animal's original owner can always see where it is, across transfers.
create or replace function public.foster_placement_visible(placement_input uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.foster_placements p join public.animals a on a.id = p.animal_id where p.id = placement_input
    and (public.foster_home_role(p.home_id) is not null or a.responsible_id = auth.uid() or exists(
      select 1 from public.foster_requests r where r.id = p.request_id and auth.uid() in (r.sender_id,r.recipient_id))));
$$;
create or replace function public.foster_request_visible(request_input uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.foster_requests r where r.id = request_input
    and (auth.uid() in (r.sender_id,r.recipient_id,r.consent_owner_id) or public.foster_home_role(r.home_id) is not null));
$$;

-- Everyone with a stake in one animal's care: the home owner, both request
-- parties and the original owner. Alerts go to all of them except the actor.
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
      ((select responsible_id from public.animals where id = p.animal_id))) x(id)) who
    where who.id is not null and who.id is distinct from auth.uid();
end $$;
revoke all on function public.foster_alert(uuid,boolean,text,text) from public,anon,authenticated;

-- Foster chats stay writable while the request is open and for 14 days
-- after care ends, so a last photo or adoption news can still be shared.
create or replace function public.foster_chat_writable(request_input uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.foster_requests r where r.id = request_input and (r.status in ('PENDING','ACCEPTED')
    or exists(select 1 from public.foster_placements p where p.request_id = r.id and p.chat_open_until > now())));
$$;
revoke all on function public.foster_chat_writable(uuid) from public,anon;
grant execute on function public.foster_chat_writable(uuid) to authenticated;

create or replace function public.guard_foster_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare c public.conversations;
begin
  select * into c from public.conversations where id = new.conversation_id for update;
  if c.foster_request_id is not null and not public.foster_chat_writable(c.foster_request_id) then
    raise exception 'This foster conversation is read-only'; end if;
  if not public.foster_actor_active(new.sender_id) then raise exception 'Account unavailable'; end if;
  return new;
end $$;

-- While an animal is reserved or in care (and in the 14 days after), a block
-- stops free writing but the placement chat stays readable for both sides.
create or replace function public.conversation_history_kept(conversation_input uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.conversations c join public.foster_placements p on p.request_id = c.foster_request_id
    where c.id = conversation_input and (p.status in ('RESERVED','IN_CARE') or p.chat_open_until > now()));
$$;
create or replace function public.conversation_hidden(conversation_input uuid,actor_input uuid)
returns boolean language sql stable set search_path = public as $$
  select public.is_conversation_blocked(conversation_input,actor_input) and not public.conversation_history_kept(conversation_input);
$$;
revoke all on function public.conversation_history_kept(uuid) from public,anon;
revoke all on function public.conversation_hidden(uuid,uuid) from public,anon;
grant execute on function public.conversation_history_kept(uuid),public.conversation_hidden(uuid,uuid) to authenticated;

drop policy messages_participant_read on public.messages;
create policy messages_participant_read on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id) and not public.conversation_hidden(conversation_id,auth.uid()));

-- A block during a placement is put in front of the moderator.
create or replace function public.flag_block_during_placement()
returns trigger language plpgsql security definer set search_path = public as $$
declare hit record;
begin
  select p.id,a.name into hit from public.foster_placements p join public.animals a on a.id = p.animal_id
    left join public.foster_requests r on r.id = p.request_id
    join public.foster_home_profiles h on h.id = p.home_id
    where p.status in ('RESERVED','IN_CARE')
      and new.blocker_id in (h.profile_id,r.sender_id,r.recipient_id,a.responsible_id)
      and new.blocked_id in (h.profile_id,r.sender_id,r.recipient_id,a.responsible_id)
    limit 1;
  if hit.id is not null then
    insert into public.reports(reporter_id,reported_profile_id,category,details)
      values(null,new.blocked_id,'BLOCK_DURING_PLACEMENT',
        'Automatic flag: one participant blocked the other while ' || coalesce(hit.name,'an animal') ||
        ' is reserved or in care. Placement ' || hit.id || '. Blocked by ' || new.blocker_id || '.');
  end if;
  return new;
end $$;
create trigger flag_block_during_placement after insert on public.blocks
  for each row execute function public.flag_block_during_placement();
revoke all on function public.flag_block_during_placement() from public,anon,authenticated;

-- Transfers ask the original owner first. After 7 days without an answer the
-- receiving side may go ahead; the record says so and the moderator is told.
create or replace function public.create_foster_request(request_id_input uuid,case_id_input uuid,home_id_input uuid,kind_input text,message_input text)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.foster_requests; l public.animal_listings; h public.foster_home_profiles;
  result uuid := coalesce(request_id_input,gen_random_uuid()); sender uuid; recipient uuid; conversation_id uuid; previous_id uuid;
  original_owner uuid; animal_name text;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  if kind_input not in ('APPLICATION','INVITE') or char_length(trim(coalesce(message_input,''))) not between 1 and 4000 then
    raise exception 'Choose a request type and write a message'; end if;
  select * into l from public.animal_listings where id = case_id_input and mode = 'FOSTER';
  select * into h from public.foster_home_profiles where id = home_id_input;
  if l.id is null or h.id is null or l.status <> 'ACTIVE' or not public.foster_actor_active(l.responsible_id)
    or not public.foster_actor_active(h.profile_id) then raise exception 'Case or home unavailable'; end if;
  if l.responsible_id = h.profile_id or public.is_profile_blocked_between(l.responsible_id,h.profile_id) then
    raise exception 'This request cannot be sent'; end if;
  if kind_input = 'APPLICATION' then
    if h.profile_id <> auth.uid() then raise exception 'Only the receiving home owner can apply'; end if;
    sender := h.profile_id; recipient := l.responsible_id;
  else
    if l.responsible_id <> auth.uid() or not h.published then raise exception 'Only the case owner can invite a listed home'; end if;
    sender := l.responsible_id; recipient := h.profile_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('foster-request:' || l.id::text || h.id::text,0));
  select * into r from public.foster_requests where id = result;
  if found then
    if r.case_id <> l.id or r.home_id <> h.id or r.created_by <> auth.uid() or r.kind <> kind_input then
      raise exception 'Request ID already used'; end if;
    return r.id;
  end if;
  select * into r from public.foster_requests where case_id = l.id and home_id = h.id and status in ('PENDING','ACCEPTED');
  if found then return r.id; end if;
  if public.foster_case_placed(l.id) then raise exception 'This animal has already found a home'; end if;
  select p.id into previous_id from public.foster_placements p join public.foster_home_profiles ph on ph.id = p.home_id
    where p.animal_id = l.animal_id and p.status = 'IN_CARE' and ph.profile_id = l.responsible_id;
  select a.responsible_id,a.name into original_owner,animal_name from public.animals a where a.id = l.animal_id;
  if previous_id is null or original_owner in (l.responsible_id,h.profile_id) then original_owner := null; end if;
  insert into public.foster_requests(id,case_id,home_id,created_by,sender_id,recipient_id,kind,message,previous_placement_id,
      consent_owner_id,owner_consent,consent_asked_at)
    values(result,l.id,h.id,auth.uid(),sender,recipient,kind_input,trim(message_input),previous_id,
      original_owner,case when original_owner is not null then 'PENDING' end,case when original_owner is not null then now() end);
  insert into public.conversations(source,foster_request_id) values('FOSTER',result) returning id into conversation_id;
  insert into public.conversation_participants(conversation_id,profile_id) values(conversation_id,sender),(conversation_id,recipient);
  if original_owner is not null then
    insert into public.conversation_participants(conversation_id,profile_id) values(conversation_id,original_owner) on conflict do nothing;
    perform public.enqueue_push_notification(original_owner,'FOSTER_URGENT',jsonb_build_object('requestId',result,'conversationId',conversation_id),
      'Transfer needs your answer',coalesce(animal_name,'Your animal') || ' may move to another foster home. Open PetPal to agree or refuse.');
    insert into public.foster_request_events(request_id,actor_id,event,body)
      values(result,auth.uid(),'CONSENT_ASKED','The animal''s owner was asked to agree to this transfer.');
  end if;
  perform public.send_conversation_message(conversation_id,trim(message_input),result);
  perform public.foster_notify(result,'CREATED','A participant sent a foster request. Discuss the arrangement before accepting.');
  return result;
end $$;

create or replace function public.respond_transfer_consent(request_id_input uuid,approve_input boolean,note_input text default '')
returns text language plpgsql security definer set search_path = public as $$
declare r public.foster_requests; result text;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  select * into r from public.foster_requests where id = request_id_input for update;
  if r.id is null or r.consent_owner_id is distinct from auth.uid() then raise exception 'Only the animal''s owner can answer this transfer'; end if;
  if r.status not in ('PENDING','ACCEPTED') then raise exception 'This transfer is already closed'; end if;
  if char_length(coalesce(note_input,'')) > 2000 then raise exception 'Note is too long'; end if;
  result := case when approve_input then 'APPROVED' else 'REFUSED' end;
  if r.owner_consent = result then return result; end if;
  if not approve_input and exists(select 1 from public.foster_placements where request_id = r.id and status = 'IN_CARE') then
    raise exception 'The animal already arrived at the new home. Use "Something is not right" on the placement instead.'; end if;
  update public.foster_requests set owner_consent = result,updated_at = clock_timestamp() where id = r.id;
  if not approve_input and r.status = 'ACCEPTED' then
    update public.foster_placements set status = 'CANCELLED',ended_at = now(),updated_at = clock_timestamp()
      where request_id = r.id and status = 'RESERVED';
    update public.foster_requests set status = 'CANCELLED',updated_at = clock_timestamp() where id = r.id;
  end if;
  perform public.foster_notify(r.id,'CONSENT_' || result,
    case when approve_input then 'The animal''s owner agreed to this transfer.' else 'The animal''s owner refused this transfer.' end
    || coalesce(' ' || nullif(trim(note_input),''),''));
  return result;
end $$;
revoke all on function public.respond_transfer_consent(uuid,boolean,text) from public,anon;
grant execute on function public.respond_transfer_consent(uuid,boolean,text) to authenticated;

create or replace function public.respond_foster_request(request_id_input uuid,action_input text,expected_updated_at_input timestamptz,
  acknowledge_capacity_input boolean default false,reason_input text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.foster_requests; placement public.foster_placements; l public.animal_listings; next_status text;
  result uuid; conversation_id uuid; other record; animal_name text;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  -- Serialize with message sends before changing request/placement state.
  select id into conversation_id from public.conversations where foster_request_id = request_id_input for update;
  select * into r from public.foster_requests where id = request_id_input for update;
  if r.id is null or auth.uid() not in (r.sender_id,r.recipient_id) then raise exception 'Request not accessible'; end if;
  select * into placement from public.foster_placements where request_id = r.id;
  if action_input = 'ACCEPT' and r.status = 'ACCEPTED' and placement.id is not null then return placement.id; end if;
  if r.updated_at is distinct from expected_updated_at_input then raise exception 'Request changed. Reload before deciding.'; end if;
  if action_input = 'ACCEPT' then
    if r.status not in ('PENDING','ACCEPTED') or (r.status = 'PENDING' and auth.uid() <> r.recipient_id) then
      raise exception 'Only the recipient can accept a pending request'; end if;
    if public.is_profile_blocked_between(r.sender_id,r.recipient_id) or not public.foster_actor_active(r.sender_id)
      or not public.foster_actor_active(r.recipient_id) then raise exception 'Contact is unavailable'; end if;
    if r.owner_consent = 'REFUSED' then raise exception 'The animal''s owner refused this transfer'; end if;
    if r.owner_consent = 'PENDING' and r.consent_asked_at > now() - interval '7 days' then
      raise exception 'Waiting for the animal''s owner to agree to this transfer. If they do not answer within 7 days, you can go ahead.'; end if;
    select * into l from public.animal_listings where id = r.case_id;
    if l.status <> 'ACTIVE' then raise exception 'Case is no longer active'; end if;
    perform 1 from public.animals where id = l.animal_id for update;
    perform 1 from public.foster_home_profiles where id = r.home_id for update;
    if exists(select 1 from public.foster_placements p where p.animal_id = l.animal_id and p.status in ('IN_CARE','RESERVED')
      and p.id is distinct from r.previous_placement_id) then raise exception 'Animal already has an active placement or reservation'; end if;
    if r.previous_placement_id is not null and not exists(select 1 from public.foster_placements p
      join public.foster_home_profiles h on h.id = p.home_id where p.id = r.previous_placement_id
      and p.status = 'IN_CARE' and h.profile_id = l.responsible_id) then raise exception 'Source placement changed'; end if;
    if coalesce(public.foster_capacity_warning(r.home_id,l.animal_id),false) and not acknowledge_capacity_input then
      raise exception using message = 'CAPACITY_ACK_REQUIRED', detail = 'Declared capacity, availability or species preference would be exceeded. Confirm explicitly to continue.'; end if;
    insert into public.foster_placements(animal_id,home_id,request_id,previous_placement_id,status,provenance,created_by)
      values(l.animal_id,r.home_id,r.id,r.previous_placement_id,'RESERVED','Participant agreement in PetPal',auth.uid()) returning id into result;
    insert into public.foster_journal(placement_id,actor_id,event,body) values(result,auth.uid(),'RESERVED',
      case when acknowledge_capacity_input then 'Reservation accepted with explicit capacity/availability acknowledgement.' else 'Reservation accepted. Receipt is not yet declared.' end);
    if r.owner_consent = 'PENDING' then
      update public.foster_requests set owner_consent = 'NO_ANSWER' where id = r.id;
      insert into public.foster_journal(placement_id,actor_id,event,body) values(result,auth.uid(),'OWNER_NO_ANSWER',
        'The animal''s owner did not answer within 7 days. The transfer went ahead; PetPal moderation was told.');
      insert into public.reports(reporter_id,reported_profile_id,category,details)
        values(null,r.consent_owner_id,'TRANSFER_WITHOUT_OWNER','Automatic flag: a transfer went ahead after the animal''s owner did not answer for 7 days. Request ' || r.id || '.');
    end if;
    next_status := 'ACCEPTED';
  elsif action_input in ('DECLINE','WITHDRAW') then
    if r.status <> 'PENDING' or (action_input = 'DECLINE' and auth.uid() <> r.recipient_id)
      or (action_input = 'WITHDRAW' and auth.uid() <> r.sender_id) then raise exception 'Action not available'; end if;
    next_status := case when action_input = 'DECLINE' then 'DECLINED' else 'WITHDRAWN' end;
  elsif action_input = 'CANCEL' then
    if r.status <> 'ACCEPTED' or (placement.id is not null and placement.status <> 'RESERVED') then
      raise exception 'Only a reservation can be cancelled; record an ending for an animal already in care'; end if;
    if char_length(trim(coalesce(reason_input,''))) not between 1 and 2000 then raise exception 'Cancellation reason required'; end if;
    update public.foster_placements set status = 'CANCELLED',ended_at = now(),updated_at = clock_timestamp() where id = placement.id;
    if placement.id is not null then insert into public.foster_journal(placement_id,actor_id,event,body)
      values(placement.id,auth.uid(),'CANCELLED',trim(reason_input)); end if;
    next_status := 'CANCELLED';
  else raise exception 'Unsupported request action'; end if;
  update public.foster_requests set status = next_status,updated_at = clock_timestamp() where id = r.id;
  perform public.foster_notify(r.id,next_status,coalesce(nullif(trim(reason_input),''),'Request status: ' || next_status));
  if next_status = 'ACCEPTED' then
    select a.name into animal_name from public.animals a where a.id = l.animal_id;
    for other in select fr.id from public.foster_requests fr where fr.case_id = r.case_id and fr.id <> r.id and fr.status = 'PENDING'
      order by fr.id for update loop
      update public.foster_requests set status = 'PLACED_ELSEWHERE',updated_at = clock_timestamp() where id = other.id;
      perform public.foster_notify(other.id,'PLACED_ELSEWHERE',
        coalesce(animal_name,'This animal') || ' has found a home with someone else. Thank you for offering.');
    end loop;
  end if;
  return result;
end $$;

-- Placement actions. Either side may end care with an outcome; the other
-- side is told and has 7 days to contest; the chat stays open 14 days; the
-- case is archived instead of quietly returning to the public list.
create or replace function public.update_foster_placement(placement_id_input uuid,action_input text,data_input jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare p public.foster_placements; r public.foster_requests; home_owner uuid; member_role text; case_side boolean;
  animal_row public.animals; outcome_value text := nullif(data_input->>'outcome','');
  body text := trim(coalesce(data_input->>'body','')); assignee uuid := nullif(data_input->>'carerId','')::uuid;
  space uuid := nullif(data_input->>'spaceId','')::uuid; previous public.foster_placements;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  -- Match the request/message lock order before the placement lock.
  perform 1 from public.conversations c join public.foster_placements fp on fp.request_id = c.foster_request_id
    where fp.id = placement_id_input for update of c;
  select * into p from public.foster_placements where id = placement_id_input for update;
  if p.id is null or not public.foster_placement_visible(p.id) then raise exception 'Placement not accessible'; end if;
  member_role := public.foster_home_role(p.home_id);
  select profile_id into home_owner from public.foster_home_profiles where id = p.home_id;
  select * into r from public.foster_requests where id = p.request_id;
  select * into animal_row from public.animals where id = p.animal_id;
  -- The person who handed the animal over: a request party outside the home, or its original owner.
  case_side := member_role is null and (auth.uid() = animal_row.responsible_id
    or (r.id is not null and auth.uid() in (r.sender_id,r.recipient_id)));
  if action_input = 'RECEIVE' and p.status = 'IN_CARE' and p.received_by = auth.uid() then return; end if;
  if action_input not in ('NOTE','DISPUTE','CLARIFY','CONFIRM_END','CONTACTS') and (data_input->>'expectedUpdatedAt')::timestamptz is distinct from p.updated_at then
    raise exception 'Placement changed. Reload before saving.'; end if;
  if action_input = 'RECEIVE' then
    if auth.uid() <> home_owner or p.status <> 'RESERVED' then raise exception 'Only the receiving home owner can declare receipt'; end if;
    perform 1 from public.animals where id = p.animal_id for update;
    if p.previous_placement_id is not null then
      update public.foster_placements set status = 'COMPLETED',ended_at = now(),updated_at = clock_timestamp(),
          outcome = 'MOVED',ended_by = auth.uid(),contest_until = now() + interval '7 days',chat_open_until = now() + interval '14 days'
        where id = p.previous_placement_id and status = 'IN_CARE' returning * into previous;
      if previous.id is null then raise exception 'Source placement changed'; end if;
      insert into public.foster_journal(placement_id,actor_id,event,body)
        values(p.previous_placement_id,auth.uid(),'TRANSFERRED','Receipt declared by the receiving foster at the destination home.');
      update public.foster_requests set status = 'COMPLETED',updated_at = clock_timestamp()
        where id = previous.request_id;
      perform public.foster_alert(previous.id,true,'Animal moved',
        coalesce(animal_row.name,'Your animal') || ' arrived at a new foster home. You can follow it in PetPal.');
    end if;
    update public.foster_placements set status = 'IN_CARE',received_by = auth.uid(),received_at = now(),updated_at = clock_timestamp() where id = p.id;
    body := 'Receipt declared by the receiving foster. This is not a PetPal verification.';
  elsif action_input = 'END' then
    if p.status <> 'IN_CARE' or not (member_role = 'OWNER' or case_side) then
      raise exception 'Only the home owner or the animal''s owner can end current care'; end if;
    if exists(select 1 from public.foster_placements where previous_placement_id = p.id and status = 'RESERVED') then
      raise exception 'A transfer is reserved. Complete or cancel it before ending this placement.'; end if;
    if outcome_value is null or outcome_value not in ('RETURNED','ADOPTED_BY_FOSTER','ADOPTED_ELSEWHERE','LOST','DIED','OTHER') then
      raise exception 'Choose how the care ended'; end if;
    if char_length(body) > 2000 then raise exception 'Ending note is too long'; end if;
    if body = '' then body := 'Care ended: ' || outcome_value; end if;
    update public.foster_placements set status = 'COMPLETED',ended_at = now(),updated_at = clock_timestamp(),outcome = outcome_value,
      ended_by = auth.uid(),contest_until = now() + interval '7 days',chat_open_until = now() + interval '14 days',
      end_confirmed_at = case when case_side and outcome_value = 'RETURNED' then now() end
      where id = p.id;
    update public.foster_requests set status = 'COMPLETED',updated_at = clock_timestamp() where id = p.request_id;
    update public.animal_listings set status = 'ARCHIVED',updated_at = clock_timestamp()
      where id = r.case_id and status in ('ACTIVE','PAUSED') and not moderation_hold;
    perform public.foster_alert(p.id,true,'Care ended',
      coalesce(animal_row.name,'The animal') || ': care was marked as ended. Open PetPal to confirm or tell the other side if something is wrong (7 days).');
  elsif action_input = 'CONFIRM_END' then
    if p.status <> 'COMPLETED' or p.ended_by = auth.uid() or not (member_role = 'OWNER' or case_side) then
      raise exception 'Only the other side can confirm this ending'; end if;
    if p.end_confirmed_at is not null then return; end if;
    update public.foster_placements set end_confirmed_at = now(),updated_at = clock_timestamp() where id = p.id;
    body := 'The other side confirmed how care ended.';
  elsif action_input = 'CONTACTS' then
    if not (member_role = 'OWNER' or case_side) or p.status not in ('RESERVED','IN_CARE') then
      raise exception 'Contacts can be shared only by the two sides of an active placement'; end if;
    if case_side then
      update public.foster_placements set emergency_phone = nullif(trim(coalesce(data_input->>'emergencyPhone','')),''),
        vet_contact = nullif(trim(coalesce(data_input->>'vetContact','')),''),updated_at = clock_timestamp() where id = p.id;
    else
      update public.foster_placements set foster_phone = nullif(trim(coalesce(data_input->>'fosterPhone','')),''),
        updated_at = clock_timestamp() where id = p.id;
    end if;
    body := 'Emergency contacts updated.';
  elsif action_input = 'CARE' then
    if member_role is null or member_role not in ('OWNER','CARER') or p.status not in ('IN_CARE','RESERVED') then raise exception 'Care access required'; end if;
    if assignee is not null and assignee <> home_owner and not exists(select 1 from public.foster_home_members
      where home_id = p.home_id and profile_id = assignee and status = 'ACTIVE' and role = 'CARER') then raise exception 'Choose an active carer'; end if;
    if space is not null and not exists(select 1 from public.foster_spaces where id = space and home_id = p.home_id) then raise exception 'Space does not belong to this home'; end if;
    update public.foster_placements set carer_id = assignee,space_id = space,care_state = coalesce(data_input->>'careState','NORMAL'),
      updated_at = clock_timestamp() where id = p.id;
    body := 'Care assignment updated: ' || coalesce(data_input->>'careState','NORMAL');
    if coalesce(data_input->>'careState','NORMAL') = 'MEDICAL' and p.care_state <> 'MEDICAL' then
      perform public.foster_alert(p.id,true,'Needs a vet',coalesce(animal_row.name,'The animal') || ' needs a vet. Open PetPal to talk with the foster.');
    end if;
  elsif action_input = 'NOTE' then
    if not (coalesce(member_role,'') in ('OWNER','CARER') or case_side) then raise exception 'Care access required'; end if;
    if p.status not in ('RESERVED','IN_CARE') then raise exception 'Notes can be added while the animal is reserved or in care'; end if;
    perform public.foster_alert(p.id,false,'Diary note',coalesce(animal_row.name,'The animal') || ': ' || left(body,140));
  elsif action_input in ('DISPUTE','CLARIFY') then
    if not (member_role = 'OWNER' or case_side) then raise exception 'Only placement parties can state a discrepancy'; end if;
    if action_input = 'DISPUTE' then
      if p.status = 'COMPLETED' and p.contest_until is not null and p.contest_until < now() then
        raise exception 'The 7 days to contest this ending have passed. Report it to PetPal instead.'; end if;
      update public.foster_placements set discrepancy = true,updated_at = clock_timestamp() where id = p.id;
    elsif not p.discrepancy then raise exception 'No discrepancy is open';
    elsif exists(select 1 from public.foster_journal j where j.placement_id = p.id and j.event = 'CLARIFY' and j.actor_id <> auth.uid()
      and j.created_at > (select max(created_at) from public.foster_journal where placement_id = p.id and event = 'DISPUTE')) then
      update public.foster_placements set discrepancy = false,updated_at = clock_timestamp() where id = p.id;
    end if;
  else raise exception 'Unsupported placement action'; end if;
  if char_length(body) not between 1 and 4000 then raise exception 'Write a note between 1 and 4000 characters'; end if;
  insert into public.foster_journal(placement_id,actor_id,event,body) values(p.id,auth.uid(),action_input,body);
  if p.request_id is not null and action_input in ('RECEIVE','DISPUTE','CLARIFY','CONFIRM_END') then
    perform public.foster_notify(p.request_id,action_input,body); end if;
end $$;

-- The animal's owner can add tasks (medication times, vet visits); the home
-- ticks them off. Both see the same list.
create or replace function public.save_foster_task(task_id_input uuid,placement_id_input uuid,data_input jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare p public.foster_placements; task public.foster_tasks; result uuid := coalesce(task_id_input,gen_random_uuid());
  assignee uuid := nullif(data_input->>'assigneeId','')::uuid; home_owner uuid; member_role text; case_side boolean;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  select * into p from public.foster_placements where id = placement_id_input;
  if p.id is null or not public.foster_placement_visible(p.id) then raise exception 'Care access required'; end if;
  member_role := public.foster_home_role(p.home_id);
  case_side := member_role is null;
  if coalesce(member_role,'') not in ('OWNER','CARER') and not case_side then raise exception 'Care access required'; end if;
  select profile_id into home_owner from public.foster_home_profiles where id = p.home_id;
  if case_side then assignee := null; end if;
  if assignee is not null and assignee <> home_owner and not exists(select 1 from public.foster_home_members
    where home_id = p.home_id and profile_id = assignee and role = 'CARER' and status = 'ACTIVE') then raise exception 'Choose an active carer'; end if;
  select * into task from public.foster_tasks where id = result for update;
  if found then
    if task.placement_id <> placement_id_input then raise exception 'Task not accessible'; end if;
    if case_side then raise exception 'Only the foster home can tick off tasks'; end if;
    if coalesce((data_input->>'completed')::boolean,false) and task.completed_at is null then
      update public.foster_tasks set completed_at = now(),completed_by = auth.uid() where id = result;
      insert into public.foster_journal(placement_id,actor_id,event,body) values(p.id,auth.uid(),'TASK_COMPLETED',task.title);
    end if;
  else
    if p.status not in ('IN_CARE','RESERVED') then raise exception 'New tasks require active care'; end if;
    if char_length(trim(coalesce(data_input->>'title',''))) not between 1 and 200 then raise exception 'Write a task between 1 and 200 characters'; end if;
    insert into public.foster_tasks(id,placement_id,title,assignee_id,due_at,created_by)
      values(result,p.id,trim(data_input->>'title'),assignee,nullif(data_input->>'dueAt','')::timestamptz,auth.uid());
    insert into public.foster_journal(placement_id,actor_id,event,body) values(p.id,auth.uid(),'TASK_CREATED',trim(data_input->>'title'));
    if case_side then perform public.foster_alert(p.id,false,'New task',trim(data_input->>'title')); end if;
  end if;
  return result;
end $$;

-- An open dispute, or an ending still inside its 7-day contest window,
-- blocks account deletion the same way an active placement does.
create or replace function private.account_deletion_blockers(profile_id_input uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'pendingRequests', (select count(*)::integer from public.foster_requests r
      where r.status = 'PENDING' and profile_id_input in (r.sender_id, r.recipient_id, r.created_by)),
    'activePlacements', (select count(*)::integer from public.foster_placements p
      left join public.foster_home_profiles h on h.id = p.home_id
      left join public.animals a on a.id = p.animal_id
      left join public.foster_requests r on r.id = p.request_id
      where (p.status in ('RESERVED','IN_CARE') or p.discrepancy or (p.status = 'COMPLETED' and p.contest_until > now()))
        and profile_id_input in (h.profile_id, p.carer_id, a.responsible_id, r.sender_id, r.recipient_id))
  );
$$;

-- Reading paths use conversation_hidden: blocked and not a kept placement chat.
create or replace view public.my_conversations_view as
WITH contexts AS (
         SELECT c_1.id AS conversation_id,
            c_1.source,
            c_1.application_id,
            NULL::uuid AS match_id,
            NULL::uuid AS foster_invite_id,
            (app.status)::text AS application_status,
            l.id AS listing_id,
            a.name AS animal_name,
            NULL::text AS related_animal_name,
            NULL::text AS match_mode,
            l.city,
            l.coarse_area,
            COALESCE(o.name, p.display_name) AS organization_name,
            'UNVERIFIED'::text AS organization_verification_status,
            c_1.created_at
           FROM (((((conversations c_1
             JOIN applications app ON ((app.id = c_1.application_id)))
             JOIN animal_listings l ON ((l.id = app.listing_id)))
             JOIN animals a ON ((a.id = l.animal_id)))
             LEFT JOIN organizations o ON ((o.id = l.organization_id)))
             LEFT JOIN profiles p ON ((p.id = l.responsible_id)))
          WHERE ((c_1.source = 'FOSTER'::text) AND (c_1.foster_request_id IS NULL))
        UNION ALL
         SELECT c_1.id,
            c_1.source,
            NULL::uuid AS uuid,
            am.id,
            NULL::uuid AS uuid,
            am.status,
            NULL::uuid AS uuid,
            mine.name,
            theirs.name,
            am.mode,
            theirs.city,
            theirs.coarse_area,
            NULL::text AS text,
            'UNVERIFIED'::text AS text,
            c_1.created_at
           FROM (((conversations c_1
             JOIN animal_matches am ON ((am.id = c_1.match_id)))
             JOIN owner_animal_profiles mine ON (((mine.owner_id = auth.uid()) AND ((mine.id = am.animal_a_id) OR (mine.id = am.animal_b_id)))))
             JOIN owner_animal_profiles theirs ON (((theirs.owner_id <> auth.uid()) AND ((theirs.id = am.animal_a_id) OR (theirs.id = am.animal_b_id)))))
          WHERE (c_1.source = 'MATCH'::text)
        UNION ALL
         SELECT c_1.id,
            c_1.source,
            NULL::uuid AS uuid,
            NULL::uuid AS uuid,
            fi.id,
            fi.status,
            l.id,
            a.name,
            p.display_name,
            NULL::text AS text,
            l.city,
            l.coarse_area,
            p.display_name,
            'UNVERIFIED'::text AS text,
            c_1.created_at
           FROM (((((conversations c_1
             JOIN foster_invites fi ON ((fi.id = c_1.foster_invite_id)))
             JOIN foster_home_profiles fhp ON ((fhp.id = fi.foster_home_profile_id)))
             JOIN profiles p ON ((p.id = fhp.profile_id)))
             JOIN animal_listings l ON ((l.id = fi.foster_case_id)))
             JOIN animals a ON ((a.id = l.animal_id)))
          WHERE ((c_1.source = 'FOSTER_INVITE'::text) AND (c_1.foster_request_id IS NULL))
        UNION ALL
         SELECT c_1.id,
            'FOSTER'::text,
            r.legacy_application_id,
            NULL::uuid AS uuid,
            r.legacy_invite_id,
            r.status,
            l.id,
            a.name,
            NULL::text AS text,
            NULL::text AS text,
            l.city,
            l.coarse_area,
            p.display_name,
            'UNVERIFIED'::text AS text,
            c_1.created_at
           FROM ((((conversations c_1
             JOIN foster_requests r ON ((r.id = c_1.foster_request_id)))
             JOIN animal_listings l ON ((l.id = r.case_id)))
             JOIN animals a ON ((a.id = l.animal_id)))
             JOIN profiles p ON ((p.id = l.responsible_id)))
        )
 SELECT conversation_id,
    source,
    application_id,
    match_id,
    foster_invite_id,
    application_status,
    listing_id,
    animal_name,
    related_animal_name,
    match_mode,
    city,
    coarse_area,
    organization_name,
    organization_verification_status,
    ( SELECT array_agg(cp.profile_id) AS array_agg
           FROM conversation_participants cp
          WHERE ((cp.conversation_id = c.conversation_id) AND (cp.profile_id <> auth.uid()))) AS other_participant_ids,
    (EXISTS ( SELECT 1
           FROM (blocks b
             JOIN conversation_participants cp ON ((cp.profile_id = b.blocked_id)))
          WHERE ((b.blocker_id = auth.uid()) AND (cp.conversation_id = c.conversation_id)))) AS blocked_by_me,
    (EXISTS ( SELECT 1
           FROM reports r
          WHERE ((r.reporter_id = auth.uid()) AND (r.details ~~ (('%'::text || (c.conversation_id)::text) || '%'::text))))) AS reported_by_me,
    ( SELECT m.body
           FROM messages m
          WHERE ((m.conversation_id = c.conversation_id) AND (NOT conversation_hidden(c.conversation_id, auth.uid())))
          ORDER BY m.message_seq DESC
         LIMIT 1) AS last_message_body,
    ( SELECT m.created_at
           FROM messages m
          WHERE (m.conversation_id = c.conversation_id)
          ORDER BY m.message_seq DESC
         LIMIT 1) AS last_message_at,
    created_at
   FROM contexts c
  WHERE is_conversation_participant(conversation_id);

create or replace view public.conversation_inbox_view as
SELECT v.conversation_id,
    v.source,
    v.application_id,
    v.match_id,
    v.foster_invite_id,
    v.application_status,
    v.listing_id,
    v.animal_name,
    v.related_animal_name,
    v.match_mode,
    v.city,
    v.coarse_area,
    v.organization_name,
    v.organization_verification_status,
    v.other_participant_ids,
    v.blocked_by_me,
    v.reported_by_me,
    v.last_message_body,
    v.last_message_at,
    v.created_at,
    cp.last_read_seq,
    ( SELECT (count(*))::integer AS count
           FROM messages m
          WHERE ((m.conversation_id = v.conversation_id) AND (m.sender_id <> auth.uid()) AND (m.message_seq > cp.last_read_seq) AND (NOT conversation_hidden(v.conversation_id, auth.uid())))) AS unread_count,
    is_conversation_blocked(v.conversation_id, auth.uid()) AS messaging_blocked,
    COALESCE(v.last_message_at, v.created_at) AS activity_at,
    COALESCE(( SELECT oap.photo_urls[1] AS photo_urls
           FROM (animal_matches am
             JOIN owner_animal_profiles oap ON (((oap.id = am.animal_a_id) OR (oap.id = am.animal_b_id))))
          WHERE ((am.id = v.match_id) AND (oap.owner_id <> auth.uid()))
         LIMIT 1), ( SELECT a.photo_url
           FROM (animal_listings l
             JOIN animals a ON ((a.id = l.animal_id)))
          WHERE (l.id = v.listing_id))) AS animal_photo,
    ( SELECT p.display_name
           FROM (conversation_participants other_cp
             JOIN profiles p ON ((p.id = other_cp.profile_id)))
          WHERE ((other_cp.conversation_id = v.conversation_id) AND (other_cp.profile_id <> auth.uid()))
         LIMIT 1) AS other_owner_name,
    c.social_request_status,
    (c.social_request_sender_id = auth.uid()) AS social_request_is_mine,
    c.foster_request_id,
    ((c.foster_request_id IS NOT NULL) AND (NOT foster_chat_writable(c.foster_request_id))) AS foster_read_only,
    conversation_history_kept(v.conversation_id) AS history_kept
   FROM ((my_conversations_view v
     JOIN conversation_participants cp ON (((cp.conversation_id = v.conversation_id) AND (cp.profile_id = auth.uid()))))
     JOIN conversations c ON ((c.id = v.conversation_id)));

create or replace view public.conversation_messages_view as
SELECT m.id AS message_id,
    m.conversation_id,
    m.sender_id,
    p.display_name AS sender_display_name,
    m.body,
    m.created_at,
    (m.sender_id = auth.uid()) AS is_mine,
    m.client_message_id,
    m.message_seq
   FROM (messages m
     JOIN profiles p ON ((p.id = m.sender_id)))
  WHERE (is_conversation_participant(m.conversation_id) AND (NOT conversation_hidden(m.conversation_id, auth.uid())));

CREATE OR REPLACE FUNCTION public.mark_conversation_read(conversation_id_input uuid, message_id_input uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare read_seq bigint;
begin
  if not public.is_conversation_participant(conversation_id_input)
    or public.conversation_hidden(conversation_id_input,auth.uid()) then
    raise exception 'Conversation not found or not accessible'; end if;
  select message_seq into read_seq from public.messages
    where id = message_id_input and conversation_id = conversation_id_input;
  if read_seq is null then raise exception 'Message not found'; end if;
  update public.conversation_participants set last_read_seq = greatest(last_read_seq,read_seq)
    where conversation_id = conversation_id_input and profile_id = auth.uid()
    returning last_read_seq into read_seq;
  return read_seq;
end $function$;

CREATE OR REPLACE FUNCTION public.conversation_unread_totals()
 RETURNS TABLE(source text, unread_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when c.source = 'MATCH' then 'MATCH' else 'FOSTER' end,sum((
    select count(*) from public.messages m where m.conversation_id = c.id
      and m.sender_id <> auth.uid() and m.message_seq > cp.last_read_seq
  ))::bigint
  from public.conversation_participants cp join public.conversations c on c.id = cp.conversation_id
  where cp.profile_id = auth.uid() and not public.conversation_hidden(c.id,auth.uid())
  group by 1;
$function$;

-- p.* must pick up the new placement columns.
drop view public.foster_registry_view;
create view public.foster_registry_view as
select p.*,a.name,a.species,a.sex,coalesce(a.photo_url,(select ap.public_url from public.animal_photos ap
  where ap.animal_id = a.id order by ap.sort_order limit 1)) as photo,
  'F-' || a.foster_number::text as animal_code,s.name as space_name,s.isolation,
  person.display_name as carer_name,h.name as home_name,h.profile_id as home_owner_id,
  (select c.id from public.conversations c where c.foster_request_id = p.request_id) as conversation_id,
  (select count(*)::integer from public.foster_tasks t where t.placement_id = p.id and t.completed_at is null and t.due_at <= now()) as overdue_tasks
from public.foster_placements p join public.animals a on a.id = p.animal_id
join public.foster_home_profiles h on h.id = p.home_id left join public.foster_spaces s on s.id = p.space_id
left join public.profiles person on person.id = p.carer_id where public.foster_placement_visible(p.id);
grant select on public.foster_registry_view to authenticated;

-- r.* must pick up the consent columns; the original owner sees transfer requests.
drop view public.foster_requests_view;
create view public.foster_requests_view as
select r.*,a.name as animal_name,a.species,a.photo_url as photo,h.name as home_name,h.profile_id as home_owner_id,
  l.responsible_id as case_owner_id,sp.display_name as sender_name,rp.display_name as recipient_name,
  c.id as conversation_id,p.id as placement_id,p.status as placement_status,
  (h.profile_id = auth.uid()) as receiving_home_is_mine,p.outcome as placement_outcome,p.ended_at as placement_ended_at
from public.foster_requests r join public.animal_listings l on l.id = r.case_id join public.animals a on a.id = l.animal_id
join public.foster_home_profiles h on h.id = r.home_id join public.profiles sp on sp.id = r.sender_id
join public.profiles rp on rp.id = r.recipient_id left join public.conversations c on c.foster_request_id = r.id
left join public.foster_placements p on p.request_id = r.id where public.foster_request_visible(r.id);
grant select on public.foster_requests_view to authenticated;

notify pgrst, 'reload schema';
