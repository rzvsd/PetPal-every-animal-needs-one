begin;
select no_plan();

-- Contact and abuse rules (0027). Fixtures as postgres; client actions as the
-- real authenticated role; everything rolls back.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000000271','m27a@example.test'),
  ('10000000-0000-4000-8000-000000000272','m27b@example.test');
insert into public.profiles(id,display_name,city) values
  ('10000000-0000-4000-8000-000000000271','M27 A','Bucharest'),
  ('10000000-0000-4000-8000-000000000272','M27 B','Bucharest');
-- Sender dog (user 4) and dogs owned by six other people, plus one cat.
insert into public.owner_animal_profiles(id,owner_id,name,species,photo_urls,profile_completeness,active_match_modes)
values
  ('58000000-0000-4000-8000-000000000000','10000000-0000-4000-8000-000000000004','Sender','DOG',array['https://example.test/0.jpg'],100,array['PLAY','SOCIAL']),
  ('58000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','D1','DOG',array['https://example.test/1.jpg'],100,array['PLAY','SOCIAL']),
  ('58000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','D2','DOG',array['https://example.test/2.jpg'],100,array['SOCIAL']),
  ('58000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','D3','DOG',array['https://example.test/3.jpg'],100,array['SOCIAL']),
  ('58000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000005','D5','DOG',array['https://example.test/5.jpg'],100,array['SOCIAL']),
  ('58000000-0000-4000-8000-000000000271','10000000-0000-4000-8000-000000000271','D271','DOG',array['https://example.test/6.jpg'],100,array['SOCIAL']),
  ('58000000-0000-4000-8000-000000000272','10000000-0000-4000-8000-000000000272','D272','DOG',array['https://example.test/7.jpg'],100,array['SOCIAL']),
  ('58000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','Cat','CAT',array['https://example.test/9.jpg'],100,array['SOCIAL']);
insert into storage.objects(bucket_id,name,owner) values
  ('animal-photos','10000000-0000-4000-8000-000000000271/m27/own.jpg','10000000-0000-4000-8000-000000000271'),
  ('animal-photos','10000000-0000-4000-8000-000000000005/m27/other.jpg','10000000-0000-4000-8000-000000000005');

-- Social walks: dogs only, five new requests a day.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select throws_ok($$select public.request_social_walk('58000000-0000-4000-8000-000000000000',
  '58000000-0000-4000-8000-000000000009','Walk?')$$,'P0001','Social walks are for dogs only','walk requests to cats are refused');
select lives_ok($$select public.request_social_walk('58000000-0000-4000-8000-000000000000','58000000-0000-4000-8000-000000000001','Walk?');
  select public.request_social_walk('58000000-0000-4000-8000-000000000000','58000000-0000-4000-8000-000000000002','Walk?');
  select public.request_social_walk('58000000-0000-4000-8000-000000000000','58000000-0000-4000-8000-000000000003','Walk?');
  select public.request_social_walk('58000000-0000-4000-8000-000000000000','58000000-0000-4000-8000-000000000005','Walk?');
  select public.request_social_walk('58000000-0000-4000-8000-000000000000','58000000-0000-4000-8000-000000000271','Walk?')$$,
  'five walk requests a day are allowed');
select lives_ok($$select public.request_social_walk('58000000-0000-4000-8000-000000000000','58000000-0000-4000-8000-000000000001','Again?')$$,
  'repeating a request to the same owner returns the existing one without counting');
select throws_ok($$select public.request_social_walk('58000000-0000-4000-8000-000000000000',
  '58000000-0000-4000-8000-000000000272','Walk?')$$,'P0001','Daily walk request limit reached. Try again tomorrow.',
  'the sixth new walk request in a day is refused');

-- Passes are remembered and hidden from discovery, but not from Saved.
select lives_ok($$insert into public.match_passes(profile_id,my_animal_id,target_animal_id,mode)
  values(auth.uid(),'58000000-0000-4000-8000-000000000000','58000000-0000-4000-8000-000000000001','PLAY')$$,'owners can record a pass');
select is((select count(*)::integer from public.discover_match_candidates('58000000-0000-4000-8000-000000000000','PLAY','{}')
  where animal_id='58000000-0000-4000-8000-000000000001'),0,'passed animals leave discovery');
insert into public.saved_animals(animal_id) values('58000000-0000-4000-8000-000000000001');
select is((select count(*)::integer from public.discover_match_candidates('58000000-0000-4000-8000-000000000000','PLAY','{}',true)
  where animal_id='58000000-0000-4000-8000-000000000001'),1,'a passed animal the owner saved stays in Saved');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
select throws_ok($$insert into public.match_passes(profile_id,my_animal_id,target_animal_id,mode)
  values(auth.uid(),'58000000-0000-4000-8000-000000000000','58000000-0000-4000-8000-000000000002','PLAY')$$,'42501',null,
  'users cannot record passes for someone else''s animal');
select is((select count(*)::integer from public.match_passes),0,'users cannot read other people''s passes');

-- Foster case photos must be the author's own uploads.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000271',true);
select throws_ok($$select public.save_foster_case(null,null,'{"name":"Rex","species":"DOG","description":"Needs a calm home.",
  "city":"Bucharest","photo":"https://tracker.example/rex.jpg"}')$$,'P0001','Photos must be uploaded in PetPal',
  'external photo URLs are refused');
select throws_ok($$select public.save_foster_case(null,null,'{"name":"Rex","species":"DOG","description":"Needs a calm home.",
  "city":"Bucharest","photo":"10000000-0000-4000-8000-000000000005/m27/other.jpg"}')$$,'P0001','Photos must be uploaded in PetPal',
  'another person''s upload is refused');
select lives_ok($$select public.save_foster_case('59000000-0000-4000-8000-000000000001',null,'{"name":"Rex","species":"DOG",
  "description":"Needs a calm home.","city":"Bucharest","photo":"10000000-0000-4000-8000-000000000271/m27/own.jpg"}')$$,
  'the author''s own upload is accepted');
select throws_ok($$select public.save_foster_home(null,'{"name":"Home","city":"Bucharest","photos":["https://tracker.example/h.jpg"]}')$$,
  'P0001','Photos must be uploaded in PetPal','external foster home photos are refused');

-- Sale-like text is flagged to moderators without blocking publication.
select lives_ok($$select public.save_foster_case('59000000-0000-4000-8000-000000000002',null,'{"name":"Bella","species":"DOG",
  "description":"Vând cățel, preț 500 lei.","city":"Bucharest"}')$$,'sale-like cases still publish');
select is((select count(*)::integer from public.reports where listing_id='59000000-0000-4000-8000-000000000002'),0,
  'automatic flags are not visible to the author');
set local role postgres;
select is((select count(*)::integer from public.reports where listing_id='59000000-0000-4000-8000-000000000002'
  and reporter_id is null and category='AUTO_SALE_TEXT' and status='OPEN'),1,'sale-like text creates one automatic flag');
select is((select count(*)::integer from public.reports where listing_id='59000000-0000-4000-8000-000000000001'),0,
  'ordinary cases are not flagged');
create temp table m27_case as select updated_at from public.animal_listings where id='59000000-0000-4000-8000-000000000002';
grant select on m27_case to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000271',true);
select lives_ok($$select public.save_foster_case('59000000-0000-4000-8000-000000000002',null,jsonb_build_object('name','Bella','species','DOG',
  'description','Pret negociabil, 400 lei.','city','Bucharest','expectedUpdatedAt',(select updated_at from m27_case)))$$,
  'the flagged case can be edited');
set local role postgres;
select is((select count(*)::integer from public.reports where listing_id='59000000-0000-4000-8000-000000000002'),1,
  'repeated edits do not duplicate an open flag');

-- At most five new foster cases a day.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000271',true);
select lives_ok($$select public.save_foster_case(null,null,'{"name":"C3","species":"CAT","description":"Case.","city":"Bucharest"}');
  select public.save_foster_case(null,null,'{"name":"C4","species":"CAT","description":"Case.","city":"Bucharest"}');
  select public.save_foster_case(null,null,'{"name":"C5","species":"CAT","description":"Case.","city":"Bucharest"}')$$,
  'five new foster cases a day are allowed');
select throws_ok($$select public.save_foster_case(null,null,'{"name":"C6","species":"CAT","description":"Case.","city":"Bucharest"}')$$,
  'P0001','Daily foster case limit reached. Try again tomorrow.','the sixth new foster case in a day is refused');

-- Reservations beyond declared capacity reach the moderation queue.
set local role postgres;
update public.foster_home_profiles set availability_status='UNAVAILABLE' where id='60000000-0000-4000-8000-000000000001';
insert into public.foster_placements(animal_id,home_id,status,provenance,created_by)
select animal_id,'60000000-0000-4000-8000-000000000001','RESERVED','M27 fixture','10000000-0000-4000-8000-000000000003'
from public.animal_listings where id='40000000-0000-4000-8000-000000000002';
select is((select count(*)::integer from public.reports where category='CAPACITY_OVERRIDE' and reporter_id is null
  and reported_profile_id='10000000-0000-4000-8000-000000000003'),1,'capacity overrides create an automatic flag');

-- Automatic flags do not count against anyone's personal report limit.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000271',true);
select lives_ok($$insert into public.reports(reporter_id,reported_profile_id,category,details)
  values(auth.uid(),'10000000-0000-4000-8000-000000000004','MATCH_PROFILE','M27 report')$$,'users can still file their own reports');

set local role postgres;
select * from finish();
rollback;
