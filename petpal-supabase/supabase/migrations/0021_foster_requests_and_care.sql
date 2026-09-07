-- Bring old requests forward without manufacturing a receipt or losing the original records.
insert into public.foster_home_profiles(profile_id,name,city,area)
select distinct p.id,p.display_name,coalesce(p.city,''),coalesce(p.coarse_area,'')
from public.applications a join public.profiles p on p.id = a.applicant_id
join public.animal_listings l on l.id = a.listing_id and l.mode = 'FOSTER'
where not exists(select 1 from public.foster_home_profiles h where h.profile_id = p.id);
insert into public.foster_requests(id,case_id,home_id,created_by,sender_id,recipient_id,kind,status,message,legacy_application_id,created_at,updated_at)
select a.id,a.listing_id,h.id,a.applicant_id,a.applicant_id,l.responsible_id,'APPLICATION',
  case a.status when 'ACCEPTED' then 'ACCEPTED' when 'REJECTED' then 'DECLINED' when 'WITHDRAWN' then 'WITHDRAWN' else 'PENDING' end,
  a.motivation,a.id,a.created_at,a.updated_at
from public.applications a join public.animal_listings l on l.id = a.listing_id and l.mode = 'FOSTER'
join lateral(select id from public.foster_home_profiles where profile_id = a.applicant_id order by created_at,id limit 1) h on true
where a.applicant_id <> l.responsible_id;
insert into public.foster_requests(id,case_id,home_id,created_by,sender_id,recipient_id,kind,status,message,legacy_invite_id,created_at,updated_at)
select i.id,i.foster_case_id,i.foster_home_profile_id,i.sent_by_user_id,i.sent_by_user_id,h.profile_id,'INVITE',
  case i.status when 'ACCEPTED' then 'ACCEPTED' when 'DECLINED' then 'DECLINED' when 'EXPIRED' then 'WITHDRAWN' else 'PENDING' end,
  coalesce(i.message,''),i.id,i.created_at,i.updated_at
from public.foster_invites i join public.foster_home_profiles h on h.id = i.foster_home_profile_id
where i.sent_by_user_id <> h.profile_id and not exists(select 1 from public.foster_requests r
  where r.case_id = i.foster_case_id and r.home_id = i.foster_home_profile_id and r.status in ('PENDING','ACCEPTED'));
update public.conversations c set foster_request_id = r.id from public.foster_requests r
where c.application_id = r.legacy_application_id or c.foster_invite_id = r.legacy_invite_id;
insert into public.conversations(source,foster_request_id)
select 'FOSTER',r.id from public.foster_requests r where not exists(select 1 from public.conversations c where c.foster_request_id = r.id);
insert into public.conversation_participants(conversation_id,profile_id)
select c.id,party.id from public.conversations c join public.foster_requests r on r.id = c.foster_request_id
cross join lateral(values(r.sender_id),(r.recipient_id)) party(id) on conflict do nothing;
insert into public.foster_request_events(request_id,actor_id,event,body)
select id,created_by,'IMPORTED','Historical request retained. No receipt or occupancy was inferred.' from public.foster_requests;

create function public.foster_notify(request_input uuid,event_input text,body_input text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.foster_requests; notification_conversation uuid;
begin
  select * into r from public.foster_requests where id = request_input;
  select id into notification_conversation from public.conversations where foster_request_id = r.id;
  perform public.enqueue_push_notification(p.id,'FOSTER_UPDATE',jsonb_build_object('requestId',r.id,'conversationId',notification_conversation),
    'Foster update',body_input) from (values(r.sender_id),(r.recipient_id)) p(id) where p.id <> auth.uid();
  insert into public.foster_request_events(request_id,actor_id,event,body) values(r.id,auth.uid(),event_input,body_input);
  update public.conversation_participants cp set last_read_seq = cp.last_read_seq where cp.conversation_id = notification_conversation;
end $$;
revoke all on function public.foster_notify(uuid,text,text) from public,anon,authenticated;

create function public.foster_capacity_warning(home_input uuid,animal_input uuid,excluding_input uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select h.availability_status = 'UNAVAILABLE' or not a.species = any(h.accepts_species)
    or (select count(*) from public.foster_placements p where p.home_id = h.id and p.status in ('RESERVED','IN_CARE')
      and p.id is distinct from excluding_input) >= h.max_animals_at_once
    or (select count(*) from public.foster_placements p join public.animals pa on pa.id = p.animal_id
      where p.home_id = h.id and p.status in ('RESERVED','IN_CARE') and pa.species = a.species and p.id is distinct from excluding_input)
      >= case a.species when 'DOG' then h.dog_capacity else h.cat_capacity end
  from public.foster_home_profiles h cross join public.animals a where h.id = home_input and a.id = animal_input;
$$;
revoke all on function public.foster_capacity_warning(uuid,uuid,uuid) from public,anon,authenticated;

create function public.create_foster_request(request_id_input uuid,case_id_input uuid,home_id_input uuid,kind_input text,message_input text)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.foster_requests; l public.animal_listings; h public.foster_home_profiles;
  result uuid := coalesce(request_id_input,gen_random_uuid()); sender uuid; recipient uuid; conversation_id uuid; previous_id uuid;
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
  select p.id into previous_id from public.foster_placements p join public.foster_home_profiles ph on ph.id = p.home_id
    where p.animal_id = l.animal_id and p.status = 'IN_CARE' and ph.profile_id = l.responsible_id;
  insert into public.foster_requests(id,case_id,home_id,created_by,sender_id,recipient_id,kind,message,previous_placement_id)
    values(result,l.id,h.id,auth.uid(),sender,recipient,kind_input,trim(message_input),previous_id);
  insert into public.conversations(source,foster_request_id) values('FOSTER',result) returning id into conversation_id;
  insert into public.conversation_participants(conversation_id,profile_id) values(conversation_id,sender),(conversation_id,recipient);
  perform public.send_conversation_message(conversation_id,trim(message_input),result);
  perform public.foster_notify(result,'CREATED','A participant sent a foster request. Discuss the arrangement before accepting.');
  return result;
end $$;

create function public.respond_foster_request(request_id_input uuid,action_input text,expected_updated_at_input timestamptz,
  acknowledge_capacity_input boolean default false,reason_input text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.foster_requests; placement public.foster_placements; l public.animal_listings; next_status text;
  result uuid; conversation_id uuid;
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
  return result;
end $$;

create function public.update_foster_placement(placement_id_input uuid,action_input text,data_input jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare p public.foster_placements; r public.foster_requests; home_owner uuid; member_role text;
  body text := trim(coalesce(data_input->>'body','')); assignee uuid := nullif(data_input->>'carerId','')::uuid;
  space uuid := nullif(data_input->>'spaceId','')::uuid;
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
  if action_input = 'RECEIVE' and p.status = 'IN_CARE' and p.received_by = auth.uid() then return; end if;
  if action_input not in ('NOTE','DISPUTE','CLARIFY') and (data_input->>'expectedUpdatedAt')::timestamptz is distinct from p.updated_at then
    raise exception 'Placement changed. Reload before saving.'; end if;
  if action_input = 'RECEIVE' then
    if auth.uid() <> home_owner or p.status <> 'RESERVED' then raise exception 'Only the receiving home owner can declare receipt'; end if;
    perform 1 from public.animals where id = p.animal_id for update;
    if p.previous_placement_id is not null then
      update public.foster_placements set status = 'COMPLETED',ended_at = now(),updated_at = clock_timestamp()
        where id = p.previous_placement_id and status = 'IN_CARE';
      if not found then raise exception 'Source placement changed'; end if;
      insert into public.foster_journal(placement_id,actor_id,event,body)
        values(p.previous_placement_id,auth.uid(),'TRANSFERRED','Receipt declared by the receiving foster at the destination home.');
      update public.foster_requests set status = 'COMPLETED',updated_at = clock_timestamp()
        where id = (select request_id from public.foster_placements where id = p.previous_placement_id);
    end if;
    update public.foster_placements set status = 'IN_CARE',received_by = auth.uid(),received_at = now(),updated_at = clock_timestamp() where id = p.id;
    body := 'Receipt declared by the receiving foster. This is not a PetPal verification.';
  elsif action_input = 'END' then
    if member_role is distinct from 'OWNER' or p.status <> 'IN_CARE' then raise exception 'Only the home owner can end current care'; end if;
    if exists(select 1 from public.foster_placements where previous_placement_id = p.id and status = 'RESERVED') then
      raise exception 'A transfer is reserved. Complete or cancel it before ending this placement.'; end if;
    if char_length(body) not between 1 and 2000 then raise exception 'Ending reason is required'; end if;
    update public.foster_placements set status = 'COMPLETED',ended_at = now(),updated_at = clock_timestamp() where id = p.id;
    update public.foster_requests set status = 'COMPLETED',updated_at = clock_timestamp() where id = p.request_id;
  elsif action_input = 'CARE' then
    if member_role is null or member_role not in ('OWNER','CARER') or p.status not in ('IN_CARE','RESERVED') then raise exception 'Care access required'; end if;
    if assignee is not null and assignee <> home_owner and not exists(select 1 from public.foster_home_members
      where home_id = p.home_id and profile_id = assignee and status = 'ACTIVE' and role = 'CARER') then raise exception 'Choose an active carer'; end if;
    if space is not null and not exists(select 1 from public.foster_spaces where id = space and home_id = p.home_id) then raise exception 'Space does not belong to this home'; end if;
    update public.foster_placements set carer_id = assignee,space_id = space,care_state = coalesce(data_input->>'careState','NORMAL'),
      updated_at = clock_timestamp() where id = p.id;
    body := 'Care assignment updated: ' || coalesce(data_input->>'careState','NORMAL');
  elsif action_input = 'NOTE' then
    if member_role is null or member_role not in ('OWNER','CARER') then raise exception 'Care access required'; end if;
  elsif action_input in ('DISPUTE','CLARIFY') then
    if r.id is null or auth.uid() not in (r.sender_id,r.recipient_id) then raise exception 'Only placement parties can state a discrepancy'; end if;
    if action_input = 'DISPUTE' then
      update public.foster_placements set discrepancy = true,updated_at = clock_timestamp() where id = p.id;
    elsif not p.discrepancy then raise exception 'No discrepancy is open';
    elsif exists(select 1 from public.foster_journal j where j.placement_id = p.id and j.event = 'CLARIFY' and j.actor_id <> auth.uid()
      and j.created_at > (select max(created_at) from public.foster_journal where placement_id = p.id and event = 'DISPUTE')) then
      update public.foster_placements set discrepancy = false,updated_at = clock_timestamp() where id = p.id;
    end if;
  else raise exception 'Unsupported placement action'; end if;
  if char_length(body) not between 1 and 4000 then raise exception 'Write a note between 1 and 4000 characters'; end if;
  insert into public.foster_journal(placement_id,actor_id,event,body) values(p.id,auth.uid(),action_input,body);
  if p.request_id is not null and action_input in ('RECEIVE','END','DISPUTE','CLARIFY') then
    perform public.foster_notify(p.request_id,action_input,body); end if;
end $$;

create function public.save_foster_task(task_id_input uuid,placement_id_input uuid,data_input jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare p public.foster_placements; task public.foster_tasks; result uuid := coalesce(task_id_input,gen_random_uuid());
  assignee uuid := nullif(data_input->>'assigneeId','')::uuid; home_owner uuid;
begin
  select * into p from public.foster_placements where id = placement_id_input;
  if not public.foster_actor_active(auth.uid()) or coalesce(public.foster_home_role(p.home_id),'') not in ('OWNER','CARER') then
    raise exception 'Care access required'; end if;
  select profile_id into home_owner from public.foster_home_profiles where id = p.home_id;
  if assignee is not null and assignee <> home_owner and not exists(select 1 from public.foster_home_members
    where home_id = p.home_id and profile_id = assignee and role = 'CARER' and status = 'ACTIVE') then raise exception 'Choose an active carer'; end if;
  select * into task from public.foster_tasks where id = result for update;
  if found then
    if task.placement_id <> placement_id_input then raise exception 'Task not accessible'; end if;
    if coalesce((data_input->>'completed')::boolean,false) and task.completed_at is null then
      update public.foster_tasks set completed_at = now(),completed_by = auth.uid() where id = result;
      insert into public.foster_journal(placement_id,actor_id,event,body) values(p.id,auth.uid(),'TASK_COMPLETED',task.title);
    end if;
  else
    if p.status not in ('IN_CARE','RESERVED') then raise exception 'New tasks require active care'; end if;
    insert into public.foster_tasks(id,placement_id,title,assignee_id,due_at,created_by)
      values(result,p.id,trim(data_input->>'title'),assignee,nullif(data_input->>'dueAt','')::timestamptz,auth.uid());
    insert into public.foster_journal(placement_id,actor_id,event,body) values(p.id,auth.uid(),'TASK_CREATED',trim(data_input->>'title'));
  end if;
  return result;
end $$;

create function public.review_foster_placement(placement_id_input uuid,rating_input integer,comment_input text)
returns uuid language plpgsql security definer set search_path = public as $$
declare p public.foster_placements; r public.foster_requests; result uuid;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  select * into p from public.foster_placements where id = placement_id_input;
  select * into r from public.foster_requests where id = p.request_id;
  if p.status <> 'COMPLETED' or r.id is null or auth.uid() not in (r.sender_id,r.recipient_id) then
    raise exception 'Reviews require a completed placement between these participants'; end if;
  if char_length(coalesce(comment_input,'')) > 2000 then raise exception 'Review is too long'; end if;
  insert into public.foster_home_reviews(foster_home_profile_id,foster_case_id,placement_id,reviewer_id,rating,comment)
    values(p.home_id,r.case_id,p.id,auth.uid(),rating_input,trim(comment_input))
    on conflict(placement_id,reviewer_id) where placement_id is not null do update set rating = excluded.rating,comment = excluded.comment
    returning id into result;
  return result;
end $$;

create view public.foster_requests_view as
select r.*,a.name as animal_name,a.species,a.photo_url as photo,h.name as home_name,h.profile_id as home_owner_id,
  l.responsible_id as case_owner_id,sp.display_name as sender_name,rp.display_name as recipient_name,
  c.id as conversation_id,p.id as placement_id,p.status as placement_status,
  (h.profile_id = auth.uid()) as receiving_home_is_mine
from public.foster_requests r join public.animal_listings l on l.id = r.case_id join public.animals a on a.id = l.animal_id
join public.foster_home_profiles h on h.id = r.home_id join public.profiles sp on sp.id = r.sender_id
join public.profiles rp on rp.id = r.recipient_id left join public.conversations c on c.foster_request_id = r.id
left join public.foster_placements p on p.request_id = r.id where public.foster_request_visible(r.id);
create view public.foster_request_events_view as
select e.*,p.display_name as actor_name from public.foster_request_events e join public.profiles p on p.id = e.actor_id
where public.foster_request_visible(e.request_id);
create view public.foster_reviews_view as
select r.id,r.foster_home_profile_id as home_id,r.placement_id,r.reviewer_id,r.rating,r.comment,r.created_at,p.display_name as author_name
from public.foster_home_reviews r join public.profiles p on p.id = r.reviewer_id
where r.placement_id is not null and auth.uid() is not null and exists(select 1 from public.foster_homes_directory h where h.id = r.foster_home_profile_id);
grant select on public.foster_requests_view,public.foster_request_events_view,public.foster_reviews_view to authenticated;

-- Closed requests retain readable history but cannot accept new messages, including from older clients.
create function public.guard_foster_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare c public.conversations; request_status text;
begin
  select * into c from public.conversations where id = new.conversation_id for update;
  if c.foster_request_id is not null then
    select status into request_status from public.foster_requests where id = c.foster_request_id;
    if request_status not in ('PENDING','ACCEPTED') then raise exception 'This foster conversation is read-only'; end if;
  end if;
  if not public.foster_actor_active(new.sender_id) then raise exception 'Account unavailable'; end if;
  return new;
end $$;
create trigger guard_foster_message before insert on public.messages for each row execute function public.guard_foster_message();
revoke all on function public.guard_foster_message() from public,anon,authenticated;

-- Legacy APIs cannot bypass the participant-led lifecycle. Original records remain available for migration/audit.
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace = 'public'::regnamespace and proname in
    ('send_foster_invite','respond_to_foster_invite','rate_foster_home','upsert_foster_home_profile',
     'submit_adoption_foster_application','set_application_review_status') loop
    execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
  end loop;
  for f in select oid::regprocedure as signature from pg_proc where pronamespace = 'public'::regnamespace and proname in
    ('create_foster_request','respond_foster_request','update_foster_placement','save_foster_task','review_foster_placement') loop
    execute format('revoke all on function %s from public,anon',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
revoke insert,update,delete on public.applications,public.foster_invites,public.foster_home_reviews from anon,authenticated;
