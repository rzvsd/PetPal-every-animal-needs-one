begin;
select no_plan();

-- Pilot numbers (0047): moderators and the SQL editor can read them; members cannot.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000004701','m47member@example.test'),
  ('10000000-0000-4000-8000-000000004702','m47mod@example.test');
insert into public.profiles(id,display_name,city) values
  ('10000000-0000-4000-8000-000000004701','M47 Member','Brasov'),
  ('10000000-0000-4000-8000-000000004702','M47 Moderator','Brasov');
insert into public.admin_roles(profile_id,role) values('10000000-0000-4000-8000-000000004702','MODERATOR');

select is((select count(*) from public.pilot_numbers()),8::bigint,'the SQL editor sees eight numbers');
select ok((select total >= 2 from public.pilot_numbers() where sort_order = 1),'accounts are counted');
select ok((select last_7_days >= 2 from public.pilot_numbers() where sort_order = 1),'new accounts count in the last 7 days');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004701',true);
select set_config('request.jwt.claim.role','authenticated',true);
select throws_ok($$select * from public.pilot_numbers()$$,'P0001','Platform moderator required','a member cannot read pilot numbers');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004702',true);
select is((select metric from public.pilot_numbers() where sort_order = 8),'Danger reports answered within 2 hours','a moderator reads them');

select * from finish();
rollback;
