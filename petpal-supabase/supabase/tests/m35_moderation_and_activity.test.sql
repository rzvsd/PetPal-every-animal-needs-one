begin;
select no_plan();

-- Moderation and activity (0035). Fixtures as postgres; client actions as the
-- authenticated role; everything rolls back.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000003501','m35mod@example.test'),
  ('10000000-0000-4000-8000-000000003502','m35user@example.test'),
  ('10000000-0000-4000-8000-000000003503','m35other@example.test');
insert into public.profiles(id,display_name,city) values
  ('10000000-0000-4000-8000-000000003501','M35 Moderator','Bucharest'),
  ('10000000-0000-4000-8000-000000003502','M35 User','Bucharest'),
  ('10000000-0000-4000-8000-000000003503','M35 Other','Bucharest');
insert into public.admin_roles(profile_id,role) values('10000000-0000-4000-8000-000000003501','MODERATOR');

create temp table ids(name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
create function pg_temp.report_stamp(report uuid) returns timestamptz language sql security definer as
  $$ select updated_at from public.reports where id = report $$;
grant execute on function pg_temp.report_stamp(uuid) to authenticated;

-- A user reports an animal in danger: every moderator gets an alert that always sends.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003502',true);
insert into public.reports(reporter_id,reported_profile_id,category,details)
  values('10000000-0000-4000-8000-000000003502','10000000-0000-4000-8000-000000003503','SPAM','spam text');
insert into public.reports(reporter_id,reported_profile_id,category,details)
  values('10000000-0000-4000-8000-000000003502','10000000-0000-4000-8000-000000003503','ANIMAL_DANGER','The dog is left outside without water');
reset role;
select ok(exists(select 1 from public.notification_events where profile_id = '10000000-0000-4000-8000-000000003501'
  and event_type = 'ADMIN_ALERT' and title = 'Animal in danger reported' and delivery_status = 'QUEUED'),'moderators are alerted at once');

-- The queue puts animal in danger first and shows names.
insert into public.reports(reporter_id,reported_profile_id,category,details)
  values(null,'10000000-0000-4000-8000-000000003503','BLOCK_DURING_PLACEMENT','Automatic flag: test');
insert into ids select 'auto',id from public.reports where category = 'BLOCK_DURING_PLACEMENT' and details = 'Automatic flag: test';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003501',true);
select is((select category from public.platform_reports_view where status = 'OPEN' and (reported_profile_id = '10000000-0000-4000-8000-000000003503')
  order by priority,created_at limit 1),'ANIMAL_DANGER','animal in danger is sorted first');
select is((select reporter_name from public.platform_reports_view where id = (select id from ids where name='auto')),'Automatic flag','automatic flags are labelled');
select is((select reported_name from public.platform_reports_view where id = (select id from ids where name='auto')),'M35 Other','names, not ids');

-- An automatic flag (no reporter) can be closed.
select lives_ok($$select public.moderate_platform('REPORT',(select id from ids where name='auto'),'RESOLVED',
  pg_temp.report_stamp((select id from ids where name='auto')),'Checked with both sides')$$,'an automatic flag can be closed');

-- Closing a user report tells the reporter without the internal note.
insert into ids select 'spam',id from public.platform_reports_view where category = 'SPAM' and reporter_id = '10000000-0000-4000-8000-000000003502';
select public.moderate_platform('REPORT',(select id from ids where name='spam'),'DISMISSED',pg_temp.report_stamp((select id from ids where name='spam')),'INTERNAL: repeat reporter');
reset role;
select ok(not exists(select 1 from public.notification_events where profile_id = '10000000-0000-4000-8000-000000003502'
  and (payload::text like '%INTERNAL%' or body like '%INTERNAL%')),'the internal note never reaches the reporter');
select ok(exists(select 1 from public.notification_events where profile_id = '10000000-0000-4000-8000-000000003502'
  and event_type = 'MODERATION_DECISION'),'the reporter is told the report was reviewed');

-- The activity list shows my notifications except chat messages, and can be marked read.
select public.enqueue_push_notification('10000000-0000-4000-8000-000000003502','NEW_MESSAGE','{}','m','m');
select public.enqueue_push_notification('10000000-0000-4000-8000-000000003502','FOSTER_UPDATE','{}','Foster update','Pufi found a home');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003502',true);
select is((select count(*) from public.my_activity_view where event_type = 'NEW_MESSAGE'),0::bigint,'chat messages stay out of the activity list');
select is((select count(*) from public.my_activity_view where read_at is null),2::bigint,'my unread activity is listed');
select is(public.mark_activity_read(),2,'marking read clears it');
select is((select count(*) from public.my_activity_view where read_at is null),0::bigint,'nothing unread is left');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003503',true);
select is((select count(*) from public.my_activity_view),0::bigint,'I never see someone else''s activity');

-- The scheduled check flags a reservation never received after 7 days.
reset role;
select is(public.flag_stale_placements(),0,'nothing stale yet');
select ok(not has_function_privilege('authenticated','public.flag_stale_placements()','execute'),'only the scheduler can run the check');

select * from finish();
rollback;
