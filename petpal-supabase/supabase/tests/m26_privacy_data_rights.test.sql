begin;
select no_plan();

-- Consent, export and account deletion (0026). Fixtures as postgres; client
-- actions as the real authenticated role; everything rolls back.
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000026','m26@example.test');
insert into public.owner_animal_profiles(id,owner_id,name,species,photo_urls,profile_completeness,active_match_modes)
values
  ('56000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','M26 A','DOG',array['https://example.test/a.jpg'],100,array['PLAY']),
  ('56000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000005','M26 B','DOG',array['https://example.test/b.jpg'],100,array['PLAY']);
create temp table m26_chat(conversation_id uuid);
grant all on m26_chat to authenticated;

-- Consent is required to create a profile, not to edit one.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000026',true);
select throws_ok($$select public.complete_profile_onboarding('New','Bucharest',null,array['ADOPTER']::public.user_role[])$$,
  'P0001','Confirm you are at least 16 and accept the Terms and Privacy Policy','new profiles require consent');
select throws_ok($$select public.complete_profile_onboarding('New','Bucharest',null,array['ADOPTER']::public.user_role[],true,false)$$,
  'P0001','Confirm you are at least 16 and accept the Terms and Privacy Policy','age alone is not enough');
select lives_ok($$select public.complete_profile_onboarding('New','Bucharest',null,array['ADOPTER']::public.user_role[],true,true)$$,
  'new profile is created with consent');
select ok((select age_confirmed and terms_accepted_at is not null from public.profiles
  where id='10000000-0000-4000-8000-000000000026'),'consent is recorded on the profile');
select lives_ok($$select public.complete_profile_onboarding('New Name','Bucharest',null,array['ADOPTER']::public.user_role[])$$,
  'profile edits do not ask for consent again');

-- Fixture: B and A match and exchange messages.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select is((select matched from public.like_match_candidate('56000000-0000-4000-8000-000000000001',
  '56000000-0000-4000-8000-000000000002','PLAY')),false,'fixture: first like');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
insert into m26_chat select conversation_id from public.like_match_candidate('56000000-0000-4000-8000-000000000002',
  '56000000-0000-4000-8000-000000000001','PLAY');
select lives_ok($$select public.send_conversation_message(conversation_id,'Walk on Saturday?') from m26_chat$$,'fixture: B messages A');

-- Export returns the caller's own data only.
select is((select jsonb_array_length(public.export_my_data()->'messagesSent')),1,'export includes messages the user sent');
select is((select public.export_my_data()->'profile'->>'id'),'10000000-0000-4000-8000-000000000005','export is scoped to the caller');
select ok((select public.export_my_data()->'animals' @> '[{"name":"M26 B"}]'::jsonb),'export includes the user''s animals');
select ok(not (select public.export_my_data()::text like '%Deleted user%'),'export does not include other people''s identities');

-- Deletion is service-only; users only see their blockers.
select ok(not has_function_privilege('authenticated','public.delete_account_data(uuid)','execute'),
  'clients cannot run account deletion directly');
select is(public.my_account_deletion_blockers(),'{"pendingRequests":0,"activePlacements":0}'::jsonb,
  'users can see what blocks their deletion');

-- An open foster request blocks deletion and changes nothing.
set local role postgres;
insert into public.foster_requests(id,case_id,home_id,created_by,sender_id,recipient_id,kind,status,message)
values('57000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',
  'APPLICATION','PENDING','M26 pending request');
select is(public.delete_account_data('10000000-0000-4000-8000-000000000003')->>'deleted','false',
  'pending foster request blocks deletion');
select is((select display_name from public.profiles where id='10000000-0000-4000-8000-000000000003'),'Ana Popescu',
  'blocked deletion leaves the profile untouched');

-- Deleting B removes personal data and keeps A's conversation readable.
select is(public.delete_account_data('10000000-0000-4000-8000-000000000005')->>'deleted','true','account data is deleted');
select ok((select display_name = 'Deleted user' and deleted_at is not null and city is null
  from public.profiles where id='10000000-0000-4000-8000-000000000005'),'profile is anonymised');
select is((select count(*)::integer from public.profile_roles where profile_id='10000000-0000-4000-8000-000000000005'),0,
  'roles are removed');
select ok((select active_match_modes = '{}' and photo_urls = '{}' from public.owner_animal_profiles
  where id='56000000-0000-4000-8000-000000000002'),'the deleted user''s animal is hidden and stripped');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select is((select count(*)::integer from public.messages where conversation_id=(select conversation_id from m26_chat)),1,
  'the other participant keeps the conversation history');
select is((select count(*)::integer from public.discover_match_candidates('56000000-0000-4000-8000-000000000001','PLAY','{}')
  where animal_id='56000000-0000-4000-8000-000000000002'),0,'the deleted user''s animal leaves discovery');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
select throws_ok($$select public.complete_profile_onboarding('Back','Bucharest',null,array['ADOPTER']::public.user_role[],true,true)$$,
  'P0001','This account has been deleted','a deleted account cannot be re-created with a live session');

set local role postgres;
select * from finish();
rollback;
