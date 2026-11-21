-- Follow-ups from the automated review of PRs #26 to #29.


-- #26: parallel sends could pass the 30-a-minute limit together.
create or replace function public.send_conversation_message(conversation_id_input uuid, body_input text, client_message_id_input uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare existing public.messages; message_id_result uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if body_input is null or char_length(trim(body_input)) < 1 or char_length(body_input) > 4000 then
    raise exception 'Message body must be between 1 and 4000 characters'; end if;
  if not public.is_conversation_participant(conversation_id_input) then
    raise exception 'Conversation not found or not accessible'; end if;
  if public.is_conversation_blocked(conversation_id_input,auth.uid()) then
    raise exception 'Messaging is blocked for this conversation'; end if;
  if client_message_id_input is not null then
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || client_message_id_input::text,0));
    select * into existing from public.messages
      where sender_id = auth.uid() and client_message_id = client_message_id_input;
    if found then
      if existing.conversation_id <> conversation_id_input or existing.body <> trim(body_input) then
        raise exception 'Message request ID was already used for different content'; end if;
      return existing.id;
    end if;
  end if;
  -- One sender at a time, so parallel sends cannot all see 29.
  perform pg_advisory_xact_lock(hashtextextended('send:' || auth.uid()::text,0));
  if (select count(*) from public.messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'You are sending messages too quickly. Wait a minute and try again.'; end if;
  -- A conversation lock orders sends and read positions across concurrent transactions.
  perform 1 from public.conversations where id = conversation_id_input for update;
  insert into public.messages(conversation_id,sender_id,body,client_message_id)
    values(conversation_id_input,auth.uid(),trim(body_input),client_message_id_input)
    returning id into message_id_result;
  perform public.enqueue_push_notification(cp.profile_id,'NEW_MESSAGE',
    jsonb_build_object('conversationId',conversation_id_input,'messageId',message_id_result,'senderId',auth.uid()),
    'New PetPal message','Open PetPal to read your message.')
    from public.conversation_participants cp where cp.conversation_id = conversation_id_input and cp.profile_id <> auth.uid()
      and not exists(select 1 from public.notification_events e join public.messages m on m.id = (e.payload->>'messageId')::uuid
        where e.profile_id = cp.profile_id and e.event_type = 'NEW_MESSAGE' and e.created_at > now() - interval '3 minutes'
          and e.payload->>'conversationId' = conversation_id_input::text and m.message_seq > cp.last_read_seq);
  return message_id_result;
end $$;

-- #26: two accepts for the same animal could deadlock.
create or replace function public.respond_foster_request(request_id_input uuid,action_input text,expected_updated_at_input timestamptz,
  acknowledge_capacity_input boolean default false,reason_input text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.foster_requests; placement public.foster_placements; l public.animal_listings; next_status text;
  result uuid; conversation_id uuid; other record; animal_name text;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  -- Decisions on one animal go one at a time, taken before any row lock, so
  -- two accepts for the same animal cannot deadlock.
  perform pg_advisory_xact_lock(hashtextextended('case:' || coalesce((select case_id::text from public.foster_requests where id = request_id_input),''),0));
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

-- #27: only the animal's own owner saying "my animal is back" counts as confirmed.
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
      end_confirmed_at = case when auth.uid() = animal_row.responsible_id and outcome_value = 'RETURNED' then now() end
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

-- #29: undoing an older day of a daily task could start a second chain;
-- a daily task ticked before arrival stopped repeating.
create or replace function public.save_foster_task(task_id_input uuid,placement_id_input uuid,data_input jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare p public.foster_placements; task public.foster_tasks; result uuid := coalesce(task_id_input,gen_random_uuid());
  assignee uuid := nullif(data_input->>'assigneeId','')::uuid; home_owner uuid; member_role text; case_side boolean;
  daily boolean := coalesce((data_input->>'daily')::boolean,false); due timestamptz := nullif(data_input->>'dueAt','')::timestamptz;
  next_due timestamptz;
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
      if task.repeat_daily and p.status in ('IN_CARE','RESERVED') then
        next_due := coalesce(task.due_at,now()) + interval '1 day';
        while next_due < now() loop next_due := next_due + interval '1 day'; end loop;
        insert into public.foster_tasks(placement_id,title,assignee_id,due_at,created_by,repeat_daily,repeat_of)
          values(p.id,task.title,task.assignee_id,next_due,task.created_by,true,task.id);
      end if;
    elsif data_input ? 'completed' and not (data_input->>'completed')::boolean and task.completed_at is not null then
      if exists(select 1 from public.foster_tasks where repeat_of = result and completed_at is not null) then
        raise exception 'Only the latest day of a daily task can be undone'; end if;
      update public.foster_tasks set completed_at = null,completed_by = null where id = result;
      delete from public.foster_tasks where repeat_of = result and completed_at is null;
      insert into public.foster_journal(placement_id,actor_id,event,body) values(p.id,auth.uid(),'TASK_REOPENED',task.title);
    end if;
  else
    if p.status not in ('IN_CARE','RESERVED') then raise exception 'New tasks require active care'; end if;
    if char_length(trim(coalesce(data_input->>'title',''))) not between 1 and 200 then raise exception 'Write a task between 1 and 200 characters'; end if;
    if daily and due is null then due := date_trunc('day',now() at time zone 'Europe/Bucharest') at time zone 'Europe/Bucharest' + interval '9 hours';
      if due < now() then due := due + interval '1 day'; end if; end if;
    insert into public.foster_tasks(id,placement_id,title,assignee_id,due_at,created_by,repeat_daily)
      values(result,p.id,trim(data_input->>'title'),assignee,due,auth.uid(),daily);
    insert into public.foster_journal(placement_id,actor_id,event,body) values(p.id,auth.uid(),'TASK_CREATED',trim(data_input->>'title'));
    if case_side then perform public.foster_alert(p.id,false,'New task',trim(data_input->>'title')); end if;
  end if;
  return result;
end $$;

-- #28: a closed flag for the same dispute was raised again every hour.
create or replace function public.flag_stale_placements()
returns integer language plpgsql security definer set search_path = public as $$
declare created integer := 0; n integer;
begin
  insert into public.reports(reporter_id,reported_profile_id,category,details)
  select null,h.profile_id,'DISPUTE_OPEN','Automatic flag: a discrepancy on ' || a.name || ' has been open for more than 48 hours. Placement ' || p.id || '.'
  from public.foster_placements p join public.animals a on a.id = p.animal_id join public.foster_home_profiles h on h.id = p.home_id
  where p.discrepancy and (select max(j.created_at) from public.foster_journal j where j.placement_id = p.id and j.event = 'DISPUTE') < now() - interval '48 hours'
    and not exists(select 1 from public.reports r where r.category = 'DISPUTE_OPEN' and r.details like '%' || p.id::text || '%'
      and r.created_at > (select max(j.created_at) from public.foster_journal j where j.placement_id = p.id and j.event = 'DISPUTE'));
  get diagnostics n = row_count; created := created + n;
  insert into public.reports(reporter_id,reported_profile_id,category,details)
  select null,h.profile_id,'RESERVATION_NOT_RECEIVED','Automatic flag: ' || a.name || ' was reserved more than 7 days ago and arrival was never confirmed. Placement ' || p.id || '.'
  from public.foster_placements p join public.animals a on a.id = p.animal_id join public.foster_home_profiles h on h.id = p.home_id
  where p.status = 'RESERVED' and p.created_at < now() - interval '7 days'
    and not exists(select 1 from public.reports r where r.category = 'RESERVATION_NOT_RECEIVED' and r.details like '%' || p.id::text || '%');
  get diagnostics n = row_count; created := created + n;
  return created;
end $$;

-- #27: phones and vet are for the home owner and the animal's side only, not
-- for helpers of the home. The view masks them; the table itself is not
-- readable by clients at all (every client read goes through the view).
create or replace view public.foster_registry_view as
select p.id,p.animal_id,p.home_id,p.request_id,p.previous_placement_id,p.status,p.provenance,p.space_id,p.carer_id,p.care_state,
  p.received_by,p.received_at,p.ended_at,p.discrepancy,p.created_by,p.created_at,p.updated_at,p.outcome,p.ended_by,p.end_confirmed_at,
  p.contest_until,p.chat_open_until,
  case when coalesce(public.foster_home_role(p.home_id),'OWNER') = 'OWNER' then p.emergency_phone end as emergency_phone,
  case when coalesce(public.foster_home_role(p.home_id),'OWNER') = 'OWNER' then p.vet_contact end as vet_contact,
  case when coalesce(public.foster_home_role(p.home_id),'OWNER') = 'OWNER' then p.foster_phone end as foster_phone,
  a.name,a.species,a.sex,coalesce(a.photo_url,(select ap.public_url from public.animal_photos ap
  where ap.animal_id = a.id order by ap.sort_order limit 1)) as photo,
  'F-' || a.foster_number::text as animal_code,s.name as space_name,s.isolation,
  person.display_name as carer_name,h.name as home_name,h.profile_id as home_owner_id,
  (select c.id from public.conversations c where c.foster_request_id = p.request_id) as conversation_id,
  (select count(*)::integer from public.foster_tasks t where t.placement_id = p.id and t.completed_at is null and t.due_at <= now()) as overdue_tasks,
  a.care_traits,a.approximate_age_months as age_months,a.size_label,a.breed_or_mix as breed
from public.foster_placements p join public.animals a on a.id = p.animal_id
join public.foster_home_profiles h on h.id = p.home_id left join public.foster_spaces s on s.id = p.space_id
left join public.profiles person on person.id = p.carer_id where public.foster_placement_visible(p.id);
revoke select on public.foster_placements from anon,authenticated;
grant select (id,animal_id,home_id,request_id,previous_placement_id,status,provenance,space_id,carer_id,care_state,received_by,received_at,
  ended_at,discrepancy,created_by,created_at,updated_at,outcome,ended_by,end_confirmed_at,contest_until,chat_open_until)
  on public.foster_placements to authenticated;

notify pgrst, 'reload schema';
