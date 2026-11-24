begin;
select no_plan();

-- Request limit per animal (0048): at most 10 open requests per animal.
insert into auth.users(id,email)
  select ('10000000-0000-4000-8000-0000000048' || lpad(n::text,2,'0'))::uuid, 'm48user' || n || '@example.test' from generate_series(0,11) n;
insert into public.profiles(id,display_name,city)
  select ('10000000-0000-4000-8000-0000000048' || lpad(n::text,2,'0'))::uuid, 'M48 User ' || n, 'Sibiu' from generate_series(0,11) n;

set local role authenticated;
create temp table ids(name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004800',true);
insert into ids values('case',public.save_foster_case(null,null,
  '{"name":"Luna","species":"CAT","description":"Very popular kitten.","city":"Sibiu"}'));

-- Homes 1..10 apply; home 11 is one too many.
do $$
declare n integer; home uuid;
begin
  for n in 1..11 loop
    perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-0000000048' || lpad(n::text,2,'0'),true);
    home := public.save_foster_home(null,jsonb_build_object('name','Home ' || n,'city','Sibiu','published',true,'capacity',2));
    insert into ids values('home' || n, home);
    if n <= 10 then
      insert into ids values('req' || n, public.create_foster_request(null,(select id from ids where name='case'),home,'APPLICATION','Hello'));
    end if;
  end loop;
end $$;

select is((select count(*) from public.foster_requests where case_id = (select id from ids where name='case') and status = 'PENDING'),
  10::bigint,'ten homes can apply');
select throws_ok($$select public.create_foster_request(null,(select id from ids where name='case'),(select id from ids where name='home11'),'APPLICATION','Me too')$$,
  'P0001','This animal already has 10 open offers. Try another animal, or try again after the owner answers.','the eleventh open request is refused');

-- The owner declines one; a place opens.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004800',true);
select public.respond_foster_request((select id from ids where name='req1'),'DECLINE',
  (select updated_at from public.foster_requests where id = (select id from ids where name='req1')));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004811',true);
select lives_ok($$select public.create_foster_request(null,(select id from ids where name='case'),(select id from ids where name='home11'),'APPLICATION','Me too')$$,
  'answering one request frees a place');

select * from finish();
rollback;
