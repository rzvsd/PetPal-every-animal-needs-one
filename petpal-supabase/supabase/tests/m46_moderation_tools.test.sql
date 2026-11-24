begin;
select no_plan();

-- Moderation tools (0046). Fixtures as postgres; client actions as the real
-- authenticated role; everything rolls back.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000004601','m46owner@example.test'),
  ('10000000-0000-4000-8000-000000004602','m46foster@example.test'),
  ('10000000-0000-4000-8000-000000004603','m46stranger@example.test'),
  ('10000000-0000-4000-8000-000000004604','m46mod@example.test');
insert into public.profiles(id,display_name,city) values
  ('10000000-0000-4000-8000-000000004601','M46 Owner','Iasi'),
  ('10000000-0000-4000-8000-000000004602','M46 Foster','Iasi'),
  ('10000000-0000-4000-8000-000000004603','M46 Stranger','Iasi'),
  ('10000000-0000-4000-8000-000000004604','M46 Moderator','Iasi');
insert into public.admin_roles(profile_id,role) values('10000000-0000-4000-8000-000000004604','MODERATOR');

set local role authenticated;
create temp table ids(name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004601',true);
insert into ids values('case',public.save_foster_case(null,null,
  '{"name":"Bobo","species":"DOG","description":"Calm senior dog.","city":"Iasi"}'));
insert into ids values('case2',public.save_foster_case(null,null,
  '{"name":"Tara","species":"DOG","description":"Young and loud.","city":"Iasi"}'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004602',true);
insert into ids values('home',public.save_foster_home(null,'{"name":"Garden Home","city":"Iasi","published":true,"capacity":2}'));
insert into ids values('req',public.create_foster_request(null,(select id from ids where name='case'),(select id from ids where name='home'),'APPLICATION','I can help'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004601',true);
select public.respond_foster_request((select id from ids where name='req'),'ACCEPT',
  (select updated_at from public.foster_requests where id = (select id from ids where name='req')));

reset role;
with r as (
  insert into public.foster_home_reviews(foster_home_profile_id,foster_case_id,placement_id,reviewer_id,rating,comment)
  values((select id from ids where name='home'),(select id from ids where name='case'),
    (select id from public.foster_placements where request_id = (select id from ids where name='req')),
    '10000000-0000-4000-8000-000000004601',1,'Rude and wants money') returning id)
insert into ids select 'review', id from r;
set local role authenticated;

-- A regular member cannot moderate.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004603',true);
select throws_ok($$select public.moderate_platform('REVIEW',(select id from ids where name='review'),'HIDE',null,'x')$$,
  'P0001','Platform moderator required','only moderators can hide a review');
select is((select count(*) from public.foster_reviews_view where home_id = (select id from ids where name='home')),1::bigint,
  'the review is public before moderation');

-- Hide one review.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004604',true);
select lives_ok($$select public.moderate_platform('REVIEW',(select id from ids where name='review'),'HIDE',null,'Abusive review')$$,
  'a moderator hides a review');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004603',true);
select is((select count(*) from public.foster_reviews_view where home_id = (select id from ids where name='home')),0::bigint,
  'a hidden review is no longer shown');
select is((select review_count from public.foster_homes_directory where id = (select id from ids where name='home')),0,
  'a hidden review no longer counts');

-- Hide the home.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004604',true);
select lives_ok($$select public.moderate_platform('HOME',(select id from ids where name='home'),'HIDE',
  (select updated_at from public.platform_homes_view where id = (select id from ids where name='home')),'Sale offers')$$,
  'a moderator hides a home');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004603',true);
select is((select count(*) from public.foster_homes_directory where id = (select id from ids where name='home')),0::bigint,
  'a hidden home leaves the directory');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004602',true);
select is((select moderation_hidden from public.foster_homes_directory where id = (select id from ids where name='home')),true,
  'the home''s owner still sees it, marked hidden');
select throws_ok($$select public.create_foster_request(null,(select id from ids where name='case2'),(select id from ids where name='home'),'APPLICATION','Again')$$,
  'P0001','This foster home is hidden by PetPal moderation. Contact support.','a hidden home cannot apply');

-- Suspensions: 7 days, then until restored, then restored.
select is(public.my_suspension(),null::jsonb,'an active account has no suspension');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004604',true);
select lives_ok($$select public.moderate_platform('ACCOUNT','10000000-0000-4000-8000-000000004602','SUSPEND_7',
  (select updated_at from public.platform_accounts_view where id = '10000000-0000-4000-8000-000000004602'),'Repeated sale offers')$$,
  'a moderator suspends for 7 days');
select ok((select suspended_until between now() + interval '6 days 23 hours' and now() + interval '7 days 1 minute'
  from public.platform_accounts_view where id = '10000000-0000-4000-8000-000000004602'),'the suspension ends in 7 days');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004602',true);
select ok((public.my_suspension()->>'endsAt')::timestamptz > now() + interval '6 days','the person sees when it ends');
select ok(not public.my_suspension() ? 'reason','the moderator''s note is not shown to the person');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004604',true);
select lives_ok($$select public.moderate_platform('ACCOUNT','10000000-0000-4000-8000-000000004602','SUSPEND',
  (select updated_at from public.platform_accounts_view where id = '10000000-0000-4000-8000-000000004602'),'Escalated')$$,
  'a moderator makes it open-ended');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004602',true);
select ok(public.my_suspension() is not null and public.my_suspension()->'endsAt' = 'null'::jsonb,'an open-ended suspension has no end date');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004604',true);
select lives_ok($$select public.moderate_platform('ACCOUNT','10000000-0000-4000-8000-000000004602','RESTORE',
  (select updated_at from public.platform_accounts_view where id = '10000000-0000-4000-8000-000000004602'),'Appeal accepted')$$,
  'a moderator restores the account');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004602',true);
select is(public.my_suspension(),null::jsonb,'a restored account is active again');

reset role;
select ok(not exists(select 1 from public.notification_events where profile_id = '10000000-0000-4000-8000-000000004602'
  and event_type = 'MODERATION_DECISION' and payload ? 'reason'),'suspension pushes do not carry the moderator''s note');

select * from finish();
rollback;
