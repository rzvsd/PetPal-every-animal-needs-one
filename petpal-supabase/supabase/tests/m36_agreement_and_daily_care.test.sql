begin;
select no_plan();

-- Agreement details and daily care (0036). Fixtures as postgres; client
-- actions as the authenticated role; everything rolls back.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000003601','m36owner@example.test'),
  ('10000000-0000-4000-8000-000000003602','m36foster@example.test'),
  ('10000000-0000-4000-8000-000000003603','m36other@example.test');
insert into public.profiles(id,display_name,city) values
  ('10000000-0000-4000-8000-000000003601','M36 Owner','Bucharest'),
  ('10000000-0000-4000-8000-000000003602','M36 Foster','Bucharest'),
  ('10000000-0000-4000-8000-000000003603','M36 Other','Bucharest');

create temp table ids(name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
create function pg_temp.stamp(placement uuid) returns timestamptz language sql security definer as
  $$ select updated_at from public.foster_placements where id = placement $$;
create function pg_temp.req_stamp(request uuid) returns timestamptz language sql security definer as
  $$ select updated_at from public.foster_requests where id = request $$;
grant execute on function pg_temp.stamp(uuid), pg_temp.req_stamp(uuid) to authenticated;
set local role authenticated;

-- The owner posts Bobi and answers the five questions.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003601',true);
insert into ids values('case',public.save_foster_case(null,null,'{"name":"Bobi","species":"DOG","description":"Calm dog.","city":"Bucharest","ageMonths":36,"size":"LARGE"}'));
insert into ids select 'animal',animal_id from public.foster_cases_directory where id = (select id from ids where name='case');
select is(public.save_animal_care_traits((select id from ids where name='animal'),'{"bites":"NO","children":"YES","vaccinated":"UNKNOWN","colour":"brown","animals":"MAYBE"}'),
  '{"bites":"NO","children":"YES","vaccinated":"UNKNOWN"}'::jsonb,'only known questions and answers are kept');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003603',true);
select throws_ok($$select public.save_animal_care_traits((select id from ids where name='animal'),'{"bites":"YES"}')$$,
  'P0001','Only the person who posted this animal can change it','a stranger cannot change the answers');
select is((select care_traits->>'children' from public.foster_cases_directory where id = (select id from ids where name='case')),'YES',
  'a foster sees the answers before offering');

-- The foster offers a home; the owner sees who runs it.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003602',true);
insert into ids values('home',public.save_foster_home(null,'{"name":"Foster Home","city":"Bucharest","published":true,"capacity":2}'));
insert into ids values('req',public.create_foster_request(null,(select id from ids where name='case'),(select id from ids where name='home'),'APPLICATION','I can take Bobi'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003601',true);
select is((select owner_name from public.foster_homes_directory where id = (select id from ids where name='home')),'M36 Foster','the home shows its owner''s name');
select ok((select owner_since is not null from public.foster_homes_directory where id = (select id from ids where name='home')),'and since when they are a member');

-- Accepted and arrived: the answers stay on the placement.
insert into ids values('p',public.respond_foster_request((select id from ids where name='req'),'ACCEPT',pg_temp.req_stamp((select id from ids where name='req'))));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003602',true);
select public.update_foster_placement((select id from ids where name='p'),'RECEIVE',jsonb_build_object('expectedUpdatedAt',pg_temp.stamp((select id from ids where name='p'))));
select is((select care_traits->>'bites' from public.foster_registry_view where id = (select id from ids where name='p')),'NO','the foster still sees the answers in care');
select is((select size_label from public.foster_registry_view where id = (select id from ids where name='p')),'LARGE','and the size');

-- A diary note with a photo from my own folder only.
select lives_ok($$select public.add_foster_note((select id from ids where name='p'),'Bobi at the park','10000000-0000-4000-8000-000000003602/x/park.jpg')$$,'a note can carry a photo');
select is((select photo_path from public.foster_journal_view where placement_id = (select id from ids where name='p') and event = 'NOTE'),
  '10000000-0000-4000-8000-000000003602/x/park.jpg','the photo is on the note');
select throws_ok($$select public.add_foster_note((select id from ids where name='p'),'','10000000-0000-4000-8000-000000003601/x/a.jpg')$$,
  'P0001','Photo not accessible','someone else''s file is refused');

-- A daily task: ticking it creates tomorrow's, and undo removes that again.
insert into ids values('task',public.save_foster_task(null,(select id from ids where name='p'),'{"title":"Heart pill","daily":true}'));
select ok((select repeat_daily and due_at is not null from public.foster_tasks where id = (select id from ids where name='task')),'a daily task gets a time');
select public.save_foster_task((select id from ids where name='task'),(select id from ids where name='p'),'{"completed":true}');
select is((select count(*) from public.foster_tasks where repeat_of = (select id from ids where name='task') and completed_at is null),1::bigint,'tomorrow''s task is ready');
select ok((select t.due_at > now() from public.foster_tasks t where repeat_of = (select id from ids where name='task')),'and due in the future');
select public.save_foster_task((select id from ids where name='task'),(select id from ids where name='p'),'{"completed":false}');
select ok((select completed_at is null from public.foster_tasks where id = (select id from ids where name='task')),'a tick can be undone');
select is((select count(*) from public.foster_tasks where repeat_of = (select id from ids where name='task')),0::bigint,'and the next one goes away');

-- The offer can be withdrawn by whoever sent it.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003601',true);
insert into ids values('case2',public.save_foster_case(null,null,'{"name":"Tom","species":"CAT","description":"Shy cat.","city":"Bucharest"}'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003602',true);
insert into ids values('req2',public.create_foster_request(null,(select id from ids where name='case2'),(select id from ids where name='home'),'APPLICATION','Me'));
select lives_ok($$select public.respond_foster_request((select id from ids where name='req2'),'WITHDRAW',pg_temp.req_stamp((select id from ids where name='req2')))$$,'I can withdraw my offer');

-- Morning reminder: only the scheduler runs it, and the foster gets one.
reset role;
update public.foster_tasks set due_at = now() where id = (select id from ids where name='task');
select is(public.send_task_reminders(),1,'one reminder for the one carer');
select ok(exists(select 1 from public.notification_events where profile_id = '10000000-0000-4000-8000-000000003602'
  and event_type = 'FOSTER_TASKS_TODAY' and body like '1 sarcină azi pentru Bobi%'),'the reminder names the animal');
select ok(not has_function_privilege('authenticated','public.send_task_reminders()','execute'),'only the scheduler can send reminders');

select * from finish();
rollback;
