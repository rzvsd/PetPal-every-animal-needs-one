begin;
select no_plan();

-- A foster home can link its own web page (0039). Everything rolls back.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000003901','m39home@example.test'),
  ('10000000-0000-4000-8000-000000003902','m39viewer@example.test');
insert into public.profiles(id,display_name,city) values
  ('10000000-0000-4000-8000-000000003901','M39 Home','Bucharest'),
  ('10000000-0000-4000-8000-000000003902','M39 Viewer','Bucharest');
create temp table ids(name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
create function pg_temp.stamp(home uuid) returns timestamptz language sql security definer as
  $$ select updated_at from public.foster_home_profiles where id = home $$;
grant execute on function pg_temp.stamp(uuid) to authenticated;
set local role authenticated;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003901',true);
insert into ids values('home',public.save_foster_home(null,'{"name":"Casa Labute","city":"Bucharest","published":true,"capacity":2,"website":"  casalabute.ro/adoptii "}'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003902',true);
select is((select website from public.foster_homes_directory where id = (select id from ids where name='home')),
  'https://casalabute.ro/adoptii','a bare address gets https:// and others see it');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003901',true);
select throws_ok($$select public.save_foster_home((select id from ids where name='home'),
  jsonb_build_object('name','Casa Labute','city','Bucharest','website','javascript:alert(1)','expectedUpdatedAt',pg_temp.stamp((select id from ids where name='home'))))$$,
  'P0001','Website must be a web address','a script link is refused');
select throws_ok($$select public.save_foster_home((select id from ids where name='home'),
  jsonb_build_object('name','Casa Labute','city','Bucharest','website','not a site','expectedUpdatedAt',pg_temp.stamp((select id from ids where name='home'))))$$,
  'P0001','Website must be a web address','text that is not an address is refused');
select throws_ok($$select public.save_foster_home((select id from ids where name='home'),
  jsonb_build_object('name','Casa Labute','city','Bucharest','website','https://' || repeat('a',200) || '.ro','expectedUpdatedAt',pg_temp.stamp((select id from ids where name='home'))))$$,
  'P0001','Website must be a web address','a very long address is refused');

-- An edit that does not mention the website keeps it; an empty one removes it.
select lives_ok($$select public.save_foster_home((select id from ids where name='home'),
  jsonb_build_object('name','Casa Labute','city','Cluj','expectedUpdatedAt',pg_temp.stamp((select id from ids where name='home'))))$$,'edit without website');
select is((select website from public.foster_homes_directory where id = (select id from ids where name='home')),
  'https://casalabute.ro/adoptii','an older app version does not erase the link');
select lives_ok($$select public.save_foster_home((select id from ids where name='home'),
  jsonb_build_object('name','Casa Labute','city','Cluj','website','http://www.casa-labute.ro:8080/a?b=1#c','expectedUpdatedAt',pg_temp.stamp((select id from ids where name='home'))))$$,'plain http with port and query');
select is((select website from public.foster_homes_directory where id = (select id from ids where name='home')),
  'http://www.casa-labute.ro:8080/a?b=1#c','kept as typed');
select lives_ok($$select public.save_foster_home((select id from ids where name='home'),
  jsonb_build_object('name','Casa Labute','city','Cluj','website','','expectedUpdatedAt',pg_temp.stamp((select id from ids where name='home'))))$$,'clear website');
select is((select website from public.foster_homes_directory where id = (select id from ids where name='home')),null,'an empty field removes the link');

-- Nobody writes the column around the function.
select throws_ok($$update public.foster_home_profiles set website = 'javascript:x' where id = (select id from ids where name='home')$$,
  '42501',null,'clients cannot update the table directly');
reset role;
select throws_ok($$update public.foster_home_profiles set website = 'javascript:x' where id = (select id from ids where name='home')$$,
  '23514',null,'the table itself only holds web addresses');

select * from finish();
rollback;
