alter table public.applications
  add column reviewed_by uuid references public.profiles(id),
  add column reviewed_at timestamptz,
  add column review_note text,
  add constraint applications_unique_applicant_listing unique (listing_id, applicant_id);

create or replace view public.discovery_listings_view
with (security_invoker = true) as
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

create or replace view public.my_applications_view
with (security_invoker = true) as
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

create or replace view public.organization_applications_inbox_view
with (security_invoker = true) as
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

grant select on public.discovery_listings_view to anon, authenticated;
grant select on public.my_applications_view to authenticated;
grant select on public.organization_applications_inbox_view to authenticated;

create or replace function public.submit_adoption_foster_application(
  listing_id_input uuid,
  housing_type_input text,
  animal_experience_input text,
  other_pets_input text,
  children_in_home_input text,
  landlord_approval_input text,
  motivation_input text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  application_id_result uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.age_confirmed = true
  ) then
    raise exception 'Applicant must complete age confirmation before applying';
  end if;

  if not exists (
    select 1
    from public.animal_listings l
    where l.id = listing_id_input
      and l.status = 'ACTIVE'
      and l.mode in ('ADOPT', 'FOSTER')
  ) then
    raise exception 'Applications are only open for active Adopt/Foster listings';
  end if;

  insert into public.applications (
    listing_id,
    applicant_id,
    status,
    housing_type,
    animal_experience,
    other_pets,
    children_in_home,
    landlord_approval,
    motivation
  )
  values (
    listing_id_input,
    auth.uid(),
    'SUBMITTED',
    housing_type_input,
    animal_experience_input,
    other_pets_input,
    children_in_home_input,
    landlord_approval_input,
    motivation_input
  )
  returning id into application_id_result;

  insert into public.application_status_history (
    application_id,
    from_status,
    to_status,
    changed_by,
    reason
  )
  values (
    application_id_result,
    null,
    'SUBMITTED',
    auth.uid(),
    'Application submitted'
  );

  return application_id_result;
end;
$$;

create or replace function public.set_application_review_status(
  application_id_input uuid,
  target_status_input public.application_status,
  review_note_input text
)
returns public.applications
language plpgsql
security invoker
set search_path = public
as $$
declare
  previous_status public.application_status;
  updated_application public.applications;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if target_status_input not in ('IN_REVIEW', 'ACCEPTED', 'REJECTED') then
    raise exception 'Unsupported application review status';
  end if;

  select app.status into previous_status
  from public.applications app
  where app.id = application_id_input
    and (public.is_listing_org_member(app.listing_id) or public.is_admin());

  if previous_status is null then
    raise exception 'Application not found or not reviewable';
  end if;

  update public.applications
  set status = target_status_input,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = review_note_input,
      updated_at = now()
  where id = application_id_input
  returning * into updated_application;

  insert into public.application_status_history (
    application_id,
    from_status,
    to_status,
    changed_by,
    reason
  )
  values (
    application_id_input,
    previous_status,
    target_status_input,
    auth.uid(),
    review_note_input
  );

  return updated_application;
end;
$$;

