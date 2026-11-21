-- 0039: a foster home can link its own web page.

alter table public.foster_home_profiles add column website text;

-- Accepts "example.ro", "www.example.ro/page" or a full http(s) address.
-- Anything else (other schemes, spaces, no dot in the host) is refused so the
-- link shown to others can only open a normal web page.
create function public.normalize_home_website(input text)
returns text language plpgsql immutable set search_path = public as $$
declare v text := trim(coalesce(input,''));
begin
  if v = '' then return null; end if;
  if v !~* '^https?://' then
    if v ~ '^[a-zA-Z][a-zA-Z0-9+.-]*:' and v !~ '^[^:/]+:[0-9]+' then raise exception 'Website must be a web address'; end if;
    v := 'https://' || v;
  end if;
  if char_length(v) > 200 or v !~* '^https?://[a-z0-9-]+(\.[a-z0-9-]+)+(:[0-9]{1,5})?([/?#][^[:space:]<>"]*)?$' then
    raise exception 'Website must be a web address';
  end if;
  return v;
end $$;
revoke all on function public.normalize_home_website(text) from public,anon,authenticated;

alter table public.foster_home_profiles add constraint foster_home_website_valid
  check (website is null or (char_length(website) <= 200 and website ~* '^https?://'));

create or replace function public.save_foster_home(home_id_input uuid, data_input jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare result uuid := coalesce(home_id_input,gen_random_uuid()); current_home public.foster_home_profiles;
  site text := public.normalize_home_website(data_input->>'website');
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
    availability_status,bio,accepts_species,housing_type,experience_summary,photos,website)
  values(result,auth.uid(),trim(data_input->>'name'),trim(data_input->>'city'),trim(coalesce(data_input->>'area','')),
    coalesce((data_input->>'published')::boolean,false),coalesce((data_input->>'capacity')::integer,0),
    (nullif(data_input->>'dogCapacity',''))::integer,(nullif(data_input->>'catCapacity',''))::integer,
    coalesce(data_input->>'availability','LIMITED'),coalesce(data_input->>'bio',''),
    array(select jsonb_array_elements_text(coalesce(data_input->'species','["DOG","CAT"]'::jsonb)))::public.species[],
    coalesce(data_input->>'housingType',''),coalesce(data_input->>'experience',''),
    array(select jsonb_array_elements_text(coalesce(data_input->'photos','[]'::jsonb))),site)
  on conflict (id) do update set name = excluded.name,city = excluded.city,area = excluded.area,
    published = excluded.published,max_animals_at_once = excluded.max_animals_at_once,dog_capacity = excluded.dog_capacity,
    cat_capacity = excluded.cat_capacity,availability_status = excluded.availability_status,bio = excluded.bio,
    accepts_species = excluded.accepts_species,housing_type = excluded.housing_type,experience_summary = excluded.experience_summary,
    photos = excluded.photos,
    website = case when data_input ? 'website' then excluded.website else foster_home_profiles.website end,updated_at = clock_timestamp();
  return result;
end $$;

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
    (select o.created_at from profiles o where o.id = h.profile_id) AS owner_since,
    website
   FROM foster_home_profiles h
  WHERE ((auth.uid() IS NOT NULL) AND ((foster_home_role(id) IS NOT NULL) OR (published AND foster_actor_active(profile_id) AND (NOT is_profile_blocked_between(auth.uid(), profile_id)))));
