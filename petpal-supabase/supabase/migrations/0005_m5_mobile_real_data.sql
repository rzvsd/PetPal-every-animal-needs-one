create or replace view public.discovery_listings_view as
select
  l.id as listing_id,
  l.mode,
  l.title,
  l.description,
  l.city,
  l.coarse_area,
  l.expires_at,
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

create or replace view public.my_applications_view as
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

create or replace view public.organization_applications_inbox_view as
select
  app.id as application_id,
  app.status,
  app.created_at,
  app.reviewed_at,
  app.housing_type,
  app.animal_experience,
  app.other_pets,
  app.children_in_home,
  app.landlord_approval,
  app.motivation,
  p.display_name as applicant_display_name,
  p.city as applicant_city,
  p.coarse_area as applicant_coarse_area,
  l.id as listing_id,
  l.mode,
  l.title,
  a.name as animal_name,
  a.species,
  o.id as organization_id,
  o.name as organization_name
from public.applications app
join public.profiles p on p.id = app.applicant_id
join public.animal_listings l on l.id = app.listing_id
join public.animals a on a.id = l.animal_id
join public.organizations o on o.id = l.organization_id
where public.is_listing_org_member(l.id)
  or public.is_admin();

grant select on public.my_applications_view to authenticated;
grant select on public.organization_applications_inbox_view to authenticated;

alter function public.submit_adoption_foster_application(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
) security definer;
