-- Compact stable identifiers; capacity and review counts remain participant facts.
alter table public.animals add column foster_number bigint generated always as identity unique;
alter table public.animal_listings add column moderation_hold boolean not null default false;
-- Event ordering must reflect each statement, including multiple actions in one transaction.
alter table public.foster_journal alter column created_at set default clock_timestamp();
alter table public.foster_request_events alter column created_at set default clock_timestamp();

create function public.protect_moderated_listing()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.moderation_hold is distinct from old.moderation_hold or
      (old.moderation_hold and new.status <> 'PAUSED')) and
      not (public.has_admin_role('MODERATOR') or public.has_admin_role('SUPER_ADMIN')) then
    raise exception 'This listing is hidden by platform moderation. Contact support.';
  end if;
  return new;
end $$;
create trigger protect_moderated_listing before update on public.animal_listings
  for each row execute function public.protect_moderated_listing();

create or replace function public.moderate_platform(kind_input text,item_id_input uuid,action_input text,expected_updated_at_input timestamptz,reason_input text)
returns void language plpgsql security definer set search_path = public as $$
declare report_row public.reports; profile_row public.profiles; listing_row public.animal_listings; target_status text;
begin
  if not (public.has_admin_role('MODERATOR') or public.has_admin_role('SUPER_ADMIN')) or not public.foster_actor_active(auth.uid()) then
    raise exception 'Platform moderator required'; end if;
  if char_length(trim(coalesce(reason_input,''))) not between 1 and 2000 then raise exception 'A moderation reason is required'; end if;
  if kind_input = 'REPORT' then
    select * into report_row from public.reports where id = item_id_input for update;
    if report_row.id is null or report_row.updated_at is distinct from expected_updated_at_input then raise exception 'Report changed. Reload before deciding.'; end if;
    if action_input not in ('IN_REVIEW','RESOLVED','DISMISSED') then raise exception 'Invalid report action'; end if;
    perform public.admin_resolve_report(item_id_input,action_input,reason_input);
    update public.reports set updated_at = clock_timestamp() where id = item_id_input;
  elsif kind_input = 'ACCOUNT' then
    select * into profile_row from public.profiles where id = item_id_input for update;
    if profile_row.id is null or profile_row.updated_at is distinct from expected_updated_at_input then raise exception 'Account changed. Reload before deciding.'; end if;
    if item_id_input = auth.uid() then raise exception 'Cannot moderate your own account'; end if;
    if exists(select 1 from public.admin_roles where profile_id = item_id_input and role = 'SUPER_ADMIN') then raise exception 'Cannot suspend a super administrator'; end if;
    if action_input = 'SUSPEND' then
      if public.foster_actor_active(item_id_input) then perform public.admin_suspend_profile(item_id_input,reason_input,null); end if;
    elsif action_input = 'RESTORE' then
      update public.user_suspensions set ends_at = now() where profile_id = item_id_input and starts_at <= now() and (ends_at is null or ends_at > now());
    else raise exception 'Invalid account action'; end if;
    update public.profiles set updated_at = clock_timestamp() where id = item_id_input;
  elsif kind_input = 'LISTING' then
    select * into listing_row from public.animal_listings where id = item_id_input for update;
    if listing_row.id is null or listing_row.updated_at is distinct from expected_updated_at_input then raise exception 'Listing changed. Reload before deciding.'; end if;
    if action_input not in ('PAUSE','RESTORE') then raise exception 'Invalid listing action'; end if;
    update public.animal_listings set status = case when action_input = 'PAUSE' then 'PAUSED'::public.listing_status else 'ACTIVE'::public.listing_status end,
      moderation_hold = (action_input = 'PAUSE'), updated_at = clock_timestamp() where id = item_id_input;
    insert into public.listing_status_history(listing_id,from_status,to_status,changed_by,reason)
      values(item_id_input,listing_row.status,case when action_input = 'PAUSE' then 'PAUSED'::public.listing_status else 'ACTIVE'::public.listing_status end,auth.uid(),reason_input);
  elsif kind_input = 'ROLE' then
    if not public.has_admin_role('SUPER_ADMIN') or item_id_input = auth.uid() then raise exception 'Super admin required; cannot edit your own role'; end if;
    select * into profile_row from public.profiles where id = item_id_input for update;
    if profile_row.id is null or profile_row.updated_at is distinct from expected_updated_at_input then raise exception 'Account changed. Reload before deciding.'; end if;
    if exists(select 1 from public.admin_roles where profile_id = item_id_input and role = 'SUPER_ADMIN') then raise exception 'Cannot replace a super administrator'; end if;
    if action_input = 'GRANT_MODERATOR' then
      insert into public.admin_roles(profile_id,role) values(item_id_input,'MODERATOR') on conflict(profile_id) do update set role = 'MODERATOR';
    elsif action_input = 'REVOKE_MODERATOR' then
      delete from public.admin_roles where profile_id = item_id_input and role = 'MODERATOR';
    else raise exception 'Invalid role action'; end if;
    update public.profiles set updated_at = clock_timestamp() where id = item_id_input;
  else raise exception 'Unknown moderation target'; end if;
  insert into public.audit_logs(actor_id,action,target_table,target_id,metadata)
    values(auth.uid(),kind_input || '_' || action_input,lower(kind_input),item_id_input,jsonb_build_object('reason',trim(reason_input),'boundary','Platform moderation, not animal certification'));
end $$;

create or replace view public.foster_registry_view as
select p.*,a.name,a.species,a.sex,coalesce(a.photo_url,(select ap.public_url from public.animal_photos ap
  where ap.animal_id = a.id order by ap.sort_order limit 1)) as photo,
  'F-' || a.foster_number::text as animal_code,s.name as space_name,s.isolation,
  person.display_name as carer_name,h.name as home_name,h.profile_id as home_owner_id,
  (select c.id from public.conversations c where c.foster_request_id = p.request_id) as conversation_id,
  (select count(*)::integer from public.foster_tasks t where t.placement_id = p.id and t.completed_at is null and t.due_at <= now()) as overdue_tasks
from public.foster_placements p join public.animals a on a.id = p.animal_id
join public.foster_home_profiles h on h.id = p.home_id left join public.foster_spaces s on s.id = p.space_id
left join public.profiles person on person.id = p.carer_id where public.foster_placement_visible(p.id);

create or replace view public.foster_homes_directory as
select h.id,h.profile_id,h.name,h.city,h.area,h.max_animals_at_once as capacity,h.dog_capacity,h.cat_capacity,
  h.availability_status as availability,h.accepts_species as species,h.bio,h.photos,h.housing_type,
  h.experience_summary as experience,h.published,h.updated_at,public.foster_home_role(h.id) as my_role,
  (select count(*)::integer from public.foster_placements p where p.home_id = h.id and p.status = 'IN_CARE') as occupied,
  (select count(*)::integer from public.foster_placements p where p.home_id = h.id and p.status = 'RESERVED') as reserved,
  (select count(*)::integer from public.foster_placements p where p.home_id = h.id and p.status = 'COMPLETED' and p.request_id is not null) as completed_placements,
  (select round(avg(r.rating),1) from public.foster_home_reviews r where r.foster_home_profile_id = h.id and r.placement_id is not null and r.reviewer_id <> h.profile_id) as rating,
  (select count(*)::integer from public.foster_home_reviews r where r.foster_home_profile_id = h.id and r.placement_id is not null and r.reviewer_id <> h.profile_id) as review_count
from public.foster_home_profiles h where auth.uid() is not null and (public.foster_home_role(h.id) is not null or
  (h.published and public.foster_actor_active(h.profile_id) and not public.is_profile_blocked_between(auth.uid(),h.profile_id)));

-- Route platform decisions through the versioned, reason-required RPC, including administrator clients.
revoke insert,update,delete on public.admin_roles,public.user_suspensions,public.audit_logs,public.animal_listings,public.animals from anon,authenticated;
revoke update,delete on public.reports from anon,authenticated;
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in
    ('submit_organization_verification','submit_listing_for_review','create_animal_listing_draft') loop
    execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
  end loop;
end $$;
-- Each completed placement has its own review; keep the old uniqueness rule only for historical reviews.
alter table public.foster_home_reviews drop constraint foster_home_reviews_foster_home_profile_id_foster_case_id_r_key;
create unique index foster_legacy_review_author on public.foster_home_reviews(foster_home_profile_id,foster_case_id,reviewer_id) where placement_id is null;
notify pgrst, 'reload schema';
