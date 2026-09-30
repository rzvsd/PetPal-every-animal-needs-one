begin;
select no_plan();

-- Foster team invite codes (0029). Fixtures as postgres; client actions as the
-- real authenticated role; everything rolls back. Home 60..01 belongs to user 3.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000000291','m29a@example.test'),
  ('10000000-0000-4000-8000-000000000292','m29b@example.test'),
  ('10000000-0000-4000-8000-000000000293','m29c@example.test');
insert into public.profiles(id,display_name,city) values
  ('10000000-0000-4000-8000-000000000291','M29 Helper','Bucharest'),
  ('10000000-0000-4000-8000-000000000292','M29 Late','Bucharest'),
  ('10000000-0000-4000-8000-000000000293','M29 Blocked','Bucharest');
insert into public.blocks(blocker_id,blocked_id) values
  ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000293');

select ok(not has_function_privilege('anon','public.create_foster_invite_code(uuid,text)','execute')
  and not has_function_privilege('anon','public.redeem_foster_invite_code(text)','execute'),'anonymous visitors cannot use invite codes');

set local role authenticated;
select throws_ok($$select * from public.foster_home_invites$$,'42501',null,'codes cannot be read directly');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000291',true);
select throws_ok($$select public.create_foster_invite_code('60000000-0000-4000-8000-000000000001','CARER')$$,
  'P0001','Only the home owner can invite helpers','people who do not own the home cannot create codes');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select set_config('m29.code',public.create_foster_invite_code('60000000-0000-4000-8000-000000000001','CARER')->>'code',true);
select matches(current_setting('m29.code'),'^[A-HJ-NP-Z2-9]{8}$','the owner gets an 8-character code without look-alike letters');
select is(public.redeem_foster_invite_code(current_setting('m29.code'))->>'status','OWN_HOME','the owner cannot join their own home');

-- The helper types it in lower case with a dash, as people do.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000291',true);
select is(public.redeem_foster_invite_code(lower(left(current_setting('m29.code'),4) || '-' || right(current_setting('m29.code'),4)))->>'status',
  'JOINED','the helper joins with the code');
select is((select role || '/' || status from public.foster_team_view where home_id = '60000000-0000-4000-8000-000000000001'
  and profile_id = auth.uid()),'CARER/ACTIVE','the helper is an active carer straight away');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000292',true);
select is(public.redeem_foster_invite_code(current_setting('m29.code'))->>'status','INVALID','a code works only once');

-- A person the owner blocked gets the same answer as a wrong code.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select set_config('m29.code',public.create_foster_invite_code('60000000-0000-4000-8000-000000000001','READER')->>'code',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000293',true);
select is(public.redeem_foster_invite_code(current_setting('m29.code'))->>'status','INVALID','blocked people cannot join');

-- Expired codes stop working.
set local role postgres;
update public.foster_home_invites set expires_at = now() - interval '1 minute' where code = current_setting('m29.code');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000292',true);
select is(public.redeem_foster_invite_code(current_setting('m29.code'))->>'status','INVALID','expired codes are refused');

-- Ten wrong tries an hour, then even a valid code waits.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select set_config('m29.code',public.create_foster_invite_code('60000000-0000-4000-8000-000000000001','CARER')->>'code',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000292',true);
-- This person already tried two dead codes above; seven more makes nine.
select is(count(*)::integer,7,'wrong codes are refused')
  from generate_series(1,7) where public.redeem_foster_invite_code('WRONG' || lpad(generate_series::text,3,'X'))->>'status' = 'INVALID';
select is(public.redeem_foster_invite_code('WRONGAAA')->>'status','INVALID','the tenth wrong code is still just wrong');
select is(public.redeem_foster_invite_code(current_setting('m29.code'))->>'status','LIMIT','after ten wrong codes even a valid one must wait');

-- Owners can create twenty codes a day.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select lives_ok($$select public.create_foster_invite_code('60000000-0000-4000-8000-000000000001','CARER') from generate_series(1,17)$$,
  'owners can create up to twenty codes a day');
select throws_ok($$select public.create_foster_invite_code('60000000-0000-4000-8000-000000000001','CARER')$$,
  'P0001','Invite code limit reached for today','the twenty-first code that day is refused');

set local role postgres;
select * from finish();
rollback;
