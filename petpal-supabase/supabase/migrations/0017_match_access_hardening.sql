-- Owners may edit facts, not the verification decisions used by matching.
create function public.protect_owner_animal_verification()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and not public.is_admin() then
    if (tg_op = 'INSERT' and (
      new.health_document_status <> 'UNVERIFIED' or new.admin_mate_approval_status <> 'UNVERIFIED'
      or new.verification_status <> 'UNVERIFIED'
    )) or (tg_op = 'UPDATE' and (
      new.health_document_status is distinct from old.health_document_status
      or new.admin_mate_approval_status is distinct from old.admin_mate_approval_status
      or new.verification_status is distinct from old.verification_status
    )) then raise exception 'Verification decisions require an authorized reviewer'; end if;
    new.profile_completeness := public.calculate_owner_animal_completeness(
      new.name,new.species,new.breed_or_mix,new.approximate_age_months,new.sex,new.size_label,
      new.vaccine_status,new.sterilized_status,new.temperament_tags,new.city,new.coarse_area,new.photo_urls);
  end if;
  return new;
end $$;
create trigger protect_owner_animal_verification before insert or update
on public.owner_animal_profiles for each row execute function public.protect_owner_animal_verification();

-- Keep the old view contract: older clients must not expose blocked message previews.
create or replace view public.my_conversations_view as
with contexts as (
  select c.id as conversation_id,c.source,c.application_id,null::uuid as match_id,
    null::uuid as foster_invite_id,app.status::text as application_status,l.id as listing_id,
    a.name as animal_name,null::text as related_animal_name,null::text as match_mode,
    l.city,l.coarse_area,o.name as organization_name,o.verification_status::text as organization_verification_status,c.created_at
  from public.conversations c
  join public.applications app on app.id = c.application_id
  join public.animal_listings l on l.id = app.listing_id
  join public.animals a on a.id = l.animal_id
  join public.organizations o on o.id = l.organization_id
  where c.source = 'FOSTER'
  union all
  select c.id,c.source,null::uuid,am.id,null::uuid,am.status,null::uuid,mine.name,theirs.name,
    am.mode,theirs.city,theirs.coarse_area,null::text,theirs.verification_status::text,c.created_at
  from public.conversations c
  join public.animal_matches am on am.id = c.match_id
  join public.owner_animal_profiles mine on mine.owner_id = auth.uid() and mine.id in (am.animal_a_id,am.animal_b_id)
  join public.owner_animal_profiles theirs on theirs.owner_id <> auth.uid() and theirs.id in (am.animal_a_id,am.animal_b_id)
  where c.source = 'MATCH'
  union all
  select c.id,c.source,null::uuid,null::uuid,fi.id,fi.status,l.id,a.name,p.display_name,null::text,
    l.city,l.coarse_area,p.display_name,fhp.verified_status::text,c.created_at
  from public.conversations c
  join public.foster_invites fi on fi.id = c.foster_invite_id
  join public.foster_home_profiles fhp on fhp.id = fi.foster_home_profile_id
  join public.profiles p on p.id = fhp.profile_id
  join public.animal_listings l on l.id = fi.foster_case_id
  join public.animals a on a.id = l.animal_id
  where c.source = 'FOSTER_INVITE'
)
select c.conversation_id,c.source,c.application_id,c.match_id,c.foster_invite_id,c.application_status,
  c.listing_id,c.animal_name,c.related_animal_name,c.match_mode,c.city,c.coarse_area,
  c.organization_name,c.organization_verification_status,
  (select array_agg(cp.profile_id) from public.conversation_participants cp
    where cp.conversation_id = c.conversation_id and cp.profile_id <> auth.uid()) as other_participant_ids,
  exists (select 1 from public.blocks b join public.conversation_participants cp on cp.profile_id = b.blocked_id
    where b.blocker_id = auth.uid() and cp.conversation_id = c.conversation_id) as blocked_by_me,
  exists (select 1 from public.reports r where r.reporter_id = auth.uid()
    and r.details like '%' || c.conversation_id::text || '%') as reported_by_me,
  (select m.body from public.messages m where m.conversation_id = c.conversation_id
    and not public.is_conversation_blocked(c.conversation_id,auth.uid()) order by m.message_seq desc limit 1) as last_message_body,
  (select m.created_at from public.messages m where m.conversation_id = c.conversation_id
    order by m.message_seq desc limit 1) as last_message_at,c.created_at
from contexts c where public.is_conversation_participant(c.conversation_id);

create function public.conversation_unread_totals()
returns table(source text,unread_count bigint)
language sql stable security definer set search_path = public as $$
  select case when c.source = 'MATCH' then 'MATCH' else 'FOSTER' end,sum((
    select count(*) from public.messages m where m.conversation_id = c.id
      and m.sender_id <> auth.uid() and m.message_seq > cp.last_read_seq
  ))::bigint
  from public.conversation_participants cp join public.conversations c on c.id = cp.conversation_id
  where cp.profile_id = auth.uid() and not public.is_conversation_blocked(c.id,auth.uid())
  group by 1;
$$;
revoke all on function public.conversation_unread_totals() from public;
grant execute on function public.conversation_unread_totals() to authenticated;
