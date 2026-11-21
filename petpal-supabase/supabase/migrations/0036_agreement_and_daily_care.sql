-- What both sides agree to (product review items 7, 8 and 10) and a daily
-- care loop lighter than WhatsApp (during-pilot list: diary photo, daily tasks,
-- morning reminder).

-- 8. Five plain answers about the animal, each YES, NO or UNKNOWN ("Don't know").
alter table public.animals add column care_traits jsonb not null default '{}'::jsonb;
create or replace function public.valid_care_traits(traits jsonb)
returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(traits) = 'object' and not exists(select 1 from jsonb_each_text(traits) e
    where e.key not in ('bites','children','animals','vaccinated','sterilised') or e.value not in ('YES','NO','UNKNOWN'));
$$;
alter table public.animals add constraint animals_care_traits_check check (public.valid_care_traits(care_traits));

create or replace function public.save_animal_care_traits(animal_id_input uuid, traits_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare clean jsonb;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  if not exists(select 1 from public.animals a where a.id = animal_id_input and a.responsible_id = auth.uid())
    and not exists(select 1 from public.animal_listings l where l.animal_id = animal_id_input and l.responsible_id = auth.uid()
      and l.status <> 'ARCHIVED') then raise exception 'Only the person who posted this animal can change it'; end if;
  select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) into clean from jsonb_each_text(coalesce(traits_input,'{}'::jsonb)) e
    where e.key in ('bites','children','animals','vaccinated','sterilised') and e.value in ('YES','NO','UNKNOWN');
  update public.animals set care_traits = clean, updated_at = now() where id = animal_id_input;
  return clean;
end $$;
revoke all on function public.save_animal_care_traits(uuid,jsonb) from public,anon;
grant execute on function public.save_animal_care_traits(uuid,jsonb) to authenticated;

create or replace view public.foster_cases_directory as
SELECT l.id,
    l.animal_id,
    l.responsible_id,
    l.organization_id,
    l.status,
    l.description,
    l.city,
    l.coarse_area AS area,
    l.foster_urgency AS urgency,
    l.foster_duration AS duration,
    l.food_covered,
    l.vet_covered,
    l.transport_available,
    l.medical_needs,
    l.home_fit,
    l.created_at,
    l.updated_at,
    a.name,
    a.species,
    a.sex,
    a.breed_or_mix AS breed,
    a.approximate_age_months AS age_months,
    a.size_label,
    COALESCE(a.photo_url, ( SELECT ap.public_url
           FROM animal_photos ap
          WHERE (ap.animal_id = a.id)
          ORDER BY ap.sort_order
         LIMIT 1)) AS photo,
    p.display_name AS responsible_name,
    o.name AS organization_name,
    (EXISTS ( SELECT 1
           FROM (foster_requests r
             JOIN foster_placements fp ON ((fp.request_id = r.id)))
          WHERE ((r.case_id = l.id) AND (fp.status = ANY (ARRAY['RESERVED'::text, 'IN_CARE'::text]))))) AS placed,
    a.care_traits
   FROM (((animal_listings l
     JOIN animals a ON ((a.id = l.animal_id)))
     JOIN profiles p ON ((p.id = l.responsible_id)))
     LEFT JOIN organizations o ON ((o.id = l.organization_id)))
  WHERE ((l.mode = 'FOSTER'::petpal_mode) AND (auth.uid() IS NOT NULL) AND ((l.responsible_id = auth.uid()) OR ((l.status = 'ACTIVE'::listing_status) AND foster_actor_active(l.responsible_id) AND (NOT is_profile_blocked_between(auth.uid(), l.responsible_id)) AND (NOT (EXISTS ( SELECT 1
           FROM (foster_requests r
             JOIN foster_placements fp ON ((fp.request_id = r.id)))
          WHERE ((r.case_id = l.id) AND (fp.status = ANY (ARRAY['RESERVED'::text, 'IN_CARE'::text])))))))));

-- The care answers stay with the placement after acceptance.
create or replace view public.foster_registry_view as
select p.*,a.name,a.species,a.sex,coalesce(a.photo_url,(select ap.public_url from public.animal_photos ap
  where ap.animal_id = a.id order by ap.sort_order limit 1)) as photo,
  'F-' || a.foster_number::text as animal_code,s.name as space_name,s.isolation,
  person.display_name as carer_name,h.name as home_name,h.profile_id as home_owner_id,
  (select c.id from public.conversations c where c.foster_request_id = p.request_id) as conversation_id,
  (select count(*)::integer from public.foster_tasks t where t.placement_id = p.id and t.completed_at is null and t.due_at <= now()) as overdue_tasks,
  a.care_traits,a.approximate_age_months as age_months,a.size_label,a.breed_or_mix as breed
from public.foster_placements p join public.animals a on a.id = p.animal_id
join public.foster_home_profiles h on h.id = p.home_id left join public.foster_spaces s on s.id = p.space_id
left join public.profiles person on person.id = p.carer_id where public.foster_placement_visible(p.id);

-- 7. Who runs the home and since when, next to what reviewers wrote.
create or replace view public.foster_homes_directory as
SELECT id,
    profile_id,
    name,
    city,
    area,
    max_animals_at_once AS capacity,
    dog_capacity,
    cat_capacity,
    availability_status AS availability,
    accepts_species AS species,
    bio,
    photos,
    housing_type,
    experience_summary AS experience,
    published,
    updated_at,
    foster_home_role(id) AS my_role,
    ( SELECT (count(*))::integer AS count
           FROM foster_placements p
          WHERE ((p.home_id = h.id) AND (p.status = 'IN_CARE'::text))) AS occupied,
    ( SELECT (count(*))::integer AS count
           FROM foster_placements p
          WHERE ((p.home_id = h.id) AND (p.status = 'RESERVED'::text))) AS reserved,
    ( SELECT (count(*))::integer AS count
           FROM foster_placements p
          WHERE ((p.home_id = h.id) AND (p.status = 'COMPLETED'::text) AND (p.request_id IS NOT NULL))) AS completed_placements,
    ( SELECT round(avg(r.rating), 1) AS round
           FROM foster_home_reviews r
          WHERE ((r.foster_home_profile_id = h.id) AND (r.placement_id IS NOT NULL) AND (r.reviewer_id <> h.profile_id))) AS rating,
    ( SELECT (count(*))::integer AS count
           FROM foster_home_reviews r
          WHERE ((r.foster_home_profile_id = h.id) AND (r.placement_id IS NOT NULL) AND (r.reviewer_id <> h.profile_id))) AS review_count,
    (select o.display_name from profiles o where o.id = h.profile_id) AS owner_name,
    (select o.created_at from profiles o where o.id = h.profile_id) AS owner_since
   FROM foster_home_profiles h
  WHERE ((auth.uid() IS NOT NULL) AND ((foster_home_role(id) IS NOT NULL) OR (published AND foster_actor_active(profile_id) AND (NOT is_profile_blocked_between(auth.uid(), profile_id)))));

-- Diary notes may carry one photo from the writer's own storage folder.
alter table public.foster_journal add column photo_path text;
create or replace view public.foster_journal_view as
select j.id,j.placement_id,j.actor_id,j.event,j.body,j.created_at,p.display_name as actor_name,j.photo_path
from public.foster_journal j join public.profiles p on p.id = j.actor_id
where public.foster_placement_visible(j.placement_id);

create or replace function public.add_foster_note(placement_id_input uuid, body_input text, photo_input text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare note_id uuid; photo text := nullif(trim(coalesce(photo_input,'')),'');
begin
  if photo is not null and (split_part(photo,'/',1) <> auth.uid()::text or photo like '%..%' or char_length(photo) > 500) then
    raise exception 'Photo not accessible'; end if;
  perform public.update_foster_placement(placement_id_input,'NOTE',
    jsonb_build_object('body',coalesce(nullif(trim(coalesce(body_input,'')),''),case when photo is not null then 'Photo' end)));
  select id into note_id from public.foster_journal where placement_id = placement_id_input and actor_id = auth.uid() and event = 'NOTE'
    order by created_at desc limit 1;
  if photo is not null then update public.foster_journal set photo_path = photo where id = note_id; end if;
  return note_id;
end $$;
revoke all on function public.add_foster_note(uuid,text,text) from public,anon;
grant execute on function public.add_foster_note(uuid,text,text) to authenticated;

-- Daily tasks: ticking one creates tomorrow's; a tick can be undone.
alter table public.foster_tasks add column repeat_daily boolean not null default false,
  add column repeat_of uuid references public.foster_tasks(id) on delete set null;

create or replace function public.save_foster_task(task_id_input uuid,placement_id_input uuid,data_input jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare p public.foster_placements; task public.foster_tasks; result uuid := coalesce(task_id_input,gen_random_uuid());
  assignee uuid := nullif(data_input->>'assigneeId','')::uuid; home_owner uuid; member_role text; case_side boolean;
  daily boolean := coalesce((data_input->>'daily')::boolean,false); due timestamptz := nullif(data_input->>'dueAt','')::timestamptz;
  next_due timestamptz;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  select * into p from public.foster_placements where id = placement_id_input;
  if p.id is null or not public.foster_placement_visible(p.id) then raise exception 'Care access required'; end if;
  member_role := public.foster_home_role(p.home_id);
  case_side := member_role is null;
  if coalesce(member_role,'') not in ('OWNER','CARER') and not case_side then raise exception 'Care access required'; end if;
  select profile_id into home_owner from public.foster_home_profiles where id = p.home_id;
  if case_side then assignee := null; end if;
  if assignee is not null and assignee <> home_owner and not exists(select 1 from public.foster_home_members
    where home_id = p.home_id and profile_id = assignee and role = 'CARER' and status = 'ACTIVE') then raise exception 'Choose an active carer'; end if;
  select * into task from public.foster_tasks where id = result for update;
  if found then
    if task.placement_id <> placement_id_input then raise exception 'Task not accessible'; end if;
    if case_side then raise exception 'Only the foster home can tick off tasks'; end if;
    if coalesce((data_input->>'completed')::boolean,false) and task.completed_at is null then
      update public.foster_tasks set completed_at = now(),completed_by = auth.uid() where id = result;
      insert into public.foster_journal(placement_id,actor_id,event,body) values(p.id,auth.uid(),'TASK_COMPLETED',task.title);
      if task.repeat_daily and p.status = 'IN_CARE' then
        next_due := coalesce(task.due_at,now()) + interval '1 day';
        while next_due < now() loop next_due := next_due + interval '1 day'; end loop;
        insert into public.foster_tasks(placement_id,title,assignee_id,due_at,created_by,repeat_daily,repeat_of)
          values(p.id,task.title,task.assignee_id,next_due,task.created_by,true,task.id);
      end if;
    elsif data_input ? 'completed' and not (data_input->>'completed')::boolean and task.completed_at is not null then
      update public.foster_tasks set completed_at = null,completed_by = null where id = result;
      delete from public.foster_tasks where repeat_of = result and completed_at is null;
      insert into public.foster_journal(placement_id,actor_id,event,body) values(p.id,auth.uid(),'TASK_REOPENED',task.title);
    end if;
  else
    if p.status not in ('IN_CARE','RESERVED') then raise exception 'New tasks require active care'; end if;
    if char_length(trim(coalesce(data_input->>'title',''))) not between 1 and 200 then raise exception 'Write a task between 1 and 200 characters'; end if;
    if daily and due is null then due := date_trunc('day',now() at time zone 'Europe/Bucharest') at time zone 'Europe/Bucharest' + interval '9 hours';
      if due < now() then due := due + interval '1 day'; end if; end if;
    insert into public.foster_tasks(id,placement_id,title,assignee_id,due_at,created_by,repeat_daily)
      values(result,p.id,trim(data_input->>'title'),assignee,due,auth.uid(),daily);
    insert into public.foster_journal(placement_id,actor_id,event,body) values(p.id,auth.uid(),'TASK_CREATED',trim(data_input->>'title'));
    if case_side then perform public.foster_alert(p.id,false,'New task',trim(data_input->>'title')); end if;
  end if;
  return result;
end $$;

-- One morning reminder per carer with what is due today.
create or replace function public.send_task_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; row record;
  day_end timestamptz := (date_trunc('day',now() at time zone 'Europe/Bucharest') + interval '1 day') at time zone 'Europe/Bucharest';
begin
  for row in
    select coalesce(t.assignee_id,h.profile_id) as profile_id,count(*)::integer as due,
      string_agg(distinct a.name,', ') as animals
    from public.foster_tasks t join public.foster_placements p on p.id = t.placement_id
    join public.foster_home_profiles h on h.id = p.home_id join public.animals a on a.id = p.animal_id
    where t.completed_at is null and t.due_at < day_end and p.status = 'IN_CARE'
    group by 1
  loop
    perform public.enqueue_push_notification(row.profile_id,'FOSTER_TASKS_TODAY',jsonb_build_object('kind','TASKS'),
      'Care today',row.due || case when row.due = 1 then ' task today for ' else ' tasks today for ' end || row.animals || '.');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.send_task_reminders() from public,anon,authenticated;
grant execute on function public.send_task_reminders() to service_role;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('petpal-task-reminders','0 6 * * *','select public.send_task_reminders()');
exception when others then raise notice 'pg_cron unavailable; call public.send_task_reminders() each morning from a scheduler';
end $$;

notify pgrst, 'reload schema';
