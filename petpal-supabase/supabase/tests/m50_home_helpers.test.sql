begin;
select no_plan();

-- Home helpers (0050). Fixtures as postgres; client actions as the real
-- authenticated role; everything rolls back.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000005001','m50owner@example.test'),
  ('10000000-0000-4000-8000-000000005002','m50foster@example.test'),
  ('10000000-0000-4000-8000-000000005003','m50helper@example.test'),
  ('10000000-0000-4000-8000-000000005004','m50reader@example.test');
insert into public.profiles(id,display_name,city) values
  ('10000000-0000-4000-8000-000000005001','M50 Owner','Brasov'),
  ('10000000-0000-4000-8000-000000005002','M50 Foster','Brasov'),
  ('10000000-0000-4000-8000-000000005003','M50 Helper','Brasov'),
  ('10000000-0000-4000-8000-000000005004','M50 Reader','Brasov');

set local role authenticated;
create temp table ids(name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000005001',true);
insert into ids values('case',public.save_foster_case(null,null,
  '{"name":"Luna","species":"CAT","description":"Shy but sweet.","city":"Brasov"}'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000005002',true);
insert into ids values('home',public.save_foster_home(null,'{"name":"Team Home","city":"Brasov","published":true,"capacity":3}'));

reset role;
insert into public.foster_home_members(home_id,profile_id,role,status,invited_by) values
  ((select id from ids where name='home'),'10000000-0000-4000-8000-000000005003','CARER','ACTIVE','10000000-0000-4000-8000-000000005002'),
  ((select id from ids where name='home'),'10000000-0000-4000-8000-000000005004','READER','ACTIVE','10000000-0000-4000-8000-000000005002');
set local role authenticated;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000005002',true);
insert into ids values('req',public.create_foster_request(null,(select id from ids where name='case'),(select id from ids where name='home'),'APPLICATION','We can take her'));
insert into ids values('conv',(select id from public.conversations where foster_request_id = (select id from ids where name='req')));

reset role;
select ok(not exists(select 1 from public.conversation_participants where conversation_id = (select id from ids where name='conv')
  and profile_id = '10000000-0000-4000-8000-000000005003'),'helpers do not join an offer that is not agreed yet');
set local role authenticated;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000005001',true);
select public.respond_foster_request((select id from ids where name='req'),'ACCEPT',
  (select updated_at from public.foster_requests where id = (select id from ids where name='req')));

reset role;
select ok(exists(select 1 from public.conversation_participants where conversation_id = (select id from ids where name='conv')
  and profile_id = '10000000-0000-4000-8000-000000005003'),'a helper who helps with care joins the chat once the animal is agreed');
select ok(not exists(select 1 from public.conversation_participants where conversation_id = (select id from ids where name='conv')
  and profile_id = '10000000-0000-4000-8000-000000005004'),'a view-only helper does not join the chat');
select ok(exists(select 1 from public.notification_events where profile_id = '10000000-0000-4000-8000-000000005003'
  and event_type = 'FOSTER_UPDATE'),'the helper is told the animal was agreed');
select ok(not exists(select 1 from public.notification_events where profile_id = '10000000-0000-4000-8000-000000005004'
  and event_type = 'FOSTER_UPDATE'),'a view-only helper gets no foster pushes');
set local role authenticated;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000005003',true);
select lives_ok($$select public.send_conversation_message((select id from ids where name='conv'),'Hi, I will feed Luna in the mornings',gen_random_uuid())$$,
  'the helper can write in the chat');
insert into ids values('report',public.report_conversation((select id from ids where name='conv'),'OTHER','test'));
reset role;
select is((select reported_profile_id from public.reports where id = (select id from ids where name='report')),
  '10000000-0000-4000-8000-000000005001'::uuid,'a helper''s report names the animal''s side, not the home owner');
set local role authenticated;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000005001',true);
insert into ids values('report2',public.report_conversation((select id from ids where name='conv'),'OTHER','test'));
reset role;
select is((select reported_profile_id from public.reports where id = (select id from ids where name='report2')),
  '10000000-0000-4000-8000-000000005002'::uuid,'the animal''s side reports the home owner, not a helper');
set local role authenticated;

-- Leaving.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000005003',true);
select throws_ok($$select public.manage_foster_member((select id from ids where name='home'),'10000000-0000-4000-8000-000000005004','LEAVE')$$,
  'P0001','Only the helper can leave','nobody can make someone else leave');
select lives_ok($$select public.manage_foster_member((select id from ids where name='home'),'10000000-0000-4000-8000-000000005003','LEAVE')$$,
  'a helper can leave a home');
select throws_ok($$select public.send_conversation_message((select id from ids where name='conv'),'still here?',gen_random_uuid())$$,
  'P0001','Conversation not found or not accessible','a helper who left can no longer write');
reset role;
select ok(not exists(select 1 from public.conversation_participants where conversation_id = (select id from ids where name='conv')
  and profile_id = '10000000-0000-4000-8000-000000005003'),'a helper who left leaves the chat');
select ok(exists(select 1 from public.conversation_participants where conversation_id = (select id from ids where name='conv')
  and profile_id = '10000000-0000-4000-8000-000000005002'),'the home owner stays in the chat');
select is((select status from public.foster_home_members where profile_id = '10000000-0000-4000-8000-000000005003'),'REVOKED',
  'leaving ends the membership');

-- Joining again later brings the helper back into agreed chats.
update public.foster_home_members set status = 'ACTIVE' where profile_id = '10000000-0000-4000-8000-000000005003';
select ok(exists(select 1 from public.conversation_participants where conversation_id = (select id from ids where name='conv')
  and profile_id = '10000000-0000-4000-8000-000000005003'),'a helper who comes back rejoins agreed chats');

select * from finish();
rollback;
