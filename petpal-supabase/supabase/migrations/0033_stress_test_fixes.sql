-- Fixes for the bugs found by the 10 foster / 10 user stress test (2026-11-20).

-- 1. A home owner or team member cannot review their own home. Earlier
--    self-reviews stay stored but leave the public list.
create or replace function public.review_foster_placement(placement_id_input uuid,rating_input integer,comment_input text)
returns uuid language plpgsql security definer set search_path = public as $$
declare p public.foster_placements; r public.foster_requests; result uuid;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  select * into p from public.foster_placements where id = placement_id_input;
  select * into r from public.foster_requests where id = p.request_id;
  if p.status <> 'COMPLETED' or r.id is null or auth.uid() not in (r.sender_id,r.recipient_id) then
    raise exception 'Reviews require a completed placement between these participants'; end if;
  if exists(select 1 from public.foster_home_profiles h where h.id = p.home_id and h.profile_id = auth.uid())
    or exists(select 1 from public.foster_home_members m where m.home_id = p.home_id and m.profile_id = auth.uid() and m.status = 'ACTIVE') then
    raise exception 'You cannot review your own foster home'; end if;
  if rating_input is null or rating_input not between 1 and 5 then raise exception 'Choose a rating from 1 to 5'; end if;
  if char_length(coalesce(comment_input,'')) > 2000 then raise exception 'Review is too long'; end if;
  insert into public.foster_home_reviews(foster_home_profile_id,foster_case_id,placement_id,reviewer_id,rating,comment)
    values(p.home_id,r.case_id,p.id,auth.uid(),rating_input,trim(comment_input))
    on conflict(placement_id,reviewer_id) where placement_id is not null do update set rating = excluded.rating,comment = excluded.comment
    returning id into result;
  return result;
end $$;

create or replace view public.foster_reviews_view as
select r.id,r.foster_home_profile_id as home_id,r.placement_id,r.reviewer_id,r.rating,r.comment,r.created_at,p.display_name as author_name
from public.foster_home_reviews r join public.profiles p on p.id = r.reviewer_id
join public.foster_home_profiles h on h.id = r.foster_home_profile_id
where r.placement_id is not null and r.reviewer_id <> h.profile_id and auth.uid() is not null
  and exists(select 1 from public.foster_homes_directory d where d.id = r.foster_home_profile_id);

-- 2. When a case owner accepts one home, every other pending request for that
--    case closes as PLACED_ELSEWHERE and the other side is told.
alter table public.foster_requests drop constraint foster_requests_status_check,
  add constraint foster_requests_status_check check (status in
    ('PENDING','ACCEPTED','DECLINED','WITHDRAWN','CANCELLED','COMPLETED','PLACED_ELSEWHERE'));

-- 3. A request cannot be sent for an animal whose case already has a
--    reservation or placement, even from a stale screen or a deep link.
create or replace function public.foster_case_placed(case_input uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.foster_requests r join public.foster_placements fp on fp.request_id = r.id
    where r.case_id = case_input and fp.status in ('RESERVED','IN_CARE'));
$$;
revoke all on function public.foster_case_placed(uuid) from public,anon,authenticated;

create or replace function public.create_foster_request(request_id_input uuid,case_id_input uuid,home_id_input uuid,kind_input text,message_input text)
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
  if public.foster_case_placed(l.id) then raise exception 'This animal has already found a home'; end if;
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

-- Close requests left pending on cases that were already accepted before this fix.
with stale as (
  update public.foster_requests fr set status = 'PLACED_ELSEWHERE',updated_at = clock_timestamp()
  where fr.status = 'PENDING' and exists(select 1 from public.foster_requests won
    join public.foster_placements fp on fp.request_id = won.id
    where won.case_id = fr.case_id and won.id <> fr.id and fp.status in ('RESERVED','IN_CARE','COMPLETED'))
  returning fr.id,fr.sender_id
)
insert into public.foster_request_events(request_id,actor_id,event,body)
select id,sender_id,'PLACED_ELSEWHERE','The animal found a home with someone else.' from stale;

-- 4. Notification choices are stored on the account and the server honours
--    them. Rows are always kept (they feed the activity list); a switched-off
--    category only skips the push. Alerts about an animal in your care always send.
alter table public.profiles add column notification_preferences jsonb not null
  default '{"push":true,"matches":true,"foster":true,"safety":true}'::jsonb;

create or replace function public.set_notification_preferences(preferences_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb; clean jsonb := '{}'::jsonb; key text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if jsonb_typeof(preferences_input) is distinct from 'object' then raise exception 'Notification choices are required'; end if;
  foreach key in array array['push','matches','foster','safety'] loop
    if preferences_input ? key then
      if jsonb_typeof(preferences_input->key) <> 'boolean' then raise exception 'Notification choices must be on or off'; end if;
      clean := clean || jsonb_build_object(key,preferences_input->key);
    end if;
  end loop;
  update public.profiles set notification_preferences = notification_preferences || clean,updated_at = clock_timestamp()
    where id = auth.uid() returning notification_preferences into result;
  if result is null then raise exception 'Profile not found'; end if;
  return result;
end $$;
revoke all on function public.set_notification_preferences(jsonb) from public,anon;
grant execute on function public.set_notification_preferences(jsonb) to authenticated;

create or replace function public.notification_category(event_type_input text)
returns text language sql immutable set search_path = public as $$
  select case
    when event_type_input in ('FOSTER_URGENT','ADMIN_ALERT') then 'CRITICAL'
    when event_type_input like 'FOSTER%' then 'foster'
    when event_type_input like 'MATCH%' or event_type_input like 'SOCIAL%' then 'matches'
    when event_type_input like 'MODERATION%' or event_type_input like 'REPORT%' then 'safety'
    else 'push' end;
$$;

create or replace function public.enqueue_push_notification(profile_id_input uuid, event_type_input text, payload_input jsonb default '{}'::jsonb,
  title_input text default null, body_input text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare event_id_result uuid; prefs jsonb; category text := public.notification_category(event_type_input); wanted boolean := true;
begin
  if profile_id_input is null then raise exception 'Notification profile id is required'; end if;
  select notification_preferences into prefs from public.profiles where id = profile_id_input;
  if category <> 'CRITICAL' and prefs is not null then
    wanted := coalesce((prefs->>'push')::boolean,true) and (category = 'push' or coalesce((prefs->>category)::boolean,true));
  end if;
  insert into public.notification_events(profile_id,event_type,payload,title,body,delivery_status,next_attempt_at)
  values(profile_id_input,event_type_input,coalesce(payload_input,'{}'::jsonb),
    coalesce(nullif(trim(title_input),''),public.default_push_title(event_type_input)),
    coalesce(nullif(trim(body_input),''),public.default_push_body(event_type_input)),
    case when wanted then 'QUEUED' else 'SKIPPED' end,now())
  returning id into event_id_result;
  return event_id_result;
end $$;

-- 5. Chat pushes collapse per conversation while unread (at most one every
--    3 minutes), each message writes one notification row instead of two,
--    and one person can send at most 30 messages a minute.
create index if not exists messages_sender_created_idx on public.messages(sender_id,created_at desc);
create index if not exists notification_events_profile_type_idx on public.notification_events(profile_id,event_type,created_at desc);

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

-- Smaller findings: bounded display names, no reports against yourself, and
-- a case edit that tries to change the species is refused instead of ignored.
alter table public.profiles add constraint profiles_display_name_length
  check (char_length(trim(display_name)) between 1 and 80) not valid;
-- Raised before the constraint so the app can show a readable message.
create or replace function public.guard_profile_display_name()
returns trigger language plpgsql set search_path = public as $$
begin
  if char_length(trim(coalesce(new.display_name,''))) not between 1 and 80 then
    raise exception 'Your name must be between 1 and 80 characters'; end if;
  return new;
end $$;
create trigger guard_profile_display_name before insert or update of display_name on public.profiles
  for each row execute function public.guard_profile_display_name();
revoke all on function public.guard_profile_display_name() from public,anon,authenticated;

create or replace function public.guard_report_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  new.status := 'OPEN';
  new.resolved_at := null;
  if new.reporter_id is not null and (new.reported_profile_id = new.reporter_id
    or exists(select 1 from public.messages m where m.id = new.message_id and m.sender_id = new.reporter_id)) then
    raise exception 'You cannot report yourself'; end if;
  if new.reporter_id is not null and new.reporter_id = auth.uid() and (
    select count(*) from public.reports r where r.reporter_id = auth.uid() and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'Report limit reached. Please try again later.'; end if;
  return new;
end $$;

-- save_foster_case used to keep the old species silently; now the caller learns why.
create or replace function public.save_foster_case(case_id_input uuid, animal_id_input uuid, data_input jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare case_result uuid := coalesce(case_id_input,gen_random_uuid()); animal_result uuid := coalesce(animal_id_input,gen_random_uuid());
  old_case public.animal_listings; animal_row public.animals; org_id uuid := nullif(data_input->>'organizationId','')::uuid;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  if char_length(trim(coalesce(data_input->>'name',''))) not between 1 and 80
    or char_length(trim(coalesce(data_input->>'description',''))) not between 1 and 4000
    or char_length(trim(coalesce(data_input->>'city',''))) not between 1 and 100 then
    raise exception 'Animal name, description and city are required'; end if;
  if org_id is not null and not exists(select 1 from public.organization_members where organization_id = org_id
    and profile_id = auth.uid() and role in ('OWNER','MANAGER')) then raise exception 'Organization access required'; end if;
  select * into old_case from public.animal_listings where id = case_result for update;
  if found then
    if old_case.responsible_id <> auth.uid() or old_case.mode <> 'FOSTER' then raise exception 'Case not editable'; end if;
    if (data_input->>'expectedUpdatedAt')::timestamptz is distinct from old_case.updated_at then
      raise exception 'This case changed in another session. Reload before saving.'; end if;
    animal_result := old_case.animal_id;
  end if;
  select * into animal_row from public.animals where id = animal_result for update;
  if found and animal_row.responsible_id <> auth.uid() and not exists(
    select 1 from public.foster_placements p where p.animal_id = animal_result and p.status = 'IN_CARE'
      and public.foster_home_role(p.home_id) = 'OWNER') then raise exception 'Animal not managed by this account'; end if;
  if found and nullif(data_input->>'species','') is not null and data_input->>'species' <> animal_row.species::text then
    raise exception 'The species of an animal cannot be changed. Post a new animal instead.'; end if;
  if animal_row.id is null then
    insert into public.animals(id,responsible_id,organization_id,name,species,sex,breed_or_mix,approximate_age_months,size_label,photo_url)
      values(animal_result,auth.uid(),org_id,trim(data_input->>'name'),(data_input->>'species')::public.species,
        coalesce(data_input->>'sex','UNKNOWN'),data_input->>'breed',nullif(data_input->>'ageMonths','')::integer,
        data_input->>'size',nullif(data_input->>'photo',''));
  elsif animal_row.responsible_id = auth.uid() then
    update public.animals set name = trim(data_input->>'name'),breed_or_mix = data_input->>'breed',
      approximate_age_months = nullif(data_input->>'ageMonths','')::integer,size_label = data_input->>'size',
      photo_url = nullif(data_input->>'photo',''),updated_at = now() where id = animal_result;
  end if;
  if coalesce(data_input->>'status','ACTIVE') not in ('ACTIVE','PAUSED','ARCHIVED') then raise exception 'Invalid case status'; end if;
  insert into public.animal_listings(id,animal_id,organization_id,responsible_id,mode,status,title,description,city,coarse_area,
    foster_urgency,foster_duration,food_covered,vet_covered,transport_available,medical_needs,home_fit)
  values(case_result,animal_result,org_id,auth.uid(),'FOSTER',coalesce(data_input->>'status','ACTIVE')::public.listing_status,
    trim(data_input->>'name'),trim(data_input->>'description'),trim(data_input->>'city'),coalesce(data_input->>'area',''),
    coalesce(data_input->>'urgency','MEDIUM'),coalesce(data_input->>'duration','UNKNOWN'),
    coalesce((data_input->>'foodCovered')::boolean,false),coalesce((data_input->>'vetCovered')::boolean,false),
    coalesce((data_input->>'transport')::boolean,false),coalesce(data_input->>'medicalNeeds',''),coalesce(data_input->>'homeFit',''))
  on conflict(id) do update set title = excluded.title,description = excluded.description,city = excluded.city,organization_id = excluded.organization_id,
    coarse_area = excluded.coarse_area,status = excluded.status,foster_urgency = excluded.foster_urgency,
    foster_duration = excluded.foster_duration,food_covered = excluded.food_covered,vet_covered = excluded.vet_covered,
    transport_available = excluded.transport_available,medical_needs = excluded.medical_needs,home_fit = excluded.home_fit,
    updated_at = clock_timestamp();
  return case_result;
end $function$;

revoke all on function public.notification_category(text) from public,anon,authenticated;
notify pgrst, 'reload schema';
