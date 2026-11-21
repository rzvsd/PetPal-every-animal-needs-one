begin;
select no_plan();

-- Custody safety (0034): endings, transfers with the owner, blocks during care,
-- the owner's notes and tasks, contacts and the vet alert. Fixtures as
-- postgres; client actions as the authenticated role; everything rolls back.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000003401','m34owner@example.test'),
  ('10000000-0000-4000-8000-000000003402','m34f1@example.test'),
  ('10000000-0000-4000-8000-000000003403','m34f2@example.test'),
  ('10000000-0000-4000-8000-000000003404','m34f3@example.test');
insert into public.profiles(id,display_name,city) values
  ('10000000-0000-4000-8000-000000003401','M34 Owner','Bucharest'),
  ('10000000-0000-4000-8000-000000003402','M34 Foster One','Bucharest'),
  ('10000000-0000-4000-8000-000000003403','M34 Foster Two','Bucharest'),
  ('10000000-0000-4000-8000-000000003404','M34 Foster Three','Bucharest');

create temp table ids(name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
create function pg_temp.stamp(placement uuid) returns timestamptz language sql security definer as
  $$ select updated_at from public.foster_placements where id = placement $$;
create function pg_temp.req_stamp(request uuid) returns timestamptz language sql security definer as
  $$ select updated_at from public.foster_requests where id = request $$;
grant execute on function pg_temp.stamp(uuid), pg_temp.req_stamp(uuid) to authenticated;
set local role authenticated;

-- Owner posts Coco; Foster One takes her in.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003401',true);
insert into ids values('case',public.save_foster_case(null,null,'{"name":"Coco","species":"DOG","description":"Owner abroad.","city":"Bucharest"}'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003402',true);
insert into ids values('home1',public.save_foster_home(null,'{"name":"Home One","city":"Bucharest","published":true,"capacity":3}'));
insert into ids values('req1',public.create_foster_request(null,(select id from ids where name='case'),(select id from ids where name='home1'),'APPLICATION','I can take Coco'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003401',true);
insert into ids values('p1',public.respond_foster_request((select id from ids where name='req1'),'ACCEPT',pg_temp.req_stamp((select id from ids where name='req1'))));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003402',true);
select public.update_foster_placement((select id from ids where name='p1'),'RECEIVE',jsonb_build_object('expectedUpdatedAt',pg_temp.stamp((select id from ids where name='p1'))));

-- Contacts: the owner's emergency phone and vet, the foster's own phone.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003401',true);
select lives_ok($$select public.update_foster_placement((select id from ids where name='p1'),'CONTACTS','{"emergencyPhone":"0722 000 111","vetContact":"Vet Dr. Pop, 0211 222 333"}')$$,
  'the owner shares an emergency phone and vet');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003402',true);
select is((select emergency_phone from public.foster_registry_view where id = (select id from ids where name='p1')),'0722 000 111',
  'the foster sees the owner''s emergency phone');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003404',true);
select is((select count(*) from public.foster_registry_view where id = (select id from ids where name='p1')),0::bigint,'an outsider sees nothing');

-- The owner adds notes and tasks; only the home ticks tasks.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003401',true);
select lives_ok($$select public.update_foster_placement((select id from ids where name='p1'),'NOTE','{"body":"Pill at 8:00 with food"}')$$,'the owner can add a diary note');
insert into ids values('task',public.save_foster_task(null,(select id from ids where name='p1'),'{"title":"Heart pill","assigneeId":""}'));
select throws_ok($$select public.save_foster_task((select id from ids where name='task'),(select id from ids where name='p1'),'{"completed":true}')$$,
  'P0001','Only the foster home can tick off tasks','the owner cannot tick the foster''s task');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003402',true);
select lives_ok($$select public.save_foster_task((select id from ids where name='task'),(select id from ids where name='p1'),'{"completed":true}')$$,'the foster ticks it');

-- Needs a vet reaches the owner at once.
select public.update_foster_placement((select id from ids where name='p1'),'CARE',
  jsonb_build_object('careState','MEDICAL','expectedUpdatedAt',pg_temp.stamp((select id from ids where name='p1'))));
reset role;
select ok(exists(select 1 from public.notification_events where profile_id = '10000000-0000-4000-8000-000000003401'
  and event_type = 'FOSTER_URGENT' and body like 'Coco are nevoie de veterinar%' and delivery_status = 'QUEUED'),'"needs a vet" is an urgent push to the owner');

-- A block during care keeps the chat readable, stops free writing and flags the moderator.
insert into public.blocks(blocker_id,blocked_id) values('10000000-0000-4000-8000-000000003402','10000000-0000-4000-8000-000000003401');
select ok(exists(select 1 from public.reports where category = 'BLOCK_DURING_PLACEMENT' and reporter_id is null),'the moderator gets an automatic flag');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003401',true);
select ok((select count(*) from public.conversation_messages_view where conversation_id =
  (select id from public.conversations where foster_request_id = (select id from ids where name='req1'))) > 0,'the owner still reads the placement chat');
select ok((select history_kept and messaging_blocked from public.conversation_inbox_view where foster_request_id = (select id from ids where name='req1')),
  'the inbox shows the chat as kept but not writable');
select throws_ok($$select public.send_conversation_message((select id from public.conversations where foster_request_id = (select id from ids where name='req1')),'hello',gen_random_uuid())$$,
  'P0001','Messaging is blocked for this conversation','free writing stops');
reset role;
delete from public.blocks where blocker_id = '10000000-0000-4000-8000-000000003402';
set local role authenticated;

-- Transfer: Foster One re-posts Coco; the owner is asked and can refuse.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003402',true);
insert into ids values('case2',public.save_foster_case(null,(select animal_id from public.foster_registry_view where id = (select id from ids where name='p1')),
  '{"name":"Coco","species":"DOG","description":"I am moving abroad, Coco needs a new foster.","city":"Bucharest"}'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003403',true);
insert into ids values('home2',public.save_foster_home(null,'{"name":"Home Two","city":"Bucharest","published":true,"capacity":3}'));
insert into ids values('req2',public.create_foster_request(null,(select id from ids where name='case2'),(select id from ids where name='home2'),'APPLICATION','I can take Coco next'));
reset role;
select is((select owner_consent from public.foster_requests where id = (select id from ids where name='req2')),'PENDING','the owner''s consent is pending');
select ok(exists(select 1 from public.conversation_participants where profile_id = '10000000-0000-4000-8000-000000003401'
  and conversation_id = (select id from public.conversations where foster_request_id = (select id from ids where name='req2'))),'the owner joins the transfer chat');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003402',true);
select throws_ok($$select public.respond_foster_request((select id from ids where name='req2'),'ACCEPT',pg_temp.req_stamp((select id from ids where name='req2')))$$,
  'P0001',null,'the foster cannot accept while the owner has not answered');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003401',true);
select is(public.respond_transfer_consent((select id from ids where name='req2'),false,'I will find someone myself'),'REFUSED','the owner refuses');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003402',true);
select throws_ok($$select public.respond_foster_request((select id from ids where name='req2'),'ACCEPT',pg_temp.req_stamp((select id from ids where name='req2')))$$,
  'P0001','The animal''s owner refused this transfer','a refused transfer cannot be accepted');

-- A second home: the owner stays silent for 7 days, so the foster may go ahead.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003404',true);
insert into ids values('home3',public.save_foster_home(null,'{"name":"Home Three","city":"Bucharest","published":true,"capacity":3}'));
insert into ids values('req3',public.create_foster_request(null,(select id from ids where name='case2'),(select id from ids where name='home3'),'APPLICATION','Me then'));
reset role;
update public.foster_requests set consent_asked_at = now() - interval '8 days' where id = (select id from ids where name='req3');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003402',true);
insert into ids values('p3',public.respond_foster_request((select id from ids where name='req3'),'ACCEPT',pg_temp.req_stamp((select id from ids where name='req3'))));
reset role;
select is((select owner_consent from public.foster_requests where id = (select id from ids where name='req3')),'NO_ANSWER','the record says the owner did not answer');
select ok(exists(select 1 from public.reports where category = 'TRANSFER_WITHOUT_OWNER'),'the moderator is told');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003404',true);
select public.update_foster_placement((select id from ids where name='p3'),'RECEIVE',jsonb_build_object('expectedUpdatedAt',pg_temp.stamp((select id from ids where name='p3'))));
reset role;
select is((select outcome from public.foster_placements where id = (select id from ids where name='p1')),'MOVED','the first placement ends as moved');
select ok(exists(select 1 from public.notification_events where profile_id = '10000000-0000-4000-8000-000000003401'
  and event_type = 'FOSTER_URGENT' and title = 'Animalul s-a mutat'),'the owner is told the animal moved');
set local role authenticated;

-- The owner still sees the new home and says "my animal is back".
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003401',true);
select is((select home_name from public.foster_registry_view where id = (select id from ids where name='p3')),'Home Three','the owner sees the new home');
select throws_ok($$select public.update_foster_placement((select id from ids where name='p3'),'END',
  jsonb_build_object('expectedUpdatedAt',pg_temp.stamp((select id from ids where name='p3'))))$$,'P0001','Choose how the care ended','an ending needs an outcome');
select lives_ok($$select public.update_foster_placement((select id from ids where name='p3'),'END',
  jsonb_build_object('outcome','RETURNED','expectedUpdatedAt',pg_temp.stamp((select id from ids where name='p3'))))$$,'the owner ends care: Coco is back');
reset role;
select ok((select status = 'COMPLETED' and end_confirmed_at is not null and contest_until > now() and chat_open_until > now() + interval '13 days'
  from public.foster_placements where id = (select id from ids where name='p3')),'the ending is recorded with a contest window and an open chat');
select is((select status::text from public.animal_listings where id = (select id from ids where name='case2')),'ARCHIVED','the case is archived, not re-listed');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003404',true);
select lives_ok($$select public.send_conversation_message((select id from public.conversations where foster_request_id = (select id from ids where name='req3')),'Bye Coco!',gen_random_uuid())$$,
  'the chat stays open after the ending');
select ok((public.my_account_deletion_blockers()->>'activePlacements')::integer > 0,'deletion waits for the 7-day contest window');
select lives_ok($$select public.update_foster_placement((select id from ids where name='p3'),'DISPUTE','{"body":"She is still with me, pickup is tomorrow"}')$$,
  'the other side can contest within 7 days');

select * from finish();
rollback;
