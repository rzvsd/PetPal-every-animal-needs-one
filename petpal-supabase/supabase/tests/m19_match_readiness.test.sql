begin;
select no_plan();

-- Only seeded local accounts; every fixture and action rolls back.
insert into public.owner_animal_profiles(id,owner_id,name,species,photo_urls,profile_completeness,active_match_modes)
values
  ('51000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','QA A','DOG',array['https://example.test/a.jpg'],100,array['PLAY','VERIFIED_MATE']),
  ('51000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','QA B','DOG',array['https://example.test/b.jpg'],100,array['PLAY','VERIFIED_MATE']);
create temp table qa_chat(conversation_id uuid,message_id uuid);
grant all on qa_chat to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select throws_ok($$update public.owner_animal_profiles set admin_mate_approval_status='VERIFIED'
  where id='51000000-0000-4000-8000-000000000001'$$,'P0001',
  'Verification decisions require an authorized reviewer','owner cannot self-approve mate eligibility');
select throws_ok($$select * from public.like_match_candidate('51000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000002','VERIFIED_MATE')$$,'P0001',
  'Match mode is not available for both animals','mate checks are enforced at the RPC boundary');
select throws_ok($$select * from public.like_match_candidate('51000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000002','SOCIAL')$$,'P0001',
  'Match mode is not available for both animals','disabled mode cannot be liked');
select lives_ok($$insert into public.saved_animals(animal_id) values('51000000-0000-4000-8000-000000000002')$$,
  'visible candidate can be saved');
select throws_ok($$insert into public.saved_animals(animal_id) values('51000000-0000-4000-8000-000000000002')$$,
  '23505',null,'duplicate save is constrained');
select is((select count(*)::integer from public.discover_match_candidates('51000000-0000-4000-8000-000000000001','PLAY','{}',true)
  where animal_id='51000000-0000-4000-8000-000000000002'),
  1,'Saved discovery reads persisted account records');
select is((select matched from public.like_match_candidate('51000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000002','PLAY')),false,'first like does not invent a match');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select is((select count(*)::integer from public.saved_animals where animal_id='51000000-0000-4000-8000-000000000002'),0,
  'other account cannot read saved records');
insert into qa_chat(conversation_id) select conversation_id from public.like_match_candidate(
  '51000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001','PLAY');
select is((select conversation_id from public.like_match_candidate('51000000-0000-4000-8000-000000000002',
  '51000000-0000-4000-8000-000000000001','PLAY')),(select conversation_id from qa_chat),'repeat mutual like reuses conversation');
update qa_chat set message_id=public.send_conversation_message(conversation_id,'QA message','52000000-0000-4000-8000-000000000001');
select is((select public.send_conversation_message(conversation_id,'QA message','52000000-0000-4000-8000-000000000001') from qa_chat),
  (select message_id from qa_chat),'uncertain send retry returns the canonical message');
select is((select count(*)::integer from public.messages where conversation_id=(select conversation_id from qa_chat)),1,
  'retry persists exactly one message');
select throws_ok($$select public.send_conversation_message(conversation_id,'different','52000000-0000-4000-8000-000000000001') from qa_chat$$,
  'P0001','Message request ID was already used for different content','request IDs cannot change payload');
select throws_ok($$select public.send_conversation_message(conversation_id,repeat('x',4001),null) from qa_chat$$,
  'P0001','Message body must be between 1 and 4000 characters','server rejects overlong text');
select lives_ok($$select public.send_conversation_message(conversation_id,'Legacy client') from qa_chat$$,
  'legacy two-argument send remains compatible');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select is((select unread_count from public.conversation_inbox_view where conversation_id=(select conversation_id from qa_chat)),2,
  'recipient unread count includes incoming messages');
select lives_ok($$select public.mark_conversation_read(conversation_id,message_id) from qa_chat$$,'participant can mark visible message read');
select is((select unread_count from public.conversation_inbox_view where conversation_id=(select conversation_id from qa_chat)),1,
  'read position does not mark later unseen messages read');
select lives_ok($$select public.mark_conversation_read(conversation_id,message_id) from qa_chat$$,'repeat read position is harmless');
select is((select count(*)::integer from public.notification_events where payload->>'messageId'=(select message_id::text from qa_chat)
  and event_type='MESSAGE_RECEIVED'),1,'retry emits one recipient notification event');
select lives_ok($$delete from public.saved_animals where animal_id='51000000-0000-4000-8000-000000000002'$$,'owner can unsave');
select is((select count(*)::integer from public.saved_animals where animal_id='51000000-0000-4000-8000-000000000002'),0,'unsave persists');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select is((select count(*)::integer from public.messages where conversation_id=(select conversation_id from qa_chat)),0,'unrelated account cannot read messages');
select throws_ok($$select public.send_conversation_message(conversation_id,'intruder',null) from qa_chat$$,'P0001',
  'Conversation not found or not accessible','unrelated sender rejected');
select throws_ok($$select public.mark_conversation_read(conversation_id,message_id) from qa_chat$$,'P0001',
  'Conversation not found or not accessible','unrelated reader rejected');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
insert into public.blocks(blocker_id,blocked_id) values(auth.uid(),'10000000-0000-4000-8000-000000000004');
select is((select count(*)::integer from public.match_candidates_view where animal_id='51000000-0000-4000-8000-000000000002'),0,
  'blocked candidate is hidden');
select throws_ok($$insert into public.saved_animals(animal_id) values('51000000-0000-4000-8000-000000000002')$$,
  '42501',null,'saving cannot bypass blocking');
select is((select count(*)::integer from public.conversation_messages_view where conversation_id=(select conversation_id from qa_chat)),0,
  'blocked conversation hides message view');
select is((select last_message_body from public.my_conversations_view where conversation_id=(select conversation_id from qa_chat)),null::text,
  'legacy inbox does not leak blocked message preview');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select is((select count(*)::integer from public.messages where conversation_id=(select conversation_id from qa_chat)),0,'block protects reverse-direction table reads');
select throws_ok($$select public.send_conversation_message(conversation_id,'blocked',null) from qa_chat$$,'P0001',
  'Messaging is blocked for this conversation','blocked account cannot send');
reset role;
select * from finish();
rollback;
