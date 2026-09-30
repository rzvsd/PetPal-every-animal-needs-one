begin;
select no_plan();

-- Blocked people list (0030). Fixtures as postgres; client actions as the real
-- authenticated role; everything rolls back.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000000301','m30a@example.test'),
  ('10000000-0000-4000-8000-000000000302','m30b@example.test'),
  ('10000000-0000-4000-8000-000000000303','m30c@example.test'),
  ('10000000-0000-4000-8000-000000000304','m30d@example.test');
insert into public.profiles(id,display_name,city) values
  ('10000000-0000-4000-8000-000000000301','M30 Blocker','Bucharest'),
  ('10000000-0000-4000-8000-000000000302','M30 First','Bucharest'),
  ('10000000-0000-4000-8000-000000000303','M30 Second','Bucharest'),
  ('10000000-0000-4000-8000-000000000304','M30 Other','Bucharest');
insert into public.blocks(blocker_id,blocked_id) values
  ('10000000-0000-4000-8000-000000000301','10000000-0000-4000-8000-000000000302'),
  ('10000000-0000-4000-8000-000000000301','10000000-0000-4000-8000-000000000303'),
  ('10000000-0000-4000-8000-000000000304','10000000-0000-4000-8000-000000000302');

select ok(not has_function_privilege('anon','public.my_blocked_profiles()','execute'),'anonymous visitors cannot list blocks');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000301',true);
select results_eq($$select display_name from public.my_blocked_profiles() order by display_name$$,
  $$values ('M30 First'),('M30 Second')$$,'the list shows the names of the people I blocked, and only mine');
select is((select count(*) from public.profiles where id = '10000000-0000-4000-8000-000000000302'),0::bigint,
  'the names come through the function only; profiles stay unreadable');

delete from public.blocks where blocked_id = '10000000-0000-4000-8000-000000000302';
select results_eq($$select display_name from public.my_blocked_profiles()$$,$$values ('M30 Second')$$,'unblocking removes the person from my list');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000304',true);
select results_eq($$select display_name from public.my_blocked_profiles()$$,$$values ('M30 First')$$,
  'another person still has their own block; my delete did not touch it');

select * from finish();
rollback;
