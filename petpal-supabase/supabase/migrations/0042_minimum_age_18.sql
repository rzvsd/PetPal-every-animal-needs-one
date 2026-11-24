-- Pilot decision (2026-11-23): PetPal is for people aged 18 or older.
-- Same function as 0026; only the consent message changes from 16 to 18.
-- The app's sign-up checkbox now reads "I am 18 or older".

create or replace function public.complete_profile_onboarding(
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
    raise exception 'Confirm you are at least 18 and accept the Terms and Privacy Policy';
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
