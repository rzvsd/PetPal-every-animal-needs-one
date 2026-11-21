-- Notifications people can read (product review item 9) and a sound for the
-- owner who liked first (Match addition). Push text is written in English in
-- the database and translated here for Romanian accounts, so the queue, the
-- sender and the tests stay the same.

alter table public.profiles add column language text not null default 'ro'
  constraint profiles_language_check check (language in ('ro','en'));

create or replace function public.set_my_language(language_input text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if language_input not in ('ro','en') then raise exception 'Invalid request'; end if;
  update public.profiles set language = language_input where id = auth.uid();
  return language_input;
end $$;
revoke all on function public.set_my_language(text) from public,anon;
grant execute on function public.set_my_language(text) to authenticated;

-- Whole known sentences only; free text written by people is left as it is.
create or replace function public.push_text_ro(text_input text)
returns text language plpgsql immutable set search_path = public as $$
declare t text := text_input; rules text[][] := array[
  -- Titles
  ['^New PetPal message$','Mesaj nou pe PetPal'],
  ['^Foster update$','Noutăți foster'],
  ['^PetPal update$','Noutăți PetPal'],
  ['^Foster request accepted$','Cerere foster acceptată'],
  ['^PetPal review update$','Noutăți despre raportul tău'],
  ['^Transfer needs your answer$','Transferul așteaptă răspunsul tău'],
  ['^Animal moved$','Animalul s-a mutat'],
  ['^Care ended$','Îngrijirea s-a încheiat'],
  ['^Needs a vet$','Are nevoie de veterinar'],
  ['^Diary note$','Notă nouă în jurnal'],
  ['^New task$','Sarcină nouă'],
  ['^Care today$','Îngrijirea de azi'],
  ['^Foster team invitation$','Invitație în echipa unei case'],
  ['^A helper joined your home$','Un ajutor s-a alăturat casei tale'],
  ['^Your report was reviewed$','Raportul tău a fost analizat'],
  ['^It''s a match!$','V-ați plăcut reciproc!'],
  ['^Conversation opened$','Discuție deschisă'],
  -- Bodies
  ['^Open PetPal to read your message\.$','Deschide PetPal ca să citești mesajul.'],
  ['^You have a new message in PetPal\.$','Ai un mesaj nou în PetPal.'],
  ['^Open PetPal for the latest update\.$','Deschide PetPal pentru noutăți.'],
  ['^Your foster request was accepted\. Chat is now open\.$','Cererea ta a fost acceptată. Discuția este deschisă.'],
  ['^A PetPal review decision is ready\.$','Decizia PetPal este gata.'],
  ['^(.+) offered a home for (.+)\. Open PetPal to answer\.$','\1 oferă o casă pentru \2. Deschide PetPal ca să răspunzi.'],
  ['^(.+) asks if you can host (.+)\. Open PetPal to answer\.$','\1 te întreabă dacă poți găzdui pe \2. Deschide PetPal ca să răspunzi.'],
  ['^(.+) accepted\. (.+) is reserved for your home\.$','\1 a acceptat. \2 este rezervat pentru casa ta.'],
  ['^(.+) accepted\. (.+) will come to their home\.$','\1 a acceptat. \2 va merge la casa lor.'],
  ['^(.+) declined this time\.$','\1 a refuzat de această dată.'],
  ['^(.+) withdrew the offer\.$','\1 și-a retras oferta.'],
  ['^(.+) cancelled the reservation\.$','\1 a anulat rezervarea.'],
  ['^(.+) has found a home with someone else\. Thank you for offering\.$','\1 și-a găsit o casă la altcineva. Mulțumim că te-ai oferit.'],
  ['^(.+) may move to another foster home\. Open PetPal to agree or refuse\.$','\1 s-ar putea muta la altă casă de foster. Deschide PetPal ca să fii de acord sau să refuzi.'],
  ['^The animal''s owner agreed to this transfer\.(.*)$','Stăpânul animalului a fost de acord cu transferul.\1'],
  ['^The animal''s owner refused this transfer\.(.*)$','Stăpânul animalului a refuzat transferul.\1'],
  ['^(.+) arrived at a new foster home\. You can follow it in PetPal\.$','\1 a ajuns la o nouă casă de foster. Îl poți urmări în PetPal.'],
  ['^(.+): care was marked as ended\. Open PetPal to confirm or tell the other side if something is wrong \(7 days\)\.$',
    '\1: îngrijirea a fost marcată ca încheiată. Deschide PetPal ca să confirmi sau să spui dacă ceva nu e în regulă (7 zile).'],
  ['^(.+) needs a vet\. Open PetPal to talk with the foster\.$','\1 are nevoie de veterinar. Deschide PetPal ca să vorbești cu familia de foster.'],
  ['^Receipt declared by the receiving foster\. This is not a PetPal verification\.$','Familia de foster a confirmat că animalul a ajuns. PetPal nu verifică acest lucru.'],
  ['^The other side confirmed how care ended\.$','Cealaltă parte a confirmat cum s-a încheiat îngrijirea.'],
  ['^1 task today for (.+)\.$','1 sarcină azi pentru \1.'],
  ['^([0-9]+) tasks today for (.+)\.$','\1 sarcini azi pentru \2.'],
  ['^Open Foster to review a team invitation\.$','Deschide Foster ca să vezi invitația.'],
  ['^Someone used your invite code\. Open Foster to see your team\.$','Cineva a folosit codul tău de invitație. Deschide Foster ca să vezi echipa.'],
  ['^Thank you\. A PetPal moderator reviewed your report\.$','Mulțumim. Un moderator PetPal a analizat raportul tău.'],
  ['^(.+) and (.+) like each other\. Say hello in PetPal\.$','\1 și \2 se plac. Salută în PetPal.'],
  ['^Your accepted foster request opened a conversation\.$','Cererea ta acceptată a deschis o discuție.']
]; i integer;
begin
  if t is null then return null; end if;
  for i in 1 .. array_length(rules,1) loop
    if t ~ rules[i][1] then return regexp_replace(t,rules[i][1],rules[i][2]); end if;
  end loop;
  return t;
end $$;

create or replace function public.enqueue_push_notification(profile_id_input uuid, event_type_input text, payload_input jsonb default '{}'::jsonb,
  title_input text default null, body_input text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare event_id_result uuid; prefs jsonb; lang text; category text := public.notification_category(event_type_input); wanted boolean := true;
  title_value text := coalesce(nullif(trim(title_input),''),public.default_push_title(event_type_input));
  body_value text := coalesce(nullif(trim(body_input),''),public.default_push_body(event_type_input));
begin
  if profile_id_input is null then raise exception 'Notification profile id is required'; end if;
  select notification_preferences,language into prefs,lang from public.profiles where id = profile_id_input;
  if category <> 'CRITICAL' and prefs is not null then
    wanted := coalesce((prefs->>'push')::boolean,true) and (category = 'push' or coalesce((prefs->>category)::boolean,true));
  end if;
  if coalesce(lang,'ro') = 'ro' then title_value := public.push_text_ro(title_value); body_value := public.push_text_ro(body_value); end if;
  insert into public.notification_events(profile_id,event_type,payload,title,body,delivery_status,next_attempt_at)
  values(profile_id_input,event_type_input,coalesce(payload_input,'{}'::jsonb),title_value,body_value,
    case when wanted then 'QUEUED' else 'SKIPPED' end,now())
  returning id into event_id_result;
  return event_id_result;
end $$;

-- Foster pushes carry the animal's name as the title and say who did what.
create or replace function public.foster_notify(request_input uuid,event_input text,body_input text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.foster_requests; notification_conversation uuid; animal_name text; actor_name text; push_body text := body_input;
begin
  select * into r from public.foster_requests where id = request_input;
  select id into notification_conversation from public.conversations where foster_request_id = r.id;
  select a.name into animal_name from public.animal_listings l join public.animals a on a.id = l.animal_id where l.id = r.case_id;
  select display_name into actor_name from public.profiles where id = auth.uid();
  actor_name := coalesce(nullif(trim(actor_name),''),'Someone');
  animal_name := coalesce(animal_name,'The animal');
  push_body := case
    when event_input = 'CREATED' and r.kind = 'APPLICATION' then actor_name || ' offered a home for ' || animal_name || '. Open PetPal to answer.'
    when event_input = 'CREATED' then actor_name || ' asks if you can host ' || animal_name || '. Open PetPal to answer.'
    when event_input = 'ACCEPTED' and r.kind = 'APPLICATION' then actor_name || ' accepted. ' || animal_name || ' is reserved for your home.'
    when event_input = 'ACCEPTED' then actor_name || ' accepted. ' || animal_name || ' will come to their home.'
    when event_input = 'DECLINED' and body_input like 'Request status:%' then actor_name || ' declined this time.'
    when event_input = 'WITHDRAWN' and body_input like 'Request status:%' then actor_name || ' withdrew the offer.'
    when event_input = 'CANCELLED' and body_input like 'Request status:%' then actor_name || ' cancelled the reservation.'
    else body_input end;
  perform public.enqueue_push_notification(p.id,'FOSTER_UPDATE',jsonb_build_object('requestId',r.id,'conversationId',notification_conversation),
    animal_name,push_body) from (values(r.sender_id),(r.recipient_id)) p(id) where p.id <> auth.uid();
  insert into public.foster_request_events(request_id,actor_id,event,body) values(r.id,auth.uid(),event_input,body_input);
  update public.conversation_participants cp set last_read_seq = cp.last_read_seq where cp.conversation_id = notification_conversation;
end $$;
revoke all on function public.foster_notify(uuid,text,text) from public,anon,authenticated;

-- A mutual match tells the owner who liked first.
create or replace function public.notify_mutual_match()
returns trigger language plpgsql security definer set search_path = public as $$
declare a public.owner_animal_profiles; b public.owner_animal_profiles;
begin
  select * into a from public.owner_animal_profiles where id = new.animal_a_id;
  select * into b from public.owner_animal_profiles where id = new.animal_b_id;
  perform public.enqueue_push_notification(owner.id,'MATCH_MUTUAL',jsonb_build_object('matchId',new.id),'It''s a match!',
    owner.mine || ' and ' || owner.theirs || ' like each other. Say hello in PetPal.')
  from (values(a.owner_id,a.name,b.name),(b.owner_id,b.name,a.name)) owner(id,mine,theirs)
  where owner.id is not null and owner.id is distinct from auth.uid();
  return new;
end $$;
create trigger notify_mutual_match after insert on public.animal_matches
  for each row execute function public.notify_mutual_match();
revoke all on function public.notify_mutual_match() from public,anon,authenticated;

notify pgrst, 'reload schema';
