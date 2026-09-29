-- Manual, local-only playground. Do not add to the automatic/reset seed list.
-- Existing namespace means a no-op: preserve the user's subsequent decisions.
begin;
do $$
declare
  me uuid := '10000000-0000-4000-8000-000000000003';
  missy uuid := 'be2cd5da-50f4-47e8-a782-cc72ec448151';
  owners uuid[] := array[me]; pets uuid[] := '{}'; homes uuid[] := '{}';
  names text[] := array['Elena','Andrei','Ioana','Matei','Sofia','Vlad','Mara','PetPal Playground'];
  emails text[] := array['elena.play','andrei.play','ioana.play','matei.play','sofia.play','vlad.play','mara.play','playground'];
  pet_names text[] := array['Buddy','Daisy','Rex','Nori','Finn','Cleo','Hugo','Olive','Theo','Poppy'];
  pet_owners integer[] := array[1,2,3,4,5,6,7,8,9,8];
  home_names text[] := array['Playground House','Sunny Paws','Cat Corner','Garden Lodge','Quiet Nest','Weekend Retreat'];
  home_owners integer[] := array[1,2,4,3,6,9];
  case_pets integer[] := array[2,3,4,5,6,9];
  breeds text[] := array['Labrador','Golden Retriever','Mixed breed','Domestic shorthair','Terrier mix','Domestic shorthair','Mixed breed','Domestic shorthair','Terrier mix','Domestic shorthair'];
  actor uuid; pet uuid; home uuid; case_id uuid; animal uuid; request_id uuid;
  placement uuid; conversation uuid; room uuid; species_value public.species;
  photo text; modes text[]; i integer; n integer; age integer; sex_value text; size_value text;
  photo_base text := 'http://127.0.0.1:54321/storage/v1/object/public/animal-photos/';
begin
  perform pg_advisory_xact_lock(hashtextextended('petpal-playground-20260908',0));
  if exists(select 1 from public.profiles where id = '09080001-0000-4000-8000-000000000001') then
    raise notice 'Playground already exists; keeping all current progress.';
    return;
  end if;
  if not public.foster_actor_active(me) or not exists(select 1 from public.owner_animal_profiles
    where id = missy and owner_id = me and 'PLAY' = any(active_match_modes)) then
    raise exception 'Expected local Rzv/Missy playground account is unavailable; nothing changed';
  end if;
  for i in 1..8 loop
    actor := ('09080001-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
    owners := array_append(owners,actor);
    insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
      confirmation_token,recovery_token,email_change_token_new,email_change,phone_change,
      phone_change_token,email_change_token_current,email_change_confirm_status,reauthentication_token,
      is_sso_user,is_anonymous,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values(actor,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
      emails[i] || '@petpal.local',crypt('petpal-demo-password',gen_salt('bf')),now(),
      '','','','','','','',0,'',false,false,'{"provider":"email","providers":["email"]}',
      jsonb_build_object('display_name',names[i] || ' · Playground'),now(),now());
    insert into auth.identities(id,provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    values(actor,actor::text,actor,jsonb_build_object('sub',actor,'email',emails[i] || '@petpal.local',
      'email_verified',true,'phone_verified',false),'email',now(),now(),now());
    insert into public.profiles(id,display_name,city,coarse_area,verification_status,age_confirmed,onboarding_completed_at)
    values(actor,names[i] || ' · Playground','Bucharest','Demo Park','UNVERIFIED',true,now());
    insert into public.profile_roles(profile_id,role) values(actor,'ADOPTER'),(actor,'FOSTER');
  end loop;
  for i in 1..10 loop
    pet := ('09080002-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
    pets := array_append(pets,pet); actor := owners[pet_owners[i]];
    species_value := case when i in (4,6,8,10) then 'CAT'::public.species else 'DOG'::public.species end;
    modes := case when i in (5,6,9) then array['SOCIAL'] when i in (3,4,8) then array['PLAY'] else array['PLAY','SOCIAL'] end;
    age := 12 + i * 6; sex_value := case when i in (2,4,6,8,10) then 'FEMALE' else 'MALE' end;
    size_value := case when species_value = 'CAT' or i in (5,9) then 'SMALL' when i in (1,2,7) then 'LARGE' else 'MEDIUM' end;
    photo := photo_base || actor || '/' || pet || '/playground.jpg';
    insert into public.owner_animal_profiles(id,owner_id,name,species,breed_or_mix,is_mixed_breed,
      approximate_age_months,sex,size_label,sterilized_status,vaccine_status,temperament_tags,
      energy_level,good_with_dogs,good_with_cats,good_with_children,city,coarse_area,photo_urls,active_match_modes,profile_completeness)
    values(pet,actor,pet_names[i] || ' · Demo',species_value,breeds[i],i not in (1,2),age,sex_value,size_value,
      'YES','UP_TO_DATE',array['Friendly','Playground example'],case when i % 2 = 0 then 'LOW' else 'HIGH' end,
      true,species_value = 'CAT',true,'Bucharest','Demo Park',array[photo],modes,
      public.calculate_owner_animal_completeness(pet_names[i],species_value,breeds[i],age,sex_value,size_value,
        'UP_TO_DATE','YES',array['Friendly'],'Bucharest','Demo Park',array[photo]));
  end loop;
  -- Two invitations to like back, one unreciprocated like, one existing match.
  perform set_config('request.jwt.claim.sub',owners[2]::text,true);
  perform public.like_match_candidate(pets[2],pets[1],'PLAY');
  perform set_config('request.jwt.claim.sub',owners[4]::text,true);
  perform public.like_match_candidate(pets[4],missy,'PLAY');
  perform set_config('request.jwt.claim.sub',me::text,true);
  perform public.like_match_candidate(missy,pets[8],'PLAY');
  perform public.like_match_candidate(pets[1],pets[7],'PLAY');
  perform set_config('request.jwt.claim.sub',owners[7]::text,true);
  select m.conversation_id into conversation from public.like_match_candidate(pets[7],pets[1],'PLAY') m;
  perform public.send_conversation_message(conversation,'[Playground] Hugo and Buddy already matched. Try replying here.',gen_random_uuid());
  -- Walk requests: incoming pending, outgoing accepted, outgoing declined.
  perform set_config('request.jwt.claim.sub',owners[5]::text,true);
  perform public.request_social_walk(pets[5],pets[1],'[Playground] Finn would like a gentle walk with Buddy. Accept or decline this request to try it.');
  perform set_config('request.jwt.claim.sub',me::text,true);
  conversation := public.request_social_walk(pets[1],pets[9],'[Playground] Would Theo like a walk with Buddy?');
  perform set_config('request.jwt.claim.sub',owners[9]::text,true);
  perform public.respond_social_walk(conversation,true);
  perform public.send_conversation_message(conversation,'[Playground] Accepted! This chat is ready for a practice reply.',gen_random_uuid());
  perform set_config('request.jwt.claim.sub',me::text,true);
  conversation := public.request_social_walk(pets[1],pets[6],'[Playground] A sample invitation that the other owner declines.');
  perform set_config('request.jwt.claim.sub',owners[6]::text,true);
  perform public.respond_social_walk(conversation,false);
  for i in 1..6 loop
    home := ('09080003-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
    homes := array_append(homes,home); actor := owners[home_owners[i]];
    perform set_config('request.jwt.claim.sub',actor::text,true);
    perform public.save_foster_home(home,jsonb_build_object('name',home_names[i] || ' · Demo',
      'city','Bucharest','area','Demo Park','published',true,'capacity',case when i = 1 then 4 else 3 end,
      'dogCapacity',case when i in (3,5) then 0 else 3 end,'catCapacity',case when i = 4 then 0 else 2 end,
      'availability',case when i = 4 then 'UNAVAILABLE' when i = 5 then 'LIMITED' else 'AVAILABLE' end,
      'species',case when i in (3,5) then '["CAT"]'::jsonb when i = 4 then '["DOG"]'::jsonb else '["DOG","CAT"]'::jsonb end,
      'housingType',case when i in (3,5) then 'Apartment' else 'House with garden' end,
      'experience','Fictional playground home for trying the foster workflow.',
      'bio','[Playground] A fictional example with a stock photograph. Practice browsing, applications, approvals and care here.',
      'photos',jsonb_build_array(photo_base || actor || '/' || home || '/playground.jpg')));
  end loop;
  perform set_config('request.jwt.claim.sub',me::text,true);
  room := public.save_foster_space(homes[1],'Main room',false);
  perform public.save_foster_space(homes[1],'Quiet room',true);
  for i in 1..6 loop
    n := case_pets[i]; actor := owners[pet_owners[n]];
    case_id := ('09080005-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
    animal := ('09080004-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
    request_id := ('09080006-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
    perform set_config('request.jwt.claim.sub',actor::text,true);
    perform public.save_foster_case(case_id,animal,(select jsonb_build_object('name',p.name,'species',p.species,
      'sex',p.sex,'breed',p.breed_or_mix,'ageMonths',p.approximate_age_months,'size',p.size_label,'photo',p.photo_urls[1],
      'city','Bucharest','area','Demo Park','status','ACTIVE','urgency',case when i = 1 then 'HIGH' else 'MEDIUM' end,
      'duration',case when i % 2 = 0 then 'ONE_TWO_WEEKS' else 'FEW_DAYS' end,
      'foodCovered',true,'vetCovered',true,'transport',i % 2 = 0,
      'description','[Playground] Fictional foster example for ' || pet_names[n] || '. Use it to explore requests and care.',
      'medicalNeeds','Fictional example; no treatment instructions.','homeFit','A quiet settling-in space.')
      from public.owner_animal_profiles p where p.id = pets[n]));
    update public.animals set owner_animal_profile_id = pets[n] where id = animal;
    if i >= 5 then perform set_config('request.jwt.claim.sub',me::text,true); end if;
    perform public.create_foster_request(request_id,case_id,homes[1],case when i >= 5 then 'APPLICATION' else 'INVITE' end,
      '[Playground] ' || case i when 1 then 'Daisy is waiting for your accept or decline decision.'
        when 2 then 'Rex demonstrates a declined request.' when 3 then 'Nori is approved and waiting for arrival.'
        when 4 then 'Finn demonstrates an animal already in care.' when 5 then 'Your application for Cleo is waiting for the owner.'
        else 'Theo demonstrates a completed foster stay.' end);
    if i in (2,3,4,6) then
      perform set_config('request.jwt.claim.sub',(case when i = 6 then actor else me end)::text,true);
      placement := public.respond_foster_request(request_id,case when i = 2 then 'DECLINE' else 'ACCEPT' end,
        (select updated_at from public.foster_requests where id = request_id));
      if i in (4,6) then
        perform set_config('request.jwt.claim.sub',me::text,true);
        perform public.update_foster_placement(placement,'RECEIVE',jsonb_build_object('expectedUpdatedAt',
          (select updated_at from public.foster_placements where id = placement)));
        if i = 4 then
          perform public.update_foster_placement(placement,'CARE',jsonb_build_object('carerId',me,'spaceId',room,
            'careState','NORMAL','expectedUpdatedAt',(select updated_at from public.foster_placements where id = placement)));
          perform public.update_foster_placement(placement,'NOTE','{"body":"[Playground] Finn is settling into the main room. Try adding a care note."}');
          perform public.save_foster_task('09080007-0000-4000-8000-000000000001',placement,
            jsonb_build_object('title','[Demo] Refresh water bowl','assigneeId',me,'dueAt',now() - interval '1 hour'));
          perform public.save_foster_task('09080007-0000-4000-8000-000000000002',placement,
            jsonb_build_object('title','[Demo] Short garden walk','assigneeId',me,'dueAt',now() + interval '3 hours'));
        else
          perform public.update_foster_placement(placement,'END',jsonb_build_object('body','[Playground] Practice stay completed; Theo returned to the example owner.',
            'expectedUpdatedAt',(select updated_at from public.foster_placements where id = placement)));
        end if;
      end if;
    end if;
  end loop;
  raise notice 'Created 8 owners, 10 pet profiles, 6 homes, match/walk scenarios and 6 foster requests.';
end $$;
commit;
