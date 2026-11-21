begin;
select no_plan();

-- Review follow-ups (0038). Fixtures as postgres; client actions as the
-- authenticated role; everything rolls back.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000003801','m38owner@example.test'),
  ('10000000-0000-4000-8000-000000003802','m38foster@example.test'),
  ('10000000-0000-4000-8000-000000003803','m38helper@example.test');
insert into public.profiles(id,display_name,city) values
  ('10000000-0000-4000-8000-000000003801','M38 Owner','Bucharest'),
  ('10000000-0000-4000-8000-000000003802','M38 Foster','Bucharest'),
  ('10000000-0000-4000-8000-000000003803','M38 Helper','Bucharest');

create temp table ids(name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
create function pg_temp.stamp(placement uuid) returns timestamptz language sql security definer as
  $$ select updated_at from public.foster_placements where id = placement $$;
create function pg_temp.req_stamp(request uuid) returns timestamptz language sql security definer as
  $$ select updated_at from public.foster_requests where id = request $$;
grant execute on function pg_temp.stamp(uuid), pg_temp.req_stamp(uuid) to authenticated;
set local role authenticated;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003801',true);
insert into ids values('case',public.save_foster_case(null,null,'{"name":"Miro","species":"CAT","description":"Calm cat.","city":"Bucharest"}'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003802',true);
insert into ids values('home',public.save_foster_home(null,'{"name":"Home","city":"Bucharest","published":true,"capacity":2}'));
insert into ids values('req',public.create_foster_request(null,(select id from ids where name='case'),(select id from ids where name='home'),'APPLICATION','Me'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003801',true);
insert into ids values('p',public.respond_foster_request((select id from ids where name='req'),'ACCEPT',pg_temp.req_stamp((select id from ids where name='req'))));
select public.update_foster_placement((select id from ids where name='p'),'CONTACTS','{"emergencyPhone":"0722 111 222"}');
reset role;
insert into public.foster_home_members(home_id,profile_id,role,status,invited_by) values((select id from ids where name='home'),'10000000-0000-4000-8000-000000003803','CARER','ACTIVE','10000000-0000-4000-8000-000000003802');
set local role authenticated;

-- Phones stay with the two sides.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003802',true);
select is((select emergency_phone from public.foster_registry_view where id = (select id from ids where name='p')),'0722 111 222','the home owner sees the owner''s phone');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003803',true);
select ok((select emergency_phone is null and name = 'Miro' from public.foster_registry_view where id = (select id from ids where name='p')),'a helper sees the animal but not the phone');
select ok(not has_column_privilege('authenticated','public.foster_placements','emergency_phone','select'),'the phone cannot be read from the table directly');

-- Only the latest day of a daily task can be undone.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003802',true);
insert into ids values('task',public.save_foster_task(null,(select id from ids where name='p'),'{"title":"Pill","daily":true}'));
select public.save_foster_task((select id from ids where name='task'),(select id from ids where name='p'),'{"completed":true}');
select ok((select count(*) = 1 from public.foster_tasks where repeat_of = (select id from ids where name='task')),'a daily task ticked before arrival still repeats');
reset role;
insert into ids select 'next',id from public.foster_tasks where repeat_of = (select id from ids where name='task');
set local role authenticated;
select public.save_foster_task((select id from ids where name='next'),(select id from ids where name='p'),'{"completed":true}');
select throws_ok($$select public.save_foster_task((select id from ids where name='task'),(select id from ids where name='p'),'{"completed":false}')$$,
  'P0001','Only the latest day of a daily task can be undone','an older day cannot be reopened');
select lives_ok($$select public.save_foster_task((select id from ids where name='next'),(select id from ids where name='p'),'{"completed":false}')$$,'the latest day can');

-- A dismissed dispute flag is not raised again for the same dispute.
select public.update_foster_placement((select id from ids where name='p'),'RECEIVE',jsonb_build_object('expectedUpdatedAt',pg_temp.stamp((select id from ids where name='p'))));
select public.update_foster_placement((select id from ids where name='p'),'DISPUTE','{"body":"Food was not as agreed"}');
reset role;
update public.foster_journal set created_at = now() - interval '3 days' where placement_id = (select id from ids where name='p') and event = 'DISPUTE';
select is(public.flag_stale_placements(),1,'an old dispute is flagged');
update public.reports set status = 'DISMISSED' where category = 'DISPUTE_OPEN' and details like '%' || (select id from ids where name='p')::text || '%';
select is(public.flag_stale_placements(),0,'and not again once dismissed');

select * from finish();
rollback;
