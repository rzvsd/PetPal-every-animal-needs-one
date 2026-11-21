begin;
select no_plan();

-- Activity follows the app's language (0040). Everything rolls back.
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000004001','m40@example.test');
insert into public.profiles(id,display_name,city) values('10000000-0000-4000-8000-000000004001','Ana','Bucharest');

-- The account is Romanian, so the push itself is Romanian...
select public.enqueue_push_notification('10000000-0000-4000-8000-000000004001','FOSTER_UPDATE','{}','Rex',
  'Rex needs a vet. Open PetPal to talk with the foster.');
select is((select body from public.notification_events where profile_id = '10000000-0000-4000-8000-000000004001'),
  'Rex are nevoie de veterinar. Deschide PetPal ca să vorbești cu familia de foster.','the push follows the account language');

-- ...but the Activity list offers both, so an English app shows English.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004001',true);
select is((select body_en from public.my_activity_view),'Rex needs a vet. Open PetPal to talk with the foster.','English text is kept');
select is((select body_ro from public.my_activity_view),
  'Rex are nevoie de veterinar. Deschide PetPal ca să vorbești cu familia de foster.','Romanian text is offered');
select is((select title_en from public.my_activity_view),'Rex','the title is kept too');
reset role;

-- Notices written before 0040 have no English copy and fall back to what was stored.
insert into public.notification_events(profile_id,event_type,title,body) values
  ('10000000-0000-4000-8000-000000004001','FOSTER_UPDATE','Vechi','Text vechi');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004001',true);
select is((select body_en from public.my_activity_view where title = 'Vechi'),'Text vechi','old notices still show');
select is((select body_ro from public.my_activity_view where title = 'Vechi'),'Text vechi','old notices still show in Romanian');
reset role;

select * from finish();
rollback;
