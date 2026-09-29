-- M1 security hardening. Closes self-service escalation paths, direct push
-- enqueueing, the legacy foster-home view and open photo listing.

-- 1. Push notifications are queued only by definer functions and the worker.
revoke all on function public.enqueue_push_notification(uuid, text, jsonb, text, text)
  from public, anon, authenticated;

-- 2. Roles. Users may pick self-service roles; privileged roles come only from
-- admin review (0013) and are preserved when the profile is edited.
drop policy if exists profile_roles_self_manage on public.profile_roles;

create or replace function public.complete_profile_onboarding(
  display_name_input text,
  city_input text,
  coarse_area_input text,
  roles_input public.user_role[]
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
  self_service_roles constant public.user_role[] := array['ADOPTER', 'FOSTER']::public.user_role[];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if array_length(roles_input, 1) is null then
    raise exception 'At least one role is required';
  end if;

  insert into public.profiles (id, display_name, city, coarse_area, age_confirmed, onboarding_completed_at)
  values (auth.uid(), display_name_input, city_input, coarse_area_input, true, now())
  on conflict (id) do update
    set display_name = excluded.display_name,
        city = excluded.city,
        coarse_area = excluded.coarse_area,
        age_confirmed = true,
        onboarding_completed_at = now(),
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

revoke all on function public.complete_profile_onboarding(text, text, text, public.user_role[]) from public, anon;
grant execute on function public.complete_profile_onboarding(text, text, text, public.user_role[]) to authenticated;

-- 3. Trust fields change only through moderators or definer functions.
-- current_user is anon/authenticated only for direct client writes.
create or replace function public.guard_profile_trust_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.verification_status <> 'UNVERIFIED' or new.age_confirmed then
      raise exception 'Verification fields are managed by PetPal moderators';
    end if;
  elsif new.verification_status is distinct from old.verification_status
     or new.age_confirmed is distinct from old.age_confirmed then
    raise exception 'Verification fields are managed by PetPal moderators';
  end if;

  return new;
end;
$$;

create trigger guard_profile_trust_fields
before insert or update on public.profiles
for each row execute function public.guard_profile_trust_fields();

create or replace function public.guard_organization_trust_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.verification_status <> 'PENDING' then
      raise exception 'Verification fields are managed by PetPal moderators';
    end if;
  elsif new.verification_status is distinct from old.verification_status then
    raise exception 'Verification fields are managed by PetPal moderators';
  end if;

  return new;
end;
$$;

create trigger guard_organization_trust_fields
before insert or update on public.organizations
for each row execute function public.guard_organization_trust_fields();

-- 4. The legacy foster-home view ignored publishing, blocks and suspensions.
-- foster_homes_directory (0023) replaces it. The legacy invite and rating RPCs
-- bypass the participant-led request and placement model (0020-0023).
drop view public.foster_home_profiles_view;

revoke execute on function public.rate_foster_home(uuid, uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.send_foster_invite(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.respond_to_foster_invite(uuid, text) from public, anon, authenticated;

-- 6. Block status answers only the people involved. Definer callers and RLS
-- checks pass auth.uid() or run as the function owner, so they are unaffected.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.profiles_blocked(first_profile_id uuid, second_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.blocks b
    where (b.blocker_id = first_profile_id and b.blocked_id = second_profile_id)
       or (b.blocker_id = second_profile_id and b.blocked_id = first_profile_id)
  );
$$;

create or replace function private.conversation_blocked(target_conversation_id uuid, actor_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = target_conversation_id
      and cp.profile_id <> actor_profile_id
      and private.profiles_blocked(cp.profile_id, actor_profile_id)
  );
$$;

revoke all on function private.profiles_blocked(uuid, uuid) from public;
revoke all on function private.conversation_blocked(uuid, uuid) from public;
grant execute on function private.profiles_blocked(uuid, uuid) to anon, authenticated;
grant execute on function private.conversation_blocked(uuid, uuid) to anon, authenticated;

create or replace function public.is_profile_blocked_between(first_profile_id uuid, second_profile_id uuid)
returns boolean
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated')
     and auth.uid() is distinct from first_profile_id
     and auth.uid() is distinct from second_profile_id
     and not public.is_admin() then
    raise exception 'Block status is only available to the people involved';
  end if;

  return private.profiles_blocked(first_profile_id, second_profile_id);
end;
$$;

create or replace function public.is_conversation_blocked(target_conversation_id uuid, actor_profile_id uuid)
returns boolean
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated')
     and auth.uid() is distinct from actor_profile_id
     and not public.is_admin() then
    raise exception 'Block status is only available to the people involved';
  end if;

  return private.conversation_blocked(target_conversation_id, actor_profile_id);
end;
$$;

-- 7. Reports always start open, and each reporter has a daily limit.
create or replace function public.guard_report_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  new.status := 'OPEN';
  new.resolved_at := null;

  if auth.uid() is not null and (
    select count(*)
    from public.reports r
    where r.reporter_id = auth.uid()
      and r.created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'Report limit reached. Please try again later.';
  end if;

  return new;
end;
$$;

create trigger guard_report_insert
before insert on public.reports
for each row execute function public.guard_report_insert();

-- 8. Photos stay publicly viewable by URL (public bucket), but only owners can
-- list or read their own folder through the API.
drop policy if exists animal_photos_public_read on storage.objects;

create policy animal_photos_owner_read
on storage.objects for select to authenticated
using (
  bucket_id = 'animal-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
