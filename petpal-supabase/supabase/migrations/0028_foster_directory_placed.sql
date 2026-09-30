-- An animal whose case was accepted (reserved or in care through a request on
-- this case) no longer needs a home, so it leaves the public directory. Its
-- owner still sees the case, with `placed` set. Transfer cases for an animal
-- still in care elsewhere stay visible: that placement came from another case.
create or replace view public.foster_cases_directory as
select l.id, l.animal_id, l.responsible_id, l.organization_id, l.status, l.description, l.city,
  l.coarse_area as area, l.foster_urgency as urgency, l.foster_duration as duration,
  l.food_covered, l.vet_covered, l.transport_available, l.medical_needs, l.home_fit,
  l.created_at, l.updated_at, a.name, a.species, a.sex, a.breed_or_mix as breed,
  a.approximate_age_months as age_months, a.size_label,
  coalesce(a.photo_url, (select ap.public_url from public.animal_photos ap where ap.animal_id = a.id order by ap.sort_order limit 1)) as photo,
  p.display_name as responsible_name, o.name as organization_name,
  exists (
    select 1 from public.foster_requests r
    join public.foster_placements fp on fp.request_id = r.id
    where r.case_id = l.id and fp.status in ('RESERVED', 'IN_CARE')
  ) as placed
from public.animal_listings l
join public.animals a on a.id = l.animal_id
join public.profiles p on p.id = l.responsible_id
left join public.organizations o on o.id = l.organization_id
where l.mode = 'FOSTER'::public.petpal_mode
  and auth.uid() is not null
  and (
    l.responsible_id = auth.uid()
    or (
      l.status = 'ACTIVE'::public.listing_status
      and public.foster_actor_active(l.responsible_id)
      and not public.is_profile_blocked_between(auth.uid(), l.responsible_id)
      and not exists (
        select 1 from public.foster_requests r
        join public.foster_placements fp on fp.request_id = r.id
        where r.case_id = l.id and fp.status in ('RESERVED', 'IN_CARE')
      )
    )
  );
