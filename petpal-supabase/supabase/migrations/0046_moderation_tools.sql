-- Moderation tools (pilot list item 3).
-- Moderators can hide a foster home or a single review, suspend an account for
-- 7 or 30 days (or until restored), and a suspended person sees why they
-- cannot use PetPal instead of a broken app.

alter table public.foster_home_profiles add column moderation_hidden boolean not null default false;
alter table public.foster_home_reviews add column hidden_at timestamptz;

-- Hidden homes leave the public directory; their own team still sees them,
-- with the flag, so the app can say why. Hidden reviews stop counting.
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
          WHERE ((r.foster_home_profile_id = h.id) AND (r.placement_id IS NOT NULL) AND (r.reviewer_id <> h.profile_id) AND (r.hidden_at IS NULL))) AS rating,
    ( SELECT (count(*))::integer AS count
           FROM foster_home_reviews r
          WHERE ((r.foster_home_profile_id = h.id) AND (r.placement_id IS NOT NULL) AND (r.reviewer_id <> h.profile_id) AND (r.hidden_at IS NULL))) AS review_count,
    (select o.display_name from profiles o where o.id = h.profile_id) AS owner_name,
    (select o.created_at from profiles o where o.id = h.profile_id) AS owner_since,
    website,
    moderation_hidden
   FROM foster_home_profiles h
  WHERE ((auth.uid() IS NOT NULL) AND ((foster_home_role(id) IS NOT NULL) OR (published AND NOT moderation_hidden AND foster_actor_active(profile_id) AND (NOT is_profile_blocked_between(auth.uid(), profile_id)))));

create or replace view public.foster_reviews_view as
select r.id,r.foster_home_profile_id as home_id,r.placement_id,r.reviewer_id,r.rating,r.comment,r.created_at,p.display_name as author_name
from public.foster_home_reviews r join public.profiles p on p.id = r.reviewer_id
join public.foster_home_profiles h on h.id = r.foster_home_profile_id
where r.placement_id is not null and r.reviewer_id <> h.profile_id and r.hidden_at is null and auth.uid() is not null
  and exists(select 1 from public.foster_homes_directory d where d.id = r.foster_home_profile_id);

-- A hidden home cannot start new requests (apply or be invited) until restored.
create or replace function public.reject_hidden_home_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists(select 1 from public.foster_home_profiles h where h.id = new.home_id and h.moderation_hidden) then
    raise exception 'This foster home is hidden by PetPal moderation. Contact support.';
  end if;
  return new;
end $$;
revoke all on function public.reject_hidden_home_request() from public, anon, authenticated;
create trigger reject_hidden_home_request before insert on public.foster_requests
  for each row execute function public.reject_hidden_home_request();

-- What moderators work from.
create or replace view public.platform_homes_view as
select h.id,h.name,h.city,h.profile_id,p.display_name as owner_name,h.published,h.moderation_hidden,h.updated_at,
  (select count(*)::integer from public.foster_home_reviews r where r.foster_home_profile_id = h.id and r.placement_id is not null) as review_count
from public.foster_home_profiles h left join public.profiles p on p.id = h.profile_id
where public.has_admin_role('MODERATOR') or public.has_admin_role('SUPER_ADMIN');

create or replace view public.platform_reviews_view as
select r.id,r.foster_home_profile_id as home_id,h.name as home_name,r.reviewer_id,p.display_name as author_name,
  r.rating,r.comment,r.created_at,r.hidden_at
from public.foster_home_reviews r join public.foster_home_profiles h on h.id = r.foster_home_profile_id
left join public.profiles p on p.id = r.reviewer_id
where r.placement_id is not null and (public.has_admin_role('MODERATOR') or public.has_admin_role('SUPER_ADMIN'));

create or replace view public.platform_accounts_view as
select p.id,p.display_name,p.city,p.updated_at,ar.role,not public.foster_actor_active(p.id) as suspended,
  (select max(s.ends_at) from public.user_suspensions s where s.profile_id = p.id and s.starts_at <= now()
     and (s.ends_at is null or s.ends_at > now())
     and not exists(select 1 from public.user_suspensions o where o.profile_id = p.id and o.starts_at <= now() and o.ends_at is null)) as suspended_until
from public.profiles p left join public.admin_roles ar on ar.profile_id = p.id
where public.has_admin_role('MODERATOR') or public.has_admin_role('SUPER_ADMIN');

grant select on public.platform_homes_view, public.platform_reviews_view, public.platform_accounts_view to authenticated;

-- The suspended person's own status. The moderator's note stays internal.
create or replace function public.my_suspension()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null or public.foster_actor_active(auth.uid()) then null
    else jsonb_build_object('endsAt', (
      select case when bool_or(s.ends_at is null) then null else max(s.ends_at) end
      from public.user_suspensions s where s.profile_id = auth.uid() and s.starts_at <= now()
        and (s.ends_at is null or s.ends_at > now()))) end;
$$;
revoke all on function public.my_suspension() from public, anon;
grant execute on function public.my_suspension() to authenticated;

create or replace function public.moderate_platform(kind_input text,item_id_input uuid,action_input text,expected_updated_at_input timestamptz,reason_input text)
returns void language plpgsql security definer set search_path = public as $$
declare report_row public.reports; profile_row public.profiles; listing_row public.animal_listings;
  home_row public.foster_home_profiles; review_row public.foster_home_reviews; ends_at_value timestamptz; suspension_id uuid;
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
    if action_input in ('SUSPEND','SUSPEND_7','SUSPEND_30') then
      ends_at_value := case action_input when 'SUSPEND_7' then now() + interval '7 days'
        when 'SUSPEND_30' then now() + interval '30 days' end;
      -- A new decision replaces the current one, so a 7-day suspension can become permanent and back.
      update public.user_suspensions set ends_at = now()
        where profile_id = item_id_input and starts_at <= now() and (ends_at is null or ends_at > now());
      insert into public.user_suspensions(profile_id,suspended_by,reason,ends_at)
        values(item_id_input,auth.uid(),trim(reason_input),ends_at_value) returning id into suspension_id;
      insert into public.moderation_actions(actor_id,action,profile_id,notes)
        values(auth.uid(),'USER_SUSPENDED',item_id_input,trim(reason_input));
      perform public.enqueue_push_notification(item_id_input,'MODERATION_DECISION',
        jsonb_build_object('kind','USER_SUSPENSION','suspensionId',suspension_id,'endsAt',ends_at_value),
        'Account safety update','A PetPal moderation decision was applied to your account.');
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
  elsif kind_input = 'HOME' then
    select * into home_row from public.foster_home_profiles where id = item_id_input for update;
    if home_row.id is null or home_row.updated_at is distinct from expected_updated_at_input then raise exception 'Home changed. Reload before deciding.'; end if;
    if action_input not in ('HIDE','RESTORE') then raise exception 'Invalid home action'; end if;
    update public.foster_home_profiles set moderation_hidden = (action_input = 'HIDE'), updated_at = clock_timestamp() where id = item_id_input;
    perform public.enqueue_push_notification(home_row.profile_id,'MODERATION_DECISION',
      jsonb_build_object('kind', case when action_input = 'HIDE' then 'HOME_HIDDEN' else 'HOME_RESTORED' end,'homeId',home_row.id),
      'Account safety update',
      case when action_input = 'HIDE' then 'A PetPal moderator hid your foster home from the directory.'
        else 'Your foster home is visible in the directory again.' end);
  elsif kind_input = 'REVIEW' then
    select * into review_row from public.foster_home_reviews where id = item_id_input for update;
    if review_row.id is null then raise exception 'Review not found'; end if;
    if action_input not in ('HIDE','RESTORE') then raise exception 'Invalid review action'; end if;
    update public.foster_home_reviews set hidden_at = case when action_input = 'HIDE' then coalesce(hidden_at, clock_timestamp()) end
      where id = item_id_input;
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
revoke all on function public.moderate_platform(text,uuid,text,timestamptz,text) from public,anon;
grant execute on function public.moderate_platform(text,uuid,text,timestamptz,text) to authenticated;

notify pgrst, 'reload schema';
