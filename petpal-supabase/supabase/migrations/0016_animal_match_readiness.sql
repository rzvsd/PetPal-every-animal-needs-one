-- Additive contracts for bounded discovery, saved animals and reliable chat.
create table public.saved_animals (
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  animal_id uuid not null references public.owner_animal_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, animal_id)
);
alter table public.saved_animals enable row level security;
create policy saved_animals_read on public.saved_animals for select to authenticated
  using (profile_id = auth.uid());
create policy saved_animals_delete on public.saved_animals for delete to authenticated
  using (profile_id = auth.uid());

create or replace view public.match_candidates_view as
select oap.id as animal_id, oap.owner_id, oap.name, oap.species, oap.breed_or_mix,
  oap.is_mixed_breed, oap.approximate_age_months, oap.sex, oap.size_label, oap.weight_kg,
  oap.sterilized_status, oap.vaccine_status, oap.health_document_status,
  oap.admin_mate_approval_status, oap.temperament_tags, oap.energy_level,
  oap.good_with_dogs, oap.good_with_cats, oap.good_with_children, oap.city,
  oap.coarse_area, oap.photo_urls, oap.active_match_modes, oap.profile_completeness,
  oap.verification_status, p.verification_status as owner_verification_status,
  exists (
    select 1 from public.animal_match_likes aml
    join public.owner_animal_profiles mine on mine.id = aml.target_animal_id
    where aml.my_animal_id = oap.id and mine.owner_id = auth.uid()
  ) as has_liked_back
from public.owner_animal_profiles oap
join public.profiles p on p.id = oap.owner_id
where auth.uid() is not null and oap.owner_id <> auth.uid()
  and oap.profile_completeness >= 50 and cardinality(oap.photo_urls) > 0
  and not public.is_profile_blocked_between(auth.uid(), oap.owner_id);

create policy saved_animals_insert on public.saved_animals for insert to authenticated
  with check (profile_id = auth.uid() and exists (
    select 1 from public.match_candidates_view c where c.animal_id = saved_animals.animal_id
  ));
grant select, insert, delete on public.saved_animals to authenticated;

create function public.discover_match_candidates(
  my_animal_id_input uuid, mode_input text, filters_input jsonb default '{}',
  saved_only_input boolean default false, after_id_input uuid default null
)
returns setof public.match_candidates_view
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.owner_animal_profiles where id = my_animal_id_input and owner_id = auth.uid()
  ) then raise exception 'Animal not found or not accessible'; end if;
  if mode_input not in ('PLAY', 'SOCIAL', 'VERIFIED_MATE') then
    raise exception 'Unsupported match mode';
  end if;
  return query select c.* from public.match_candidates_view c
  where mode_input = any(c.active_match_modes)
    and (after_id_input is null or c.animal_id > after_id_input)
    and (mode_input <> 'VERIFIED_MATE' or
      (c.health_document_status = 'VERIFIED' and c.admin_mate_approval_status = 'VERIFIED'))
    and (nullif(filters_input->>'species', '') is null or c.species::text = filters_input->>'species')
    and (coalesce(filters_input->>'verifiedOnly', 'false') <> 'true' or c.owner_verification_status = 'VERIFIED')
    and (nullif(filters_input->>'breed', '') is null or c.breed_or_mix = filters_input->>'breed')
    and (nullif(filters_input->>'sex', '') is null or c.sex = filters_input->>'sex')
    and (nullif(filters_input->>'size', '') is null or c.size_label = filters_input->>'size')
    and (nullif(filters_input->>'area', '') is null or c.city = filters_input->>'area' or c.coarse_area = filters_input->>'area')
    and (not saved_only_input or exists (
      select 1 from public.saved_animals s where s.profile_id = auth.uid() and s.animal_id = c.animal_id
    ))
  order by c.animal_id limit 20;
end $$;
revoke all on function public.discover_match_candidates(uuid,text,jsonb,boolean,uuid) from public;
grant execute on function public.discover_match_candidates(uuid,text,jsonb,boolean,uuid) to authenticated;

create or replace function public.like_match_candidate(
  my_animal_id_input uuid, target_animal_id_input uuid, mode_input text
)
returns table(matched boolean, match_id uuid, conversation_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  my_owner uuid; target_owner uuid; a_id uuid; b_id uuid;
  match_result uuid; conversation_result uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if mode_input is null or mode_input not in ('PLAY', 'SOCIAL', 'VERIFIED_MATE') then
    raise exception 'Unsupported match mode'; end if;
  a_id := least(my_animal_id_input, target_animal_id_input);
  b_id := greatest(my_animal_id_input, target_animal_id_input);
  -- Serialize this pair before reading reciprocal likes; distinct pairs stay independent.
  perform pg_advisory_xact_lock(hashtextextended(a_id::text || b_id::text || mode_input, 0));
  select owner_id into my_owner from public.owner_animal_profiles where id = my_animal_id_input;
  select owner_id into target_owner from public.owner_animal_profiles where id = target_animal_id_input;
  if my_owner is distinct from auth.uid() or target_owner is null or target_owner = auth.uid()
    or public.is_profile_blocked_between(my_owner, target_owner) then
    raise exception 'Match candidate not available'; end if;
  if not exists (
    select 1 from public.owner_animal_profiles where id = my_animal_id_input
      and mode_input = any(active_match_modes)
      and (mode_input <> 'VERIFIED_MATE' or
        (health_document_status = 'VERIFIED' and admin_mate_approval_status = 'VERIFIED'))
  ) or not exists (
    select 1 from public.match_candidates_view where animal_id = target_animal_id_input
      and mode_input = any(active_match_modes)
      and (mode_input <> 'VERIFIED_MATE' or
        (health_document_status = 'VERIFIED' and admin_mate_approval_status = 'VERIFIED'))
  ) then raise exception 'Match mode is not available for both animals'; end if;
  insert into public.animal_match_likes (my_animal_id,target_animal_id,liker_id,mode)
    values (my_animal_id_input,target_animal_id_input,auth.uid(),mode_input) on conflict do nothing;
  if exists (select 1 from public.animal_match_likes where my_animal_id = target_animal_id_input
    and target_animal_id = my_animal_id_input and mode = mode_input) then
    insert into public.animal_matches (animal_a_id,animal_b_id,mode) values (a_id,b_id,mode_input)
      on conflict (animal_a_id,animal_b_id,mode) do update set status = 'ACTIVE' returning id into match_result;
    insert into public.conversations (source,match_id) values ('MATCH',match_result)
      on conflict on constraint conversations_match_id_key do update set match_id = excluded.match_id
      returning id into conversation_result;
    insert into public.conversation_participants (conversation_id,profile_id)
      values (conversation_result,my_owner),(conversation_result,target_owner) on conflict do nothing;
    return query select true,match_result,conversation_result;
  else return query select false,null::uuid,null::uuid;
  end if;
end $$;

alter table public.messages add column client_message_id uuid;
alter table public.messages add column message_seq bigint generated always as identity;
create unique index messages_sender_client_key on public.messages(sender_id,client_message_id);
create unique index messages_sequence_key on public.messages(message_seq);
create index messages_conversation_sequence_idx on public.messages(conversation_id,message_seq desc);
alter table public.conversation_participants add column last_read_seq bigint not null default 0;

-- The same visibility rule protects REST reads and Realtime delivery.
drop policy messages_participant_read on public.messages;
create policy messages_participant_read on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id)
    and not public.is_conversation_blocked(conversation_id,auth.uid()));

create or replace view public.conversation_messages_view as
select m.id as message_id,m.conversation_id,m.sender_id,p.display_name as sender_display_name,
  m.body,m.created_at,(m.sender_id = auth.uid()) as is_mine,m.client_message_id,m.message_seq
from public.messages m join public.profiles p on p.id = m.sender_id
where public.is_conversation_participant(m.conversation_id)
  and not public.is_conversation_blocked(m.conversation_id,auth.uid());

create function public.send_conversation_message(
  conversation_id_input uuid,body_input text,client_message_id_input uuid
)
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
  -- A conversation lock orders sends and read positions across concurrent transactions.
  perform 1 from public.conversations where id = conversation_id_input for update;
  insert into public.messages(conversation_id,sender_id,body,client_message_id)
    values(conversation_id_input,auth.uid(),trim(body_input),client_message_id_input)
    returning id into message_id_result;
  perform public.enqueue_push_notification(cp.profile_id,'NEW_MESSAGE',
    jsonb_build_object('conversationId',conversation_id_input,'messageId',message_id_result,'senderId',auth.uid()),
    'New PetPal message','Open PetPal to read your message.')
    from public.conversation_participants cp where cp.conversation_id = conversation_id_input and cp.profile_id <> auth.uid();
  insert into public.notification_events(profile_id,event_type,payload,title,body,delivery_status)
    select cp.profile_id,'MESSAGE_RECEIVED',jsonb_build_object('conversationId',conversation_id_input,'messageId',message_id_result),
      'Message received','A conversation message was received.','SKIPPED'
    from public.conversation_participants cp where cp.conversation_id = conversation_id_input and cp.profile_id <> auth.uid();
  return message_id_result;
end $$;
revoke all on function public.send_conversation_message(uuid,text,uuid) from public;
grant execute on function public.send_conversation_message(uuid,text,uuid) to authenticated;
-- Preserve the two-argument RPC used by already-installed clients.
create or replace function public.send_conversation_message(conversation_id_input uuid,body_input text)
returns uuid language sql security invoker set search_path = public as $$
  select public.send_conversation_message(conversation_id_input,body_input,null::uuid);
$$;

create function public.mark_conversation_read(conversation_id_input uuid,message_id_input uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare read_seq bigint;
begin
  if not public.is_conversation_participant(conversation_id_input)
    or public.is_conversation_blocked(conversation_id_input,auth.uid()) then
    raise exception 'Conversation not found or not accessible'; end if;
  select message_seq into read_seq from public.messages
    where id = message_id_input and conversation_id = conversation_id_input;
  if read_seq is null then raise exception 'Message not found'; end if;
  update public.conversation_participants set last_read_seq = greatest(last_read_seq,read_seq)
    where conversation_id = conversation_id_input and profile_id = auth.uid()
    returning last_read_seq into read_seq;
  return read_seq;
end $$;
revoke all on function public.mark_conversation_read(uuid,uuid) from public;
grant execute on function public.mark_conversation_read(uuid,uuid) to authenticated;

create view public.conversation_inbox_view as
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
    where other_cp.conversation_id = v.conversation_id and other_cp.profile_id <> auth.uid() limit 1) as other_owner_name
from public.my_conversations_view v
join public.conversation_participants cp on cp.conversation_id = v.conversation_id and cp.profile_id = auth.uid();
grant select on public.conversation_inbox_view to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_participants') then
    alter publication supabase_realtime add table public.conversation_participants;
  end if;
end $$;
