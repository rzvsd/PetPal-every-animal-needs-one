begin;
select no_plan();

-- Reports with context (0045). Fixtures as postgres; client actions as the
-- real authenticated role; everything rolls back.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000004501','m45owner@example.test'),
  ('10000000-0000-4000-8000-000000004502','m45foster@example.test');
insert into public.profiles(id,display_name,city) values
  ('10000000-0000-4000-8000-000000004501','M45 Owner','Cluj'),
  ('10000000-0000-4000-8000-000000004502','M45 Foster','Cluj');

set local role authenticated;
create temp table ids(name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004501',true);
insert into ids values('case',public.save_foster_case(null,null,
  '{"name":"Miri","species":"CAT","description":"Needs a quiet home.","city":"Cluj"}'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004502',true);
insert into ids values('home',public.save_foster_home(null,'{"name":"Quiet Home","city":"Cluj","published":true,"capacity":2}'));
insert into ids values('req',public.create_foster_request(null,(select id from ids where name='case'),(select id from ids where name='home'),'APPLICATION','I can help'));
insert into ids values('conv',(select id from public.conversations where foster_request_id = (select id from ids where name='req')));

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004501',true);
select public.send_conversation_message((select id from ids where name='conv'),'owner says ' || n,gen_random_uuid()) from generate_series(1,7) n;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004502',true);
select public.send_conversation_message((select id from ids where name='conv'),'foster says ' || n,gen_random_uuid()) from generate_series(1,5) n;

select throws_ok($$select public.report_conversation((select id from ids where name='conv'),'WHATEVER','x')$$,
  'P0001','Choose why you are reporting','an unknown report reason is refused');

insert into ids values('report',public.report_conversation((select id from ids where name='conv'),'abuse','They asked me for money.'));
select ok((select reported_by_me from public.my_conversations_view where conversation_id = (select id from ids where name='conv')),
  'the chat shows as reported by me');

reset role;
select is((select conversation_id from public.reports where id = (select id from ids where name='report')),
  (select id from ids where name='conv'),'the report records its conversation');
select is((select details from public.reports where id = (select id from ids where name='report')),
  'They asked me for money.','details hold only what the reporter wrote');
select is((select category from public.reports where id = (select id from ids where name='report')),'ABUSE','the chosen reason is kept');
select is((select reported_profile_id from public.reports where id = (select id from ids where name='report')),
  '10000000-0000-4000-8000-000000004501'::uuid,'the other person is the reported account');
select is((select jsonb_array_length(context->'messages') from public.reports where id = (select id from ids where name='report')),
  10,'the last 10 messages are attached');
select is((select context->'messages'->0->>'body' from public.reports where id = (select id from ids where name='report')),
  'owner says 3','messages are oldest first');
select is((select context->'messages'->9->>'from' from public.reports where id = (select id from ids where name='report')),
  'M45 Foster','messages carry names, not ids');
select is((select (context->'messages'->9->>'reporter')::boolean from public.reports where id = (select id from ids where name='report')),
  true,'the reporter''s own messages are marked');
select is((select context->>'animal' from public.reports where id = (select id from ids where name='report')),
  'Miri','the animal is named');

-- A direct insert cannot plant its own context.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004502',true);
insert into public.reports(reporter_id,reported_profile_id,category,details,context,conversation_id)
  values('10000000-0000-4000-8000-000000004502','10000000-0000-4000-8000-000000004501','SPAM','direct',
    '{"messages":[{"body":"fake"}]}',(select id from ids where name='conv'));
reset role;
select ok((select context is null and conversation_id is null from public.reports where details = 'direct'),
  'context and conversation are only set by PetPal');

select * from finish();
rollback;
