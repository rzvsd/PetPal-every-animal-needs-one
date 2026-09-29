begin;
select no_plan();

-- Attacker-view checks for 0025. Assertions run as the real client roles;
-- fixtures are created as postgres and everything rolls back.
insert into public.owner_animal_profiles(id,owner_id,name,species,photo_urls,profile_completeness,active_match_modes)
values
  ('53000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','M25 A','DOG',array['https://example.test/a.jpg'],100,array['PLAY']),
  ('53000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000005','M25 B','DOG',array['https://example.test/b.jpg'],100,array['PLAY']);
insert into storage.objects(bucket_id,name,owner)
values ('animal-photos','10000000-0000-4000-8000-000000000004/53000000-0000-4000-8000-000000000001/m25.jpg',
  '10000000-0000-4000-8000-000000000004');
create temp table m25_chat(conversation_id uuid);
grant all on m25_chat to authenticated;

-- Push notifications cannot be queued by clients. Checked via privileges: in the
-- local image a function ACL error after `set role` in a superuser session
-- crashes the backend (the REST API path returns a clean 42501).
select ok(not has_function_privilege('anon','public.enqueue_push_notification(uuid,text,jsonb,text,text)','execute'),
  'anon cannot queue push notifications');
select ok(not has_function_privilege('authenticated','public.enqueue_push_notification(uuid,text,jsonb,text,text)','execute'),
  'signed-in users cannot queue push notifications for others');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);

-- Roles cannot be self-granted.
select throws_ok($$insert into public.profile_roles(profile_id,role)
  values('10000000-0000-4000-8000-000000000002','RESCUER')$$,'42501',null,'users cannot insert privileged roles');
select lives_ok($$select public.complete_profile_onboarding('Demo Adopter','Bucharest','Sector 1',
  array['ADOPTER','RESCUER','SHELTER_MEMBER']::public.user_role[])$$,'onboarding accepts a mixed role list');
select is((select array_agg(role::text order by role::text) from public.profile_roles
  where profile_id='10000000-0000-4000-8000-000000000002'),array['ADOPTER'],
  'onboarding keeps only self-service roles');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.complete_profile_onboarding('PetPal Rescue Demo','Bucharest','Sector 2',
  array['ADOPTER']::public.user_role[])$$,'approved rescuer can edit their profile');
select ok((select bool_and(role::text in ('ADOPTER','RESCUER','SHELTER_MEMBER')) and count(*) filter (where role='RESCUER') = 1
  from public.profile_roles where profile_id='10000000-0000-4000-8000-000000000001'),
  'profile edits keep admin-approved roles');

-- Trust fields cannot be self-set.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select throws_ok($$update public.profiles set verification_status='VERIFIED'
  where id='10000000-0000-4000-8000-000000000002'$$,'P0001',
  'Verification fields are managed by PetPal moderators','users cannot verify themselves');
select throws_ok($$update public.profiles set age_confirmed=false
  where id='10000000-0000-4000-8000-000000000002'$$,'P0001',
  'Verification fields are managed by PetPal moderators','users cannot rewrite their age confirmation');
select lives_ok($$update public.profiles set display_name='Demo Adopter Renamed'
  where id='10000000-0000-4000-8000-000000000002'$$,'users can still edit ordinary profile fields');
select throws_ok($$insert into public.organizations(name,city,created_by,verification_status)
  values('Fake Shelter','Bucharest','10000000-0000-4000-8000-000000000002','VERIFIED')$$,'P0001',
  'Verification fields are managed by PetPal moderators','new organizations cannot start verified');
select lives_ok($$insert into public.organizations(id,name,city,created_by)
  values('20000000-0000-4000-8000-000000000025','M25 Rescue','Bucharest','10000000-0000-4000-8000-000000000002')$$,
  'users can still create a pending organization');
select ok(public.is_org_member('20000000-0000-4000-8000-000000000025'),'fixture: creator is an organization member');
select throws_ok($$update public.organizations set verification_status='VERIFIED'
  where id='20000000-0000-4000-8000-000000000025'$$,'P0001',
  'Verification fields are managed by PetPal moderators','organization members cannot verify their organization');

-- The legacy foster-home view is gone.
select throws_ok($$select * from public.foster_home_profiles_view$$,'42P01',null,
  'legacy foster-home view is no longer queryable');

-- Block status is only answered for the people involved.
select throws_ok($$select public.is_profile_blocked_between('10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005')$$,'P0001','Block status is only available to the people involved',
  'users cannot probe blocks between other people');
select is(public.is_profile_blocked_between('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004'),false,'users can check their own block status');

-- Suspended users cannot keep messaging; participants still read their chat.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select is((select matched from public.like_match_candidate('53000000-0000-4000-8000-000000000001',
  '53000000-0000-4000-8000-000000000002','PLAY')),false,'fixture: first like');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
insert into m25_chat select conversation_id from public.like_match_candidate('53000000-0000-4000-8000-000000000002',
  '53000000-0000-4000-8000-000000000001','PLAY');
select lives_ok($$select public.send_conversation_message(conversation_id,'Hello from B') from m25_chat$$,
  'fixture: matched owner can message');
select is((select count(*)::integer from public.messages where conversation_id=(select conversation_id from m25_chat)),1,
  'participants can still read messages through the block-aware policy');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.is_conversation_blocked(conversation_id,'10000000-0000-4000-8000-000000000005') from m25_chat$$,
  'P0001','Block status is only available to the people involved','users cannot probe other conversations');
select is((select count(*)::integer from public.messages where conversation_id=(select conversation_id from m25_chat)),0,
  'non-participants cannot read the conversation');
set local role postgres;
insert into public.user_suspensions(profile_id,suspended_by,reason,starts_at)
values('10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','M25 test',now() - interval '1 minute');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
select throws_ok($$select public.send_conversation_message(conversation_id,'Still here') from m25_chat$$,
  'P0001',null,'suspended users cannot send messages');

-- Reports always start open and are rate limited.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
insert into public.reports(reporter_id,reported_profile_id,category,details,status,resolved_at)
values('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','OTHER','M25','RESOLVED',now());
select is((select status from public.reports where reporter_id='10000000-0000-4000-8000-000000000002' and details='M25'),'OPEN',
  'reporters cannot choose a report status');
select lives_ok($$insert into public.reports(reporter_id,reported_profile_id,category,details)
  select '10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','OTHER','M25 bulk'
  from generate_series(1,20 - (select count(*)::integer from public.reports
    where reporter_id='10000000-0000-4000-8000-000000000002' and created_at > now() - interval '1 day'))$$,
  'twenty reports per day are allowed');
select throws_ok($$insert into public.reports(reporter_id,reported_profile_id,category,details)
  values('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','OTHER','M25 over limit')$$,
  'P0001','Report limit reached. Please try again later.','the twenty-first report in a day is rejected');

-- Photo objects cannot be listed by other people.
select is((select count(*)::integer from storage.objects where bucket_id='animal-photos'),0,
  'other users cannot list animal photos');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select is((select count(*)::integer from storage.objects where bucket_id='animal-photos'),1,
  'owners can list their own animal photos');
set local role anon;
select is((select count(*)::integer from storage.objects where bucket_id='animal-photos'),0,
  'anonymous visitors cannot list animal photos');

set local role postgres;
select * from finish();
rollback;
