alter table public.animals
  add column public_health_summary text;

alter table public.animal_listings
  add column submitted_at timestamptz,
  add column archived_reason text,
  add constraint animal_listings_review_status_requires_submit check (
    status <> 'PENDING_REVIEW' or submitted_at is not null
  );

alter table public.animal_photos
  add column is_primary boolean not null default false,
  add column public_url text;

drop policy if exists animal_listings_org_member_manage on public.animal_listings;

create policy animal_listings_org_member_read
on public.animal_listings for select to authenticated
using (public.is_org_member(organization_id) or public.is_admin());

create policy animal_listings_org_member_insert_draft_or_review
on public.animal_listings for insert to authenticated
with check (
  public.is_org_member(organization_id)
  and status in ('DRAFT', 'PENDING_REVIEW')
);

create policy animal_listings_org_member_update_non_active
on public.animal_listings for update to authenticated
using (public.is_org_member(organization_id) and status in ('DRAFT', 'PENDING_REVIEW', 'PAUSED'))
with check (
  public.is_org_member(organization_id)
  and status in ('DRAFT', 'PENDING_REVIEW', 'PAUSED', 'ARCHIVED')
);

create policy animal_listings_admin_manage
on public.animal_listings for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.create_animal_listing_draft(
  organization_id_input uuid,
  animal_name_input text,
  species_input public.species,
  breed_or_mix_input text,
  approximate_age_months_input integer,
  size_label_input text,
  sex_input text,
  temperament_input text,
  public_health_summary_input text,
  private_notes_input text,
  mode_input public.petpal_mode,
  title_input text,
  description_input text,
  city_input text,
  coarse_area_input text,
  exact_location_input text,
  private_handover_notes_input text,
  submit_for_review_input boolean
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  animal_id_result uuid;
  listing_id_result uuid;
  target_status public.listing_status := 'DRAFT';
  target_submitted_at timestamptz := null;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_org_member(organization_id_input) then
    raise exception 'Only organization members can create animal listings';
  end if;

  if mode_input not in ('ADOPT', 'FOSTER') then
    raise exception 'Only Adopt and Foster listings are enabled for v1';
  end if;

  if submit_for_review_input then
    target_status := 'PENDING_REVIEW';
    target_submitted_at := now();
  end if;

  insert into public.animals (
    organization_id,
    name,
    species,
    breed_or_mix,
    approximate_age_months,
    size_label,
    sex,
    temperament,
    public_health_summary
  )
  values (
    organization_id_input,
    animal_name_input,
    species_input,
    breed_or_mix_input,
    approximate_age_months_input,
    size_label_input,
    sex_input,
    temperament_input,
    public_health_summary_input
  )
  returning id into animal_id_result;

  insert into public.animal_private_details (animal_id, private_notes)
  values (animal_id_result, private_notes_input);

  insert into public.animal_listings (
    animal_id,
    organization_id,
    mode,
    status,
    title,
    description,
    city,
    coarse_area,
    submitted_at
  )
  values (
    animal_id_result,
    organization_id_input,
    mode_input,
    target_status,
    title_input,
    description_input,
    city_input,
    coarse_area_input,
    target_submitted_at
  )
  returning id into listing_id_result;

  insert into public.listing_private_details (
    listing_id,
    exact_location,
    private_handover_notes
  )
  values (
    listing_id_result,
    exact_location_input,
    private_handover_notes_input
  );

  insert into public.listing_status_history (
    listing_id,
    from_status,
    to_status,
    changed_by,
    reason
  )
  values (
    listing_id_result,
    null,
    target_status,
    auth.uid(),
    case when submit_for_review_input then 'Submitted for review' else 'Draft created' end
  );

  return listing_id_result;
end;
$$;

create or replace function public.submit_listing_for_review(
  listing_id_input uuid
)
returns public.animal_listings
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_listing public.animal_listings;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.animal_listings
  set status = 'PENDING_REVIEW',
      submitted_at = coalesce(submitted_at, now()),
      updated_at = now()
  where id = listing_id_input
    and status = 'DRAFT'
    and public.is_org_member(organization_id)
  returning * into updated_listing;

  if updated_listing.id is null then
    raise exception 'Listing cannot be submitted for review';
  end if;

  insert into public.listing_status_history (
    listing_id,
    from_status,
    to_status,
    changed_by,
    reason
  )
  values (
    listing_id_input,
    'DRAFT',
    'PENDING_REVIEW',
    auth.uid(),
    'Submitted for review'
  );

  return updated_listing;
end;
$$;

create or replace function public.admin_set_listing_review_status(
  listing_id_input uuid,
  target_status_input public.listing_status,
  reason_input text
)
returns public.animal_listings
language plpgsql
security invoker
set search_path = public
as $$
declare
  previous_status public.listing_status;
  updated_listing public.animal_listings;
begin
  if not public.is_admin() then
    raise exception 'Admin role required';
  end if;

  if target_status_input not in ('ACTIVE', 'REJECTED', 'PAUSED', 'ARCHIVED') then
    raise exception 'Unsupported admin review target status';
  end if;

  select status into previous_status
  from public.animal_listings
  where id = listing_id_input;

  update public.animal_listings
  set status = target_status_input,
      reviewed_at = case when target_status_input in ('ACTIVE', 'REJECTED') then now() else reviewed_at end,
      reviewed_by = case when target_status_input in ('ACTIVE', 'REJECTED') then auth.uid() else reviewed_by end,
      updated_at = now()
  where id = listing_id_input
  returning * into updated_listing;

  if updated_listing.id is null then
    raise exception 'Listing not found';
  end if;

  insert into public.listing_status_history (
    listing_id,
    from_status,
    to_status,
    changed_by,
    reason
  )
  values (
    listing_id_input,
    previous_status,
    target_status_input,
    auth.uid(),
    reason_input
  );

  insert into public.audit_logs (
    actor_id,
    action,
    target_table,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    'LISTING_REVIEW_STATUS_CHANGED',
    'animal_listings',
    listing_id_input,
    jsonb_build_object('from_status', previous_status, 'to_status', target_status_input, 'reason', reason_input)
  );

  return updated_listing;
end;
$$;

