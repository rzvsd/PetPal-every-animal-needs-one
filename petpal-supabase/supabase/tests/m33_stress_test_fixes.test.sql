begin;
select no_plan();

-- Stress-test fixes (0033). Fixtures as postgres; client actions as the real
-- authenticated role; everything rolls back.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000003301','m33owner@example.test'),
  ('10000000-0000-4000-8000-000000003302','m33fostera@example.test'),
  ('10000000-0000-4000-8000-000000003303','m33fosterb@example.test'),
  ('10000000-0000-4000-8000-000000003304','m33fosterc@example.test');
insert into public.profiles(id,display_name,city) values
  ('10000000-0000-4000-8000-000000003301','M33 Owner','Bucharest'),
  ('10000000-0000-4000-8000-000000003302','M33 Foster A','Bucharest'),
  ('10000000-0000-4000-8000-000000003303','M33 Foster B','Bucharest'),
  ('10000000-0000-4000-8000-000000003304','M33 Foster C','Bucharest');

set local role authenticated;
create temp table ids(name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003301',true);
insert into ids values('case',public.save_foster_case('20000000-0000-4000-8000-000000003301',null,
  '{"name":"Pufi","species":"CAT","description":"Found under a car.","city":"Bucharest"}'));

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003302',true);
insert into ids values('homeA',public.save_foster_home(null,'{"name":"Home A","city":"Bucharest","published":true,"capacity":2}'));
insert into ids values('reqA',public.create_foster_request(null,(select id from ids where name='case'),(select id from ids where name='homeA'),'APPLICATION','I can help'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003303',true);
insert into ids values('homeB',public.save_foster_home(null,'{"name":"Home B","city":"Bucharest","published":true,"capacity":2}'));
insert into ids values('reqB',public.create_foster_request(null,(select id from ids where name='case'),(select id from ids where name='homeB'),'APPLICATION','Me too'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003304',true);
insert into ids values('homeC',public.save_foster_home(null,'{"name":"Home C","city":"Bucharest","published":true,"capacity":2}'));

-- The owner accepts A; B is closed as placed elsewhere and told.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003301',true);
select lives_ok($$select public.respond_foster_request((select id from ids where name='reqA'),'ACCEPT',
  (select updated_at from public.foster_requests where id = (select id from ids where name='reqA')))$$,'the case owner accepts one home');
reset role;
select is((select status from public.foster_requests where id = (select id from ids where name='reqB')),'PLACED_ELSEWHERE',
  'the other pending application closes as placed elsewhere');
select ok(exists(select 1 from public.notification_events where profile_id = '10000000-0000-4000-8000-000000003303'
  and event_type = 'FOSTER_UPDATE' and body like 'Pufi și-a găsit o casă%' and title = 'Pufi'),'the losing foster is notified with the animal''s name');
set local role authenticated;

-- A third home cannot apply to the reserved case.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003304',true);
select throws_ok($$select public.create_foster_request(null,(select id from ids where name='case'),(select id from ids where name='homeC'),'APPLICATION','Late offer')$$,
  'P0001','This animal has already found a home','a request for an already reserved case is refused');

-- Changing species on edit is refused, not silently ignored.
reset role;
create temp table stamps on commit drop as select updated_at from public.animal_listings where id = (select id from ids where name='case');
grant select on stamps to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003301',true);
select throws_ok($$select public.save_foster_case((select id from ids where name='case'),null,
  jsonb_build_object('name','Pufi','species','DOG','description','Found under a car.','city','Bucharest',
    'expectedUpdatedAt',(select updated_at from stamps)))$$,
  'P0001','The species of an animal cannot be changed. Post a new animal instead.','the species cannot change on edit');

-- Foster A completes care and cannot review their own home; the owner can.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003302',true);
select lives_ok($$select public.update_foster_placement((select id from public.foster_placements where request_id = (select id from ids where name='reqA')),'RECEIVE',
  jsonb_build_object('expectedUpdatedAt',(select updated_at from public.foster_placements where request_id = (select id from ids where name='reqA'))))$$,'the foster declares receipt');
select lives_ok($$select public.update_foster_placement((select id from public.foster_placements where request_id = (select id from ids where name='reqA')),'END',
  jsonb_build_object('body','Adopted','outcome','ADOPTED_ELSEWHERE','expectedUpdatedAt',(select updated_at from public.foster_placements where request_id = (select id from ids where name='reqA'))))$$,'the foster ends care');
select throws_ok($$select public.review_foster_placement((select id from public.foster_placements where request_id = (select id from ids where name='reqA')),5,'We are the best')$$,
  'P0001','You cannot review your own foster home','a foster cannot review their own home');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003301',true);
select lives_ok($$select public.review_foster_placement((select id from public.foster_placements where request_id = (select id from ids where name='reqA')),5,'Lovely care')$$,
  'the case owner can review the home');
select is((select count(*) from public.foster_reviews_view where home_id = (select id from ids where name='homeA')),1::bigint,'only the owner''s review is public');

-- Notification choices are saved on the account and honoured by the server.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003303',true);
select is(public.set_notification_preferences('{"foster":false}')->>'foster','false','turning Foster updates off is saved');
select throws_ok($$select public.set_notification_preferences('{"foster":"maybe"}')$$,'P0001','Notification choices must be on or off','choices must be booleans');
reset role;
insert into ids values('quiet',public.enqueue_push_notification('10000000-0000-4000-8000-000000003303','FOSTER_UPDATE','{}','t','b'));
insert into ids values('urgent',public.enqueue_push_notification('10000000-0000-4000-8000-000000003303','FOSTER_URGENT','{}','t','b'));
select is((select delivery_status from public.notification_events where id = (select id from ids where name='quiet')),'SKIPPED',
  'a switched-off category is stored but not pushed');
select is((select delivery_status from public.notification_events where id = (select id from ids where name='urgent')),'QUEUED',
  'urgent alerts about an animal always send');
set local role authenticated;

-- Chat pushes collapse while unread; one row per message; 30 messages a minute.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003301',true);
insert into ids values('case2',public.save_foster_case(null,null,'{"name":"Coco","species":"DOG","description":"Owner abroad.","city":"Bucharest"}'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003304',true);
insert into ids values('reqC',public.create_foster_request(null,(select id from ids where name='case2'),(select id from ids where name='homeC'),'APPLICATION','Happy to help'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003301',true);
select public.send_conversation_message((select id from public.conversations where foster_request_id = (select id from ids where name='reqC')),'msg ' || n,gen_random_uuid())
  from generate_series(1,5) n;
reset role;
select is((select count(*) from public.notification_events where profile_id = '10000000-0000-4000-8000-000000003304'
  and event_type = 'NEW_MESSAGE'),1::bigint,'five unread messages produce one chat push');
select is((select count(*) from public.notification_events where event_type = 'MESSAGE_RECEIVED'
  and profile_id = '10000000-0000-4000-8000-000000003304'),0::bigint,'no duplicate MESSAGE_RECEIVED row is written');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003301',true);
select lives_ok($$select public.send_conversation_message((select id from public.conversations where foster_request_id = (select id from ids where name='reqC')),'more ' || n,gen_random_uuid())
  from generate_series(1,25) n$$,'up to 30 messages a minute are accepted');
select throws_ok($$select public.send_conversation_message((select id from public.conversations where foster_request_id = (select id from ids where name='reqC')),'one too many',gen_random_uuid())$$,
  'P0001','You are sending messages too quickly. Wait a minute and try again.','the 31st message in a minute is refused');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003303',true);
select throws_ok($$select public.send_conversation_message((select id from public.conversations where foster_request_id = (select id from ids where name='reqC')),'hi',gen_random_uuid())$$,
  'P0001',null,'an outsider cannot write in someone else''s chat');

-- Self reports are refused.
select throws_ok($$insert into public.reports(reporter_id,reported_profile_id,category,details)
  values('10000000-0000-4000-8000-000000003304','10000000-0000-4000-8000-000000003304','SPAM','me')$$,
  'P0001','You cannot report yourself','a user cannot report themselves');

select * from finish();
rollback;
