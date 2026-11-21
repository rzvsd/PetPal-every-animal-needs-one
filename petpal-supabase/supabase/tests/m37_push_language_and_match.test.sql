begin;
select no_plan();

-- Push language and mutual match (0037). Fixtures as postgres; client
-- actions as the authenticated role; everything rolls back.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000003701','m37ro@example.test'),
  ('10000000-0000-4000-8000-000000003702','m37en@example.test');
insert into public.profiles(id,display_name,city) values
  ('10000000-0000-4000-8000-000000003701','Ana','Bucharest'),
  ('10000000-0000-4000-8000-000000003702','Ben','Bucharest');

select is(public.push_text_ro('Rex needs a vet. Open PetPal to talk with the foster.'),
  'Rex are nevoie de veterinar. Deschide PetPal ca să vorbești cu familia de foster.','a known sentence is translated with the name kept');
select is(public.push_text_ro('Bring the blue lead tomorrow'),'Bring the blue lead tomorrow','free text written by people is left alone');

-- Romanian is the default; an English account keeps English.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003702',true);
select is(public.set_my_language('en'),'en','I can choose English');
select throws_ok($$select public.set_my_language('de')$$,'P0001','Invalid request','only Romanian and English');
reset role;
select public.enqueue_push_notification('10000000-0000-4000-8000-000000003701','NEW_MESSAGE','{}',null,null);
select public.enqueue_push_notification('10000000-0000-4000-8000-000000003702','NEW_MESSAGE','{}',null,null);
select is((select title from public.notification_events where profile_id = '10000000-0000-4000-8000-000000003701'),'Mesaj nou pe PetPal','Romanian push for a Romanian account');
select is((select title from public.notification_events where profile_id = '10000000-0000-4000-8000-000000003702'),'New PetPal message','English push for an English account');

-- A foster request says who offered which animal.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003701',true);
create temp table ids(name text primary key, id uuid) on commit drop;
insert into ids values('case',public.save_foster_case(null,null,'{"name":"Rex","species":"DOG","description":"Old dog.","city":"Bucharest"}'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003702',true);
insert into ids values('home',public.save_foster_home(null,'{"name":"Ben home","city":"Bucharest","published":true,"capacity":1}'));
select public.create_foster_request(null,(select id from ids where name='case'),(select id from ids where name='home'),'APPLICATION','I can help');
reset role;
select ok(exists(select 1 from public.notification_events where profile_id = '10000000-0000-4000-8000-000000003701'
  and event_type = 'FOSTER_UPDATE' and title = 'Rex' and body = 'Ben oferă o casă pentru Rex. Deschide PetPal ca să răspunzi.'),'the offer push names the person and the animal');

-- A mutual match tells the owner who liked first.
insert into public.owner_animal_profiles(id,owner_id,name,species,sex,active_match_modes)
  values('10000000-0000-4000-8000-0000000037a1','10000000-0000-4000-8000-000000003701','Lola','DOG','FEMALE','{PLAY}'),
        ('10000000-0000-4000-8000-0000000037a2','10000000-0000-4000-8000-000000003702','Max','DOG','MALE','{PLAY}');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000003702',true);
insert into public.animal_matches(animal_a_id,animal_b_id,mode) values('10000000-0000-4000-8000-0000000037a1','10000000-0000-4000-8000-0000000037a2','PLAY');
select ok(exists(select 1 from public.notification_events where profile_id = '10000000-0000-4000-8000-000000003701'
  and event_type = 'MATCH_MUTUAL' and body = 'Lola și Max se plac. Salută în PetPal.'),'the owner who liked first hears about the match');
select ok(not exists(select 1 from public.notification_events where profile_id = '10000000-0000-4000-8000-000000003702'
  and event_type = 'MATCH_MUTUAL'),'the owner who completed it sees it on screen instead');

select * from finish();
rollback;
