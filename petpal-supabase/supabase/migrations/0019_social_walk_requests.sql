-- Social Walk opens with one request, not reciprocal likes. Existing chats stay open.
alter table public.conversations
  add column social_request_sender_id uuid references public.profiles(id) on delete cascade,
  add column social_request_status text check (social_request_status in ('PENDING','ACCEPTED','DECLINED')),
  add constraint social_request_context check (
    (social_request_sender_id is null) = (social_request_status is null)
    and (social_request_status is null or source = 'MATCH')
  );

create function public.require_social_walk_request()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.mode = 'SOCIAL' then raise exception 'Use a Social Walk request instead of a like'; end if;
  return new;
end $$;
create trigger require_social_walk_request before insert on public.animal_match_likes
for each row execute function public.require_social_walk_request();

-- Also protects older clients and both send RPC signatures. The row lock serializes sends/decisions.
create function public.guard_social_walk_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare conversation public.conversations;
begin
  select * into conversation from public.conversations where id = new.conversation_id for update;
  if conversation.social_request_status = 'DECLINED' or
    (conversation.social_request_status = 'PENDING' and (
      new.sender_id <> conversation.social_request_sender_id or
      exists (select 1 from public.messages where conversation_id = new.conversation_id)
    )) then raise exception 'Social Walk request must be accepted before messaging'; end if;
  return new;
end $$;
create trigger guard_social_walk_message before insert on public.messages
for each row execute function public.guard_social_walk_message();

create function public.request_social_walk(my_animal_id_input uuid,target_animal_id_input uuid,body_input text)
returns uuid language plpgsql security definer set search_path = public as $$
declare my_owner uuid; target_owner uuid; existing_id uuid; match_result uuid; conversation_result uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if body_input is null or char_length(trim(body_input)) < 1 or char_length(body_input) > 4000 then
    raise exception 'Message body must be between 1 and 4000 characters'; end if;
  select owner_id into my_owner from public.owner_animal_profiles where id = my_animal_id_input;
  select owner_id into target_owner from public.owner_animal_profiles where id = target_animal_id_input;
  if my_owner is distinct from auth.uid() or target_owner is null or target_owner = auth.uid()
    or public.is_profile_blocked_between(my_owner,target_owner) then
    raise exception 'Social Walk profile is not available'; end if;
  if not exists (select 1 from public.owner_animal_profiles where id = my_animal_id_input
    and 'SOCIAL' = any(active_match_modes)) or not exists (
    select 1 from public.match_candidates_view where animal_id = target_animal_id_input
      and 'SOCIAL' = any(active_match_modes)
  ) then raise exception 'Social Walk must be enabled for both animals'; end if;

  -- One request per owner pair, even with multiple animals or concurrent reciprocal requests.
  perform pg_advisory_xact_lock(hashtextextended('social:' || least(my_owner,target_owner)::text || greatest(my_owner,target_owner)::text,0));
  select c.id into existing_id from public.conversations c
    join public.animal_matches am on am.id = c.match_id and am.mode = 'SOCIAL'
    join public.conversation_participants a on a.conversation_id = c.id and a.profile_id = my_owner
    join public.conversation_participants b on b.conversation_id = c.id and b.profile_id = target_owner
    order by (c.social_request_status is not null) desc,c.created_at desc limit 1;
  if existing_id is not null then return existing_id; end if;

  insert into public.animal_matches(animal_a_id,animal_b_id,mode)
    values(least(my_animal_id_input,target_animal_id_input),greatest(my_animal_id_input,target_animal_id_input),'SOCIAL')
    returning id into match_result;
  insert into public.conversations(source,match_id,social_request_sender_id,social_request_status)
    values('MATCH',match_result,my_owner,'PENDING') returning id into conversation_result;
  insert into public.conversation_participants(conversation_id,profile_id)
    values(conversation_result,my_owner),(conversation_result,target_owner);
  perform public.send_conversation_message(conversation_result,body_input,gen_random_uuid());
  return conversation_result;
end $$;
revoke all on function public.request_social_walk(uuid,uuid,text) from public;
grant execute on function public.request_social_walk(uuid,uuid,text) to authenticated;

create function public.respond_social_walk(conversation_id_input uuid,accept_input boolean)
returns text language plpgsql security definer set search_path = public as $$
declare conversation public.conversations; next_status text;
begin
  if auth.uid() is null or accept_input is null then raise exception 'Invalid request'; end if;
  select * into conversation from public.conversations where id = conversation_id_input for update;
  if conversation.social_request_status is null or conversation.social_request_sender_id = auth.uid()
    or not public.is_conversation_participant(conversation_id_input)
    or public.is_conversation_blocked(conversation_id_input,auth.uid()) then
    raise exception 'Social Walk request not found or not accessible'; end if;
  next_status := case when accept_input then 'ACCEPTED' else 'DECLINED' end;
  if conversation.social_request_status = next_status then return next_status; end if;
  if conversation.social_request_status <> 'PENDING' then raise exception 'Social Walk request was already answered'; end if;
  update public.conversations set social_request_status = next_status where id = conversation_id_input;
  -- Publish the decision through the existing participant subscription, not private profile data.
  update public.conversation_participants set last_read_seq = last_read_seq where conversation_id = conversation_id_input;
  return next_status;
end $$;
revoke all on function public.respond_social_walk(uuid,boolean) from public;
grant execute on function public.respond_social_walk(uuid,boolean) to authenticated;

create or replace view public.conversation_inbox_view as
select v.*,cp.last_read_seq,
  (select count(*)::integer from public.messages m where m.conversation_id = v.conversation_id
    and m.sender_id <> auth.uid() and m.message_seq > cp.last_read_seq
    and not public.is_conversation_blocked(v.conversation_id,auth.uid())) as unread_count,
  public.is_conversation_blocked(v.conversation_id,auth.uid()) as messaging_blocked,
  coalesce(v.last_message_at,v.created_at) as activity_at,
  (select oap.photo_urls[1] from public.animal_matches am
    join public.owner_animal_profiles oap on oap.id in (am.animal_a_id,am.animal_b_id)
    where am.id = v.match_id and oap.owner_id <> auth.uid() limit 1) as animal_photo,
  (select p.display_name from public.conversation_participants other_cp join public.profiles p on p.id = other_cp.profile_id
    where other_cp.conversation_id = v.conversation_id and other_cp.profile_id <> auth.uid() limit 1) as other_owner_name,
  c.social_request_status,(c.social_request_sender_id = auth.uid()) as social_request_is_mine
from public.my_conversations_view v
join public.conversation_participants cp on cp.conversation_id = v.conversation_id and cp.profile_id = auth.uid()
join public.conversations c on c.id = v.conversation_id;
