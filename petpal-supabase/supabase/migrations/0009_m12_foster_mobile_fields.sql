alter table public.animal_listings
  add column if not exists foster_urgency text check (foster_urgency is null or foster_urgency in ('LOW', 'MEDIUM', 'HIGH')),
  add column if not exists foster_duration text check (foster_duration is null or foster_duration in ('FEW_DAYS', 'ONE_TWO_WEEKS', 'ONE_MONTH', 'UNTIL_ADOPTION', 'UNKNOWN')),
  add column if not exists food_covered boolean,
  add column if not exists vet_covered boolean,
  add column if not exists transport_available boolean,
  add column if not exists good_with_children boolean,
  add column if not exists good_with_other_animals boolean,
  add column if not exists medical_needs text,
  add column if not exists home_fit text;

drop view if exists public.discovery_listings_view;

create view public.discovery_listings_view as
select
  l.id as listing_id,
  l.mode,
  l.title,
  l.description,
  l.city,
  l.coarse_area,
  l.expires_at,
  l.foster_urgency,
  l.foster_duration,
  l.food_covered,
  l.vet_covered,
  l.transport_available,
  l.good_with_children,
  l.good_with_other_animals,
  l.medical_needs,
  l.home_fit,
  a.id as animal_id,
  a.name as animal_name,
  a.species,
  a.breed_or_mix,
  a.approximate_age_months,
  a.size_label,
  a.sex,
  a.temperament,
  a.public_health_summary,
  o.id as organization_id,
  o.name as organization_name,
  o.verification_status as organization_verification_status,
  (
    select ap.public_url
    from public.animal_photos ap
    where ap.animal_id = a.id
    order by ap.is_primary desc, ap.sort_order asc, ap.created_at asc
    limit 1
  ) as primary_photo_url
from public.animal_listings l
join public.animals a on a.id = l.animal_id
join public.organizations o on o.id = l.organization_id
where l.status = 'ACTIVE'
  and l.mode in ('ADOPT', 'FOSTER');

grant select on public.discovery_listings_view to anon, authenticated;

drop view if exists public.my_applications_view;

create view public.my_applications_view as
select
  app.id as application_id,
  app.status,
  app.created_at,
  app.reviewed_at,
  app.review_note,
  l.id as listing_id,
  l.mode,
  l.title,
  a.name as animal_name,
  a.species,
  o.name as organization_name
from public.applications app
join public.animal_listings l on l.id = app.listing_id
join public.animals a on a.id = l.animal_id
join public.organizations o on o.id = l.organization_id
where app.applicant_id = auth.uid();

grant select on public.my_applications_view to authenticated;

drop view if exists public.my_conversations_view;

create view public.my_conversations_view as
select
  c.id as conversation_id,
  c.application_id,
  app.status as application_status,
  l.id as listing_id,
  l.mode,
  l.title,
  l.city,
  l.coarse_area,
  a.name as animal_name,
  o.name as organization_name,
  o.verification_status as organization_verification_status,
  c.created_at,
  (
    select string_agg(p.display_name, ', ' order by p.display_name)
    from public.conversation_participants cp_other
    join public.profiles p on p.id = cp_other.profile_id
    where cp_other.conversation_id = c.id
      and cp_other.profile_id <> auth.uid()
  ) as other_participants,
  (
    select m.body
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) as last_message_body,
  (
    select m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) as last_message_at
from public.conversations c
join public.conversation_participants cp on cp.conversation_id = c.id
join public.applications app on app.id = c.application_id
join public.animal_listings l on l.id = app.listing_id
join public.animals a on a.id = l.animal_id
join public.organizations o on o.id = l.organization_id
where cp.profile_id = auth.uid()
  and app.status = 'ACCEPTED';

grant select on public.my_conversations_view to authenticated;
