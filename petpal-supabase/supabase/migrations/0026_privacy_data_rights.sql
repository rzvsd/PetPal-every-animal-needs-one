-- M2 privacy and data rights: consent at sign-up, account deletion that
-- anonymises shared records, and a server-side personal data export.

alter table public.profiles
  add column terms_accepted_at timestamptz,
  add column deleted_at timestamptz;

-- 1. Consent. A new profile needs an explicit 16+ confirmation and terms
-- acceptance; later profile edits keep the recorded values.
drop function public.complete_profile_onboarding(text, text, text, public.user_role[]);

create function public.complete_profile_onboarding(
  display_name_input text,
  city_input text,
  coarse_area_input text,
  roles_input public.user_role[],
  age_confirmed_input boolean default null,
  terms_accepted_input boolean default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_profile public.profiles;
  updated_profile public.profiles;
  self_service_roles constant public.user_role[] := array['ADOPTER', 'FOSTER']::public.user_role[];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if array_length(roles_input, 1) is null then
    raise exception 'At least one role is required';
  end if;

  select * into existing_profile from public.profiles where id = auth.uid();

  if existing_profile.deleted_at is not null then
    raise exception 'This account has been deleted';
  end if;

  if existing_profile.id is null
     and not (coalesce(age_confirmed_input, false) and coalesce(terms_accepted_input, false)) then
    raise exception 'Confirm you are at least 16 and accept the Terms and Privacy Policy';
  end if;

  insert into public.profiles (id, display_name, city, coarse_area, age_confirmed, terms_accepted_at, onboarding_completed_at)
  values (auth.uid(), display_name_input, city_input, coarse_area_input, true, now(), now())
  on conflict (id) do update
    set display_name = excluded.display_name,
        city = excluded.city,
        coarse_area = excluded.coarse_area,
        onboarding_completed_at = coalesce(public.profiles.onboarding_completed_at, now()),
        updated_at = now()
  returning * into updated_profile;

  delete from public.profile_roles
  where profile_id = auth.uid()
    and role = any(self_service_roles);

  insert into public.profile_roles (profile_id, role)
  select auth.uid(), selected_role
  from unnest(roles_input) as selected_role
  where selected_role = any(self_service_roles)
  on conflict do nothing;

  return updated_profile;
end;
$$;

revoke all on function public.complete_profile_onboarding(text, text, text, public.user_role[], boolean, boolean) from public, anon;
grant execute on function public.complete_profile_onboarding(text, text, text, public.user_role[], boolean, boolean) to authenticated;

-- 2. Account deletion. Open foster commitments block deletion so no animal is
-- left without a responsible person on record.
create or replace function private.account_deletion_blockers(profile_id_input uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'pendingRequests', (
      select count(*)::integer
      from public.foster_requests r
      where r.status = 'PENDING'
        and profile_id_input in (r.sender_id, r.recipient_id, r.created_by)
    ),
    'activePlacements', (
      select count(*)::integer
      from public.foster_placements p
      left join public.foster_home_profiles h on h.id = p.home_id
      left join public.animals a on a.id = p.animal_id
      where p.status in ('RESERVED', 'IN_CARE')
        and profile_id_input in (h.profile_id, p.carer_id, a.responsible_id)
    )
  );
$$;

revoke all on function private.account_deletion_blockers(uuid) from public, anon, authenticated;

create or replace function public.my_account_deletion_blockers()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select private.account_deletion_blockers(auth.uid());
$$;

revoke all on function public.my_account_deletion_blockers() from public, anon;
grant execute on function public.my_account_deletion_blockers() to authenticated;

-- Called by the delete-account Edge Function with the service role, before the
-- auth user is soft-deleted. Personal data is removed; records other people
-- rely on (their chats, foster history, reports, moderation, payments) stay
-- attached to an anonymised "Deleted user" profile.
create or replace function public.delete_account_data(profile_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  blockers jsonb := private.account_deletion_blockers(profile_id_input);
begin
  if (blockers->>'pendingRequests')::integer > 0 or (blockers->>'activePlacements')::integer > 0 then
    return jsonb_build_object('deleted', false, 'blockers', blockers);
  end if;

  delete from public.push_tokens where profile_id = profile_id_input;
  delete from public.notification_events where profile_id = profile_id_input;
  delete from public.profile_roles where profile_id = profile_id_input;
  delete from public.admin_roles where profile_id = profile_id_input;
  delete from public.organization_members where profile_id = profile_id_input;
  delete from public.blocks where profile_id_input in (blocker_id, blocked_id);
  delete from public.saved_animals where profile_id = profile_id_input;
  delete from public.foster_saved where profile_id = profile_id_input;
  delete from public.animal_match_likes where liker_id = profile_id_input;
  delete from public.conversation_typing where profile_id = profile_id_input;
  delete from public.verification_documents where profile_id = profile_id_input;

  update public.foster_home_members
  set status = 'REVOKED', updated_at = now()
  where profile_id = profile_id_input and status <> 'REVOKED';

  -- Matched animals are referenced by other people's conversations, so they
  -- are hidden and stripped instead of deleted.
  update public.owner_animal_profiles
  set photo_urls = '{}', city = null, coarse_area = null, active_match_modes = '{}',
      temperament_tags = '{}', updated_at = now()
  where owner_id = profile_id_input;

  update public.animal_listings
  set status = 'ARCHIVED', archived_reason = 'account_deleted', updated_at = now()
  where responsible_id = profile_id_input and status <> 'ARCHIVED';

  update public.foster_home_profiles
  set published = false, name = 'Deleted foster home', bio = '', photos = '{}', past_fosters = '{}',
      experience_summary = '', other_pets = null, children_in_home = null, area = '', updated_at = now()
  where profile_id = profile_id_input;

  update public.profiles
  set display_name = 'Deleted user', city = null, coarse_area = null, verification_status = 'UNVERIFIED',
      show_typing_activity = false, deleted_at = now(), updated_at = now()
  where id = profile_id_input;

  return jsonb_build_object('deleted', true, 'blockers', blockers);
end;
$$;

revoke all on function public.delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;

-- 3. Personal data export: what the user provided or did, not other people's
-- messages or identities.
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'exportedAt', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'roles', (select coalesce(jsonb_agg(r.role), '[]') from public.profile_roles r where r.profile_id = auth.uid()),
    'animals', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.owner_animal_profiles a where a.owner_id = auth.uid()),
    'savedAnimals', (select coalesce(jsonb_agg(s.animal_id), '[]') from public.saved_animals s where s.profile_id = auth.uid()),
    'matchLikes', (select coalesce(jsonb_agg(jsonb_build_object('myAnimalId', l.my_animal_id, 'targetAnimalId', l.target_animal_id,
      'mode', l.mode, 'createdAt', l.created_at)), '[]') from public.animal_match_likes l where l.liker_id = auth.uid()),
    'blocks', (select coalesce(jsonb_agg(jsonb_build_object('blockedId', b.blocked_id, 'createdAt', b.created_at)), '[]')
      from public.blocks b where b.blocker_id = auth.uid()),
    'reportsFiled', (select coalesce(jsonb_agg(jsonb_build_object('category', r.category, 'details', r.details,
      'status', r.status, 'createdAt', r.created_at)), '[]') from public.reports r where r.reporter_id = auth.uid()),
    'conversations', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'source', c.source, 'createdAt', c.created_at)), '[]')
      from public.conversations c join public.conversation_participants cp on cp.conversation_id = c.id
      where cp.profile_id = auth.uid()),
    'messagesSent', (select coalesce(jsonb_agg(jsonb_build_object('conversationId', m.conversation_id, 'body', m.body,
      'createdAt', m.created_at)), '[]') from public.messages m where m.sender_id = auth.uid()),
    'fosterHomes', (select coalesce(jsonb_agg(to_jsonb(h)), '[]') from public.foster_home_profiles h where h.profile_id = auth.uid()),
    'fosterCases', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'description', l.description,
      'status', l.status, 'city', l.city, 'createdAt', l.created_at)), '[]') from public.animal_listings l where l.responsible_id = auth.uid()),
    'fosterRequests', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'status', r.status,
      'message', r.message, 'createdAt', r.created_at)), '[]') from public.foster_requests r
      where auth.uid() in (r.sender_id, r.recipient_id, r.created_by)),
    'fosterJournal', (select coalesce(jsonb_agg(jsonb_build_object('placementId', j.placement_id, 'event', j.event,
      'body', j.body, 'createdAt', j.created_at)), '[]') from public.foster_journal j where j.actor_id = auth.uid()),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('purpose', ps.purpose, 'amountCents', ps.amount_cents,
      'currency', ps.currency, 'status', ps.status, 'createdAt', ps.created_at)), '[]')
      from public.payment_sessions ps where ps.profile_id = auth.uid()),
    'pushDevices', (select coalesce(jsonb_agg(jsonb_build_object('platform', t.platform, 'enabled', t.enabled,
      'createdAt', t.created_at)), '[]') from public.push_tokens t where t.profile_id = auth.uid())
  );
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
