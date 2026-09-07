-- Participant-led care. Historical verification records are retained, never used as approval.
alter table public.foster_home_profiles
  drop constraint foster_home_profiles_profile_id_key,
  drop constraint foster_home_profiles_max_animals_at_once_check,
  add constraint foster_declared_capacity_check check (max_animals_at_once >= 0),
  add column name text not null default '',
  add column city text not null default '',
  add column area text not null default '',
  add column published boolean not null default false,
  add column dog_capacity integer check (dog_capacity >= 0),
  add column cat_capacity integer check (cat_capacity >= 0);
update public.foster_home_profiles h set name = p.display_name, city = coalesce(p.city,''),
  area = coalesce(p.coarse_area,''), published = true from public.profiles p where p.id = h.profile_id;

alter table public.animals alter column organization_id drop not null,
  add column responsible_id uuid references public.profiles(id),
  add column owner_animal_profile_id uuid unique references public.owner_animal_profiles(id) on delete set null,
  add column photo_url text;
update public.animals a set responsible_id = o.created_by from public.organizations o where o.id = a.organization_id;
alter table public.animal_listings alter column organization_id drop not null,
  add column responsible_id uuid references public.profiles(id);
update public.animal_listings l set responsible_id = o.created_by from public.organizations o where o.id = l.organization_id;

create table public.foster_home_members (
  home_id uuid not null references public.foster_home_profiles(id),
  profile_id uuid not null references public.profiles(id),
  role text not null check (role in ('CARER','READER')),
  status text not null default 'INVITED' check (status in ('INVITED','ACTIVE','DECLINED','REVOKED')),
  invited_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (home_id,profile_id)
);
create table public.foster_spaces (
  id uuid primary key default gen_random_uuid(), home_id uuid not null references public.foster_home_profiles(id),
  name text not null check (char_length(trim(name)) between 1 and 80),
  isolation boolean not null default false, unique(home_id,name)
);
create table public.foster_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.animal_listings(id),
  home_id uuid not null references public.foster_home_profiles(id),
  created_by uuid not null references public.profiles(id),
  sender_id uuid not null references public.profiles(id),
  recipient_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('APPLICATION','INVITE')),
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','DECLINED','WITHDRAWN','CANCELLED','COMPLETED')),
  message text not null default '' check (char_length(message) <= 4000),
  legacy_application_id uuid unique references public.applications(id),
  legacy_invite_id uuid unique references public.foster_invites(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create unique index foster_request_active_pair on public.foster_requests(case_id,home_id)
  where status in ('PENDING','ACCEPTED');
create table public.foster_placements (
  id uuid primary key default gen_random_uuid(), animal_id uuid not null references public.animals(id),
  home_id uuid not null references public.foster_home_profiles(id),
  request_id uuid unique references public.foster_requests(id),
  previous_placement_id uuid references public.foster_placements(id),
  status text not null check (status in ('RESERVED','IN_CARE','COMPLETED','CANCELLED')),
  provenance text not null check (char_length(trim(provenance)) between 1 and 2000),
  space_id uuid references public.foster_spaces(id), carer_id uuid references public.profiles(id),
  care_state text not null default 'NORMAL' check (care_state in ('NORMAL','ISOLATION','MEDICAL')),
  received_by uuid references public.profiles(id), received_at timestamptz, ended_at timestamptz,
  discrepancy boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index foster_one_current_home on public.foster_placements(animal_id) where status = 'IN_CARE';
create unique index foster_one_reservation on public.foster_placements(animal_id) where status = 'RESERVED';
create index foster_placements_home_idx on public.foster_placements(home_id,created_at desc,id);
alter table public.foster_requests add column previous_placement_id uuid references public.foster_placements(id);
create table public.foster_journal (
  id uuid primary key default gen_random_uuid(), placement_id uuid not null references public.foster_placements(id),
  actor_id uuid not null references public.profiles(id), event text not null,
  body text not null check (char_length(body) between 1 and 4000), created_at timestamptz not null default now()
);
create table public.foster_tasks (
  id uuid primary key default gen_random_uuid(), placement_id uuid not null references public.foster_placements(id),
  title text not null check (char_length(trim(title)) between 1 and 200),
  assignee_id uuid references public.profiles(id), due_at timestamptz,
  completed_at timestamptz, completed_by uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create index foster_tasks_placement_idx on public.foster_tasks(placement_id,due_at);
create table public.foster_request_events (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.foster_requests(id),
  actor_id uuid not null references public.profiles(id), event text not null, body text not null default '',
  created_at timestamptz not null default now()
);
create table public.foster_saved (
  profile_id uuid not null default auth.uid() references public.profiles(id),
  case_id uuid references public.animal_listings(id), home_id uuid references public.foster_home_profiles(id),
  check (num_nonnulls(case_id,home_id) = 1), unique(profile_id,case_id), unique(profile_id,home_id)
);
alter table public.foster_home_reviews add column placement_id uuid references public.foster_placements(id);
create unique index foster_placement_review_author on public.foster_home_reviews(placement_id,reviewer_id)
  where placement_id is not null;
alter table public.conversations add column foster_request_id uuid unique references public.foster_requests(id);
alter table public.conversations drop constraint conversations_context_check;
alter table public.conversations add constraint conversations_context_check check (
  (source = 'MATCH' and match_id is not null and application_id is null and foster_invite_id is null and foster_request_id is null)
  or (source = 'FOSTER' and match_id is null and (application_id is not null or foster_request_id is not null))
  or (source = 'FOSTER_INVITE' and match_id is null and foster_invite_id is not null)
);

create function public.foster_actor_active(profile_input uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select profile_input is not null and not exists (
    select 1 from public.user_suspensions where profile_id = profile_input
      and starts_at <= now() and (ends_at is null or ends_at > now()));
$$;
create function public.foster_home_role(home_input uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when h.profile_id = auth.uid() then 'OWNER' else (
    select m.role from public.foster_home_members m where m.home_id = h.id
      and m.profile_id = auth.uid() and m.status = 'ACTIVE') end
  from public.foster_home_profiles h where h.id = home_input;
$$;
create function public.foster_case_owner(case_input uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.animal_listings l where l.id = case_input and l.responsible_id = auth.uid());
$$;
create function public.foster_request_visible(request_input uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.foster_requests r where r.id = request_input
    and (auth.uid() in (r.sender_id,r.recipient_id) or public.foster_home_role(r.home_id) is not null));
$$;
create function public.foster_placement_visible(placement_input uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.foster_placements p where p.id = placement_input
    and (public.foster_home_role(p.home_id) is not null or exists(
      select 1 from public.foster_requests r where r.id = p.request_id and auth.uid() in (r.sender_id,r.recipient_id))));
$$;

alter table public.foster_home_members enable row level security;
alter table public.foster_spaces enable row level security;
alter table public.foster_requests enable row level security;
alter table public.foster_placements enable row level security;
alter table public.foster_journal enable row level security;
alter table public.foster_tasks enable row level security;
alter table public.foster_request_events enable row level security;
alter table public.foster_saved enable row level security;
create policy foster_team_read on public.foster_home_members for select to authenticated
  using(profile_id = auth.uid() or public.foster_home_role(home_id) is not null);
create policy foster_space_read on public.foster_spaces for select to authenticated using(public.foster_home_role(home_id) is not null);
create policy foster_request_read on public.foster_requests for select to authenticated using(public.foster_request_visible(id));
create policy foster_placement_read on public.foster_placements for select to authenticated using(public.foster_placement_visible(id));
create policy foster_journal_read on public.foster_journal for select to authenticated using(public.foster_placement_visible(placement_id));
create policy foster_task_read on public.foster_tasks for select to authenticated using(public.foster_placement_visible(placement_id));
create policy foster_event_read on public.foster_request_events for select to authenticated using(public.foster_request_visible(request_id));
create policy foster_saved_self on public.foster_saved for all to authenticated using(profile_id = auth.uid()) with check(profile_id = auth.uid());
drop policy foster_home_profiles_self_insert on public.foster_home_profiles;
drop policy foster_home_profiles_self_update on public.foster_home_profiles;
drop policy foster_home_profiles_self_read on public.foster_home_profiles;
create policy foster_home_team_read on public.foster_home_profiles for select to authenticated using(public.foster_home_role(id) is not null);

create function public.save_foster_home(home_id_input uuid, data_input jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare result uuid := coalesce(home_id_input,gen_random_uuid()); current_home public.foster_home_profiles;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  if char_length(trim(coalesce(data_input->>'name',''))) not between 1 and 100
    or char_length(trim(coalesce(data_input->>'city',''))) not between 1 and 100
    or char_length(coalesce(data_input->>'bio','')) > 4000 then raise exception 'Name, city and valid description are required'; end if;
  select * into current_home from public.foster_home_profiles where id = result for update;
  if found and current_home.profile_id <> auth.uid() then raise exception 'Only the home owner can edit this home'; end if;
  if current_home.id is not null and (data_input->>'expectedUpdatedAt')::timestamptz is distinct from current_home.updated_at then
    raise exception 'This home changed in another session. Reload before saving.'; end if;
  insert into public.foster_home_profiles(id,profile_id,name,city,area,published,max_animals_at_once,dog_capacity,cat_capacity,
    availability_status,bio,accepts_species,housing_type,experience_summary,photos)
  values(result,auth.uid(),trim(data_input->>'name'),trim(data_input->>'city'),trim(coalesce(data_input->>'area','')),
    coalesce((data_input->>'published')::boolean,false),coalesce((data_input->>'capacity')::integer,0),
    (nullif(data_input->>'dogCapacity',''))::integer,(nullif(data_input->>'catCapacity',''))::integer,
    coalesce(data_input->>'availability','LIMITED'),coalesce(data_input->>'bio',''),
    array(select jsonb_array_elements_text(coalesce(data_input->'species','["DOG","CAT"]'::jsonb)))::public.species[],
    coalesce(data_input->>'housingType',''),coalesce(data_input->>'experience',''),
    array(select jsonb_array_elements_text(coalesce(data_input->'photos','[]'::jsonb))))
  on conflict (id) do update set name = excluded.name,city = excluded.city,area = excluded.area,
    published = excluded.published,max_animals_at_once = excluded.max_animals_at_once,dog_capacity = excluded.dog_capacity,
    cat_capacity = excluded.cat_capacity,availability_status = excluded.availability_status,bio = excluded.bio,
    accepts_species = excluded.accepts_species,housing_type = excluded.housing_type,experience_summary = excluded.experience_summary,
    photos = excluded.photos,updated_at = clock_timestamp();
  return result;
end $$;

create function public.manage_foster_member(home_id_input uuid, profile_id_input uuid, action_input text, role_input text default 'CARER')
returns void language plpgsql security definer set search_path = public as $$
declare member public.foster_home_members;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  perform 1 from public.foster_home_profiles where id = home_id_input for update;
  if action_input in ('ACCEPT','DECLINE') then
    if profile_id_input <> auth.uid() then raise exception 'Only the invited person can respond'; end if;
    update public.foster_home_members set status = case when action_input = 'ACCEPT' then 'ACTIVE' else 'DECLINED' end,updated_at = now()
      where home_id = home_id_input and profile_id = auth.uid() and status = 'INVITED';
    if not found then raise exception 'Invitation is no longer pending'; end if;
  else
    if public.foster_home_role(home_id_input) is distinct from 'OWNER' then raise exception 'Only the home owner can manage members'; end if;
    if exists(select 1 from public.foster_home_profiles where id = home_id_input and profile_id = profile_id_input) then
      raise exception 'The owner cannot be changed here'; end if;
    if action_input = 'INVITE' then
      if not exists(select 1 from public.profiles where id = profile_id_input) then raise exception 'Member account not found'; end if;
      if public.is_profile_blocked_between(auth.uid(),profile_id_input) then raise exception 'Contact is blocked'; end if;
      insert into public.foster_home_members(home_id,profile_id,role,invited_by)
        values(home_id_input,profile_id_input,role_input,auth.uid()) on conflict(home_id,profile_id)
        do update set role = excluded.role,status = 'INVITED',invited_by = auth.uid(),updated_at = now();
      perform public.enqueue_push_notification(profile_id_input,'FOSTER_TEAM_INVITE',jsonb_build_object('homeId',home_id_input),
        'Foster team invitation','Open Foster to review a team invitation.');
    elsif action_input = 'REVOKE' then
      update public.foster_home_members set status = 'REVOKED',updated_at = now() where home_id = home_id_input and profile_id = profile_id_input;
      update public.foster_placements set carer_id = null where home_id = home_id_input and carer_id = profile_id_input;
      update public.foster_tasks t set assignee_id = null from public.foster_placements p
        where p.id = t.placement_id and p.home_id = home_id_input and t.assignee_id = profile_id_input;
    else raise exception 'Unsupported member action'; end if;
  end if;
end $$;

create function public.save_foster_space(home_id_input uuid,name_input text,isolation_input boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare result uuid;
begin
  if not public.foster_actor_active(auth.uid()) or public.foster_home_role(home_id_input) is distinct from 'OWNER' then
    raise exception 'Only the home owner can manage spaces'; end if;
  insert into public.foster_spaces(home_id,name,isolation) values(home_id_input,trim(name_input),isolation_input)
    on conflict(home_id,name) do update set isolation = excluded.isolation returning id into result;
  return result;
end $$;

-- Creation ids supplied by the client make retries safe. An existing identity is reused on subsequent cases.
create function public.save_foster_case(case_id_input uuid, animal_id_input uuid, data_input jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare case_result uuid := coalesce(case_id_input,gen_random_uuid()); animal_result uuid := coalesce(animal_id_input,gen_random_uuid());
  old_case public.animal_listings; animal_row public.animals; org_id uuid := nullif(data_input->>'organizationId','')::uuid;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  if char_length(trim(coalesce(data_input->>'name',''))) not between 1 and 80
    or char_length(trim(coalesce(data_input->>'description',''))) not between 1 and 4000
    or char_length(trim(coalesce(data_input->>'city',''))) not between 1 and 100 then
    raise exception 'Animal name, description and city are required'; end if;
  if org_id is not null and not exists(select 1 from public.organization_members where organization_id = org_id
    and profile_id = auth.uid() and role in ('OWNER','MANAGER')) then raise exception 'Organization access required'; end if;
  select * into old_case from public.animal_listings where id = case_result for update;
  if found then
    if old_case.responsible_id <> auth.uid() or old_case.mode <> 'FOSTER' then raise exception 'Case not editable'; end if;
    if (data_input->>'expectedUpdatedAt')::timestamptz is distinct from old_case.updated_at then
      raise exception 'This case changed in another session. Reload before saving.'; end if;
    animal_result := old_case.animal_id;
  end if;
  select * into animal_row from public.animals where id = animal_result for update;
  if found and animal_row.responsible_id <> auth.uid() and not exists(
    select 1 from public.foster_placements p where p.animal_id = animal_result and p.status = 'IN_CARE'
      and public.foster_home_role(p.home_id) = 'OWNER') then raise exception 'Animal not managed by this account'; end if;
  if animal_row.id is null then
    insert into public.animals(id,responsible_id,organization_id,name,species,sex,breed_or_mix,approximate_age_months,size_label,photo_url)
      values(animal_result,auth.uid(),org_id,trim(data_input->>'name'),(data_input->>'species')::public.species,
        coalesce(data_input->>'sex','UNKNOWN'),data_input->>'breed',nullif(data_input->>'ageMonths','')::integer,
        data_input->>'size',nullif(data_input->>'photo',''));
  elsif animal_row.responsible_id = auth.uid() then
    update public.animals set name = trim(data_input->>'name'),breed_or_mix = data_input->>'breed',
      approximate_age_months = nullif(data_input->>'ageMonths','')::integer,size_label = data_input->>'size',
      photo_url = nullif(data_input->>'photo',''),updated_at = now() where id = animal_result;
  end if;
  if coalesce(data_input->>'status','ACTIVE') not in ('ACTIVE','PAUSED','ARCHIVED') then raise exception 'Invalid case status'; end if;
  insert into public.animal_listings(id,animal_id,organization_id,responsible_id,mode,status,title,description,city,coarse_area,
    foster_urgency,foster_duration,food_covered,vet_covered,transport_available,medical_needs,home_fit)
  values(case_result,animal_result,org_id,auth.uid(),'FOSTER',coalesce(data_input->>'status','ACTIVE')::public.listing_status,
    trim(data_input->>'name'),trim(data_input->>'description'),trim(data_input->>'city'),coalesce(data_input->>'area',''),
    coalesce(data_input->>'urgency','MEDIUM'),coalesce(data_input->>'duration','UNKNOWN'),
    coalesce((data_input->>'foodCovered')::boolean,false),coalesce((data_input->>'vetCovered')::boolean,false),
    coalesce((data_input->>'transport')::boolean,false),coalesce(data_input->>'medicalNeeds',''),coalesce(data_input->>'homeFit',''))
  on conflict(id) do update set title = excluded.title,description = excluded.description,city = excluded.city,organization_id = excluded.organization_id,
    coarse_area = excluded.coarse_area,status = excluded.status,foster_urgency = excluded.foster_urgency,
    foster_duration = excluded.foster_duration,food_covered = excluded.food_covered,vet_covered = excluded.vet_covered,
    transport_available = excluded.transport_available,medical_needs = excluded.medical_needs,home_fit = excluded.home_fit,
    updated_at = clock_timestamp();
  return case_result;
end $$;

create function public.register_foster_animal(placement_id_input uuid, home_id_input uuid, data_input jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare result uuid := coalesce(placement_id_input,gen_random_uuid()); animal_result uuid;
  owner_animal public.owner_animal_profiles; existing public.foster_placements;
begin
  if not public.foster_actor_active(auth.uid()) or public.foster_home_role(home_id_input) is distinct from 'OWNER' then
    raise exception 'Only the home owner can register animals'; end if;
  select * into existing from public.foster_placements where id = result;
  if found then
    if existing.home_id <> home_id_input or existing.created_by <> auth.uid() then raise exception 'Request ID already used'; end if;
    return result;
  end if;
  if char_length(trim(coalesce(data_input->>'provenance',''))) not between 1 and 2000 then raise exception 'Declared origin is required'; end if;
  if nullif(data_input->>'ownerAnimalId','') is not null then
    select * into owner_animal from public.owner_animal_profiles where id = (data_input->>'ownerAnimalId')::uuid and owner_id = auth.uid() for update;
    if not found then raise exception 'Animal profile not owned by this account'; end if;
    select id into animal_result from public.animals where owner_animal_profile_id = owner_animal.id;
    if animal_result is null then
      insert into public.animals(responsible_id,owner_animal_profile_id,name,species,sex,breed_or_mix,approximate_age_months,size_label,photo_url)
        values(auth.uid(),owner_animal.id,owner_animal.name,owner_animal.species,owner_animal.sex,owner_animal.breed_or_mix,
          owner_animal.approximate_age_months,owner_animal.size_label,owner_animal.photo_urls[1]) returning id into animal_result;
    end if;
  else
    if char_length(trim(coalesce(data_input->>'name',''))) not between 1 and 80 then raise exception 'Animal name is required'; end if;
    insert into public.animals(responsible_id,name,species,sex,photo_url)
      values(auth.uid(),trim(data_input->>'name'),(data_input->>'species')::public.species,'UNKNOWN',nullif(data_input->>'photo',''))
      returning id into animal_result;
  end if;
  perform 1 from public.animals where id = animal_result for update;
  if exists(select 1 from public.foster_placements where animal_id = animal_result and status in ('RESERVED','IN_CARE')) then
    raise exception 'This animal already has an active placement'; end if;
  insert into public.foster_placements(id,animal_id,home_id,status,provenance,created_by,received_by,received_at)
    values(result,animal_result,home_id_input,'IN_CARE',trim(data_input->>'provenance'),auth.uid(),auth.uid(),now());
  insert into public.foster_journal(placement_id,actor_id,event,body)
    values(result,auth.uid(),'REGISTERED','Existing care declared by participant: ' || trim(data_input->>'provenance'));
  return result;
end $$;

-- Read models expose only what each screen needs; private care data stays behind membership checks.
create view public.foster_cases_directory as
select l.id,l.animal_id,l.responsible_id,l.organization_id,l.status,l.description,l.city,l.coarse_area as area,
  l.foster_urgency as urgency,l.foster_duration as duration,l.food_covered,l.vet_covered,l.transport_available,
  l.medical_needs,l.home_fit,l.created_at,l.updated_at,a.name,a.species,a.sex,a.breed_or_mix as breed,
  a.approximate_age_months as age_months,a.size_label,
  coalesce(a.photo_url,(select ap.public_url from public.animal_photos ap where ap.animal_id = a.id order by ap.sort_order limit 1)) as photo,
  p.display_name as responsible_name,o.name as organization_name
from public.animal_listings l join public.animals a on a.id = l.animal_id
join public.profiles p on p.id = l.responsible_id left join public.organizations o on o.id = l.organization_id
where l.mode = 'FOSTER' and auth.uid() is not null and (
  l.responsible_id = auth.uid() or (l.status = 'ACTIVE' and public.foster_actor_active(l.responsible_id)
    and not public.is_profile_blocked_between(auth.uid(),l.responsible_id)));

create view public.foster_homes_directory as
select h.id,h.profile_id,h.name,h.city,h.area,h.max_animals_at_once as capacity,h.dog_capacity,h.cat_capacity,
  h.availability_status as availability,h.accepts_species as species,h.bio,h.photos,h.housing_type,
  h.experience_summary as experience,h.published,h.updated_at,public.foster_home_role(h.id) as my_role,
  (select count(*)::integer from public.foster_placements p where p.home_id = h.id and p.status = 'IN_CARE') as occupied,
  (select count(*)::integer from public.foster_placements p where p.home_id = h.id and p.status = 'RESERVED') as reserved,
  (select count(*)::integer from public.foster_placements p where p.home_id = h.id and p.status = 'COMPLETED' and p.request_id is not null) as completed_placements,
  (select round(avg(r.rating),1) from public.foster_home_reviews r where r.foster_home_profile_id = h.id and r.placement_id is not null) as rating,
  (select count(*)::integer from public.foster_home_reviews r where r.foster_home_profile_id = h.id and r.placement_id is not null) as review_count
from public.foster_home_profiles h where auth.uid() is not null and (public.foster_home_role(h.id) is not null or
  (h.published and public.foster_actor_active(h.profile_id) and not public.is_profile_blocked_between(auth.uid(),h.profile_id)));

create view public.foster_team_view as
select m.home_id,m.profile_id,m.role,m.status,m.updated_at,p.display_name,h.name as home_name
from public.foster_home_members m join public.profiles p on p.id = m.profile_id join public.foster_home_profiles h on h.id = m.home_id
where m.profile_id = auth.uid() or public.foster_home_role(m.home_id) is not null
union all select h.id,h.profile_id,'OWNER','ACTIVE',h.updated_at,p.display_name,h.name
from public.foster_home_profiles h join public.profiles p on p.id = h.profile_id where public.foster_home_role(h.id) is not null;

create view public.foster_registry_view as
select p.*,a.name,a.species,a.sex,coalesce(a.photo_url,(select ap.public_url from public.animal_photos ap
  where ap.animal_id = a.id order by ap.sort_order limit 1)) as photo,
  'F-' || upper(replace(a.id::text,'-','')) as animal_code,s.name as space_name,s.isolation,
  person.display_name as carer_name,h.name as home_name,h.profile_id as home_owner_id,
  (select c.id from public.conversations c where c.foster_request_id = p.request_id) as conversation_id,
  (select count(*)::integer from public.foster_tasks t where t.placement_id = p.id and t.completed_at is null and t.due_at <= now()) as overdue_tasks
from public.foster_placements p join public.animals a on a.id = p.animal_id
join public.foster_home_profiles h on h.id = p.home_id left join public.foster_spaces s on s.id = p.space_id
left join public.profiles person on person.id = p.carer_id where public.foster_placement_visible(p.id);

create view public.foster_journal_view as
select j.*,p.display_name as actor_name from public.foster_journal j join public.profiles p on p.id = j.actor_id
where public.foster_placement_visible(j.placement_id);

grant select on public.foster_cases_directory,public.foster_homes_directory,public.foster_team_view,
  public.foster_registry_view,public.foster_journal_view to authenticated;
-- No direct client writes to operational records: all mutations validate identity, state and references.
revoke insert,update,delete on public.foster_home_profiles,public.foster_home_members,public.foster_spaces,
  public.foster_requests,public.foster_placements,public.foster_journal,public.foster_tasks,public.foster_request_events from anon,authenticated;
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace = 'public'::regnamespace and proname in
    ('foster_actor_active','foster_home_role','foster_case_owner','foster_request_visible','foster_placement_visible',
      'save_foster_home','manage_foster_member','save_foster_space','save_foster_case','register_foster_animal') loop
    execute format('revoke all on function %s from public, anon',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
