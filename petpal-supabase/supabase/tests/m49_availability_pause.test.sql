begin;
select no_plan();

-- Availability pause (0049): a paused home cannot be invited, but can still apply.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000004901','m49owner@example.test'),
  ('10000000-0000-4000-8000-000000004902','m49home@example.test');
insert into public.profiles(id,display_name,city) values
  ('10000000-0000-4000-8000-000000004901','M49 Owner','Oradea'),
  ('10000000-0000-4000-8000-000000004902','M49 Home','Oradea');

set local role authenticated;
create temp table ids(name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004901',true);
insert into ids values('case',public.save_foster_case(null,null,
  '{"name":"Max","species":"DOG","description":"Needs two weeks of care.","city":"Oradea"}'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004902',true);
insert into ids values('home',public.save_foster_home(null,
  '{"name":"Paused Home","city":"Oradea","published":true,"capacity":2,"availability":"UNAVAILABLE"}'));

reset role;
select is((select availability_status from public.foster_home_profiles where id = (select id from ids where name='home')),'UNAVAILABLE',
  'the home is paused');
set local role authenticated;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004901',true);
select throws_ok($$select public.create_foster_request(null,(select id from ids where name='case'),(select id from ids where name='home'),'INVITE','Can you take Max?')$$,
  'P0001','This home is not taking animals right now.','a paused home cannot be invited');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004902',true);
select lives_ok($$select public.create_foster_request(null,(select id from ids where name='case'),(select id from ids where name='home'),'APPLICATION','I can still help')$$,
  'a paused home can still apply on purpose');

select * from finish();
rollback;
