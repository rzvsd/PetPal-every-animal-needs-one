-- Preserve inbox wire shape while routing new and migrated Foster chats through their actual request.
create or replace view public.my_conversations_view as
with contexts as (
  select c.id as conversation_id,c.source,c.application_id,null::uuid as match_id,
    null::uuid as foster_invite_id,app.status::text as application_status,l.id as listing_id,
    a.name as animal_name,null::text as related_animal_name,null::text as match_mode,
    l.city,l.coarse_area,coalesce(o.name,p.display_name) as organization_name,'UNVERIFIED'::text as organization_verification_status,c.created_at
  from public.conversations c join public.applications app on app.id = c.application_id
  join public.animal_listings l on l.id = app.listing_id join public.animals a on a.id = l.animal_id
  left join public.organizations o on o.id = l.organization_id left join public.profiles p on p.id = l.responsible_id
  where c.source = 'FOSTER' and c.foster_request_id is null
  union all
  select c.id,c.source,null::uuid,am.id,null::uuid,am.status,null::uuid,mine.name,theirs.name,
    am.mode,theirs.city,theirs.coarse_area,null::text,'UNVERIFIED'::text,c.created_at
  from public.conversations c join public.animal_matches am on am.id = c.match_id
  join public.owner_animal_profiles mine on mine.owner_id = auth.uid() and mine.id in (am.animal_a_id,am.animal_b_id)
  join public.owner_animal_profiles theirs on theirs.owner_id <> auth.uid() and theirs.id in (am.animal_a_id,am.animal_b_id)
  where c.source = 'MATCH'
  union all
  select c.id,c.source,null::uuid,null::uuid,fi.id,fi.status,l.id,a.name,p.display_name,null::text,
    l.city,l.coarse_area,p.display_name,'UNVERIFIED'::text,c.created_at
  from public.conversations c join public.foster_invites fi on fi.id = c.foster_invite_id
  join public.foster_home_profiles fhp on fhp.id = fi.foster_home_profile_id join public.profiles p on p.id = fhp.profile_id
  join public.animal_listings l on l.id = fi.foster_case_id join public.animals a on a.id = l.animal_id
  where c.source = 'FOSTER_INVITE' and c.foster_request_id is null
  union all
  select c.id,'FOSTER',r.legacy_application_id,null::uuid,r.legacy_invite_id,r.status,l.id,a.name,null::text,null::text,
    l.city,l.coarse_area,p.display_name,'UNVERIFIED'::text,c.created_at
  from public.conversations c join public.foster_requests r on r.id = c.foster_request_id
  join public.animal_listings l on l.id = r.case_id join public.animals a on a.id = l.animal_id
  join public.profiles p on p.id = l.responsible_id
)
select c.conversation_id,c.source,c.application_id,c.match_id,c.foster_invite_id,c.application_status,
  c.listing_id,c.animal_name,c.related_animal_name,c.match_mode,c.city,c.coarse_area,c.organization_name,c.organization_verification_status,
  (select array_agg(cp.profile_id) from public.conversation_participants cp
    where cp.conversation_id = c.conversation_id and cp.profile_id <> auth.uid()) as other_participant_ids,
  exists(select 1 from public.blocks b join public.conversation_participants cp on cp.profile_id = b.blocked_id
    where b.blocker_id = auth.uid() and cp.conversation_id = c.conversation_id) as blocked_by_me,
  exists(select 1 from public.reports r where r.reporter_id = auth.uid() and r.details like '%' || c.conversation_id::text || '%') as reported_by_me,
  (select m.body from public.messages m where m.conversation_id = c.conversation_id
    and not public.is_conversation_blocked(c.conversation_id,auth.uid()) order by m.message_seq desc limit 1) as last_message_body,
  (select m.created_at from public.messages m where m.conversation_id = c.conversation_id order by m.message_seq desc limit 1) as last_message_at,c.created_at
from contexts c where public.is_conversation_participant(c.conversation_id);

create or replace view public.conversation_inbox_view as
select v.*,cp.last_read_seq,
  (select count(*)::integer from public.messages m where m.conversation_id = v.conversation_id and m.sender_id <> auth.uid()
    and m.message_seq > cp.last_read_seq and not public.is_conversation_blocked(v.conversation_id,auth.uid())) as unread_count,
  public.is_conversation_blocked(v.conversation_id,auth.uid()) as messaging_blocked,coalesce(v.last_message_at,v.created_at) as activity_at,
  coalesce((select oap.photo_urls[1] from public.animal_matches am join public.owner_animal_profiles oap
    on oap.id in (am.animal_a_id,am.animal_b_id) where am.id = v.match_id and oap.owner_id <> auth.uid() limit 1),
    (select a.photo_url from public.animal_listings l join public.animals a on a.id = l.animal_id where l.id = v.listing_id)) as animal_photo,
  (select p.display_name from public.conversation_participants other_cp join public.profiles p on p.id = other_cp.profile_id
    where other_cp.conversation_id = v.conversation_id and other_cp.profile_id <> auth.uid() limit 1) as other_owner_name,
  c.social_request_status,(c.social_request_sender_id = auth.uid()) as social_request_is_mine,
  c.foster_request_id,(c.foster_request_id is not null and v.application_status not in ('PENDING','ACCEPTED')) as foster_read_only
from public.my_conversations_view v join public.conversation_participants cp on cp.conversation_id = v.conversation_id and cp.profile_id = auth.uid()
join public.conversations c on c.id = v.conversation_id;

-- Retain historical values, but no client can create new dossiers or make new certification decisions.
revoke insert,update,delete on public.verification_documents,public.organization_verification_requests from anon,authenticated;
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace = 'public'::regnamespace and proname in
    ('admin_review_verification_document','admin_set_organization_verification_status','request_rescuer_access',
     'submit_organization_verification_request','admin_set_listing_review_status') loop
    execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
  end loop;
end $$;

create function public.reject_new_mate_operation()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.mode = 'VERIFIED_MATE' then raise exception 'Verified Mate is not available. PetPal does not certify animals.'; end if;
  return new;
end $$;
create trigger reject_new_mate_like before insert or update on public.animal_match_likes for each row execute function public.reject_new_mate_operation();
create trigger reject_new_mate_match before insert or update on public.animal_matches for each row execute function public.reject_new_mate_operation();
create function public.reject_new_mate_profile_mode()
returns trigger language plpgsql set search_path = public as $$
begin
  -- A client may edit an old profile without erasing its history, but cannot newly enable this mode.
  if 'VERIFIED_MATE' = any(new.active_match_modes) and (tg_op = 'INSERT' or not 'VERIFIED_MATE' = any(old.active_match_modes)) then
    raise exception 'Verified Mate is not available'; end if;
  return new;
end $$;
create trigger reject_new_mate_profile_mode before insert or update on public.owner_animal_profiles
  for each row execute function public.reject_new_mate_profile_mode();
create or replace function public.discover_match_candidates(my_animal_id_input uuid,mode_input text,filters_input jsonb default '{}',
  saved_only_input boolean default false,after_id_input uuid default null)
returns setof public.match_candidates_view language plpgsql stable security definer set search_path = public as $$
begin
  if not public.foster_actor_active(auth.uid()) or not exists(select 1 from public.owner_animal_profiles
    where id = my_animal_id_input and owner_id = auth.uid()) then raise exception 'Animal not accessible'; end if;
  if mode_input is null or mode_input not in ('PLAY','SOCIAL') then raise exception 'This match mode is not available'; end if;
  return query select c.* from public.match_candidates_view c where mode_input = any(c.active_match_modes)
    and public.foster_actor_active(c.owner_id) and (after_id_input is null or c.animal_id > after_id_input)
    and (nullif(filters_input->>'species','') is null or c.species::text = filters_input->>'species')
    and (nullif(filters_input->>'breed','') is null or c.breed_or_mix = filters_input->>'breed')
    and (nullif(filters_input->>'sex','') is null or c.sex = filters_input->>'sex')
    and (nullif(filters_input->>'size','') is null or c.size_label = filters_input->>'size')
    and (nullif(filters_input->>'area','') is null or c.city = filters_input->>'area' or c.coarse_area = filters_input->>'area')
    and (not saved_only_input or exists(select 1 from public.saved_animals s where s.profile_id = auth.uid() and s.animal_id = c.animal_id))
    order by c.animal_id limit 20;
end $$;

alter table public.reports add column updated_at timestamptz not null default now();
create function public.moderate_platform(kind_input text,item_id_input uuid,action_input text,expected_updated_at_input timestamptz,reason_input text)
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
      updated_at = clock_timestamp() where id = item_id_input;
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

create view public.platform_accounts_view as
select p.id,p.display_name,p.city,p.updated_at,ar.role,not public.foster_actor_active(p.id) as suspended
from public.profiles p left join public.admin_roles ar on ar.profile_id = p.id
where public.has_admin_role('MODERATOR') or public.has_admin_role('SUPER_ADMIN');
create view public.platform_listings_view as
select l.id,l.title,l.status,l.city,l.responsible_id,p.display_name as responsible_name,l.updated_at
from public.animal_listings l left join public.profiles p on p.id = l.responsible_id
where public.has_admin_role('MODERATOR') or public.has_admin_role('SUPER_ADMIN');
grant select on public.platform_accounts_view,public.platform_listings_view to authenticated;
revoke all on function public.moderate_platform(text,uuid,text,timestamptz,text) from public,anon;
grant execute on function public.moderate_platform(text,uuid,text,timestamptz,text) to authenticated;
-- All clients must supply the current version and a reason through moderate_platform.
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace = 'public'::regnamespace and proname in
    ('admin_resolve_report','admin_suspend_profile','admin_close_suspension') loop
    execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
  end loop;
end $$;
