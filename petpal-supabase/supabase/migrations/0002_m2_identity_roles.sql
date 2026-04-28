create type public.user_role as enum ('ADOPTER', 'FOSTER', 'RESCUER', 'SHELTER_MEMBER');
create type public.organization_type as enum ('SHELTER', 'RESCUE_GROUP', 'INDEPENDENT_RESCUER');

alter table public.profiles
  add column age_confirmed boolean not null default false,
  add column onboarding_completed_at timestamptz;

alter table public.organizations
  add column organization_type public.organization_type not null default 'INDEPENDENT_RESCUER',
  add column representative_name text,
  add column contact_email text,
  add column contact_phone text,
  add column registration_number text,
  add column activity_summary text;

create table public.profile_roles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, role)
);

create table public.organization_verification_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  status public.verification_status not null default 'PENDING',
  organization_type public.organization_type not null,
  organization_name text not null,
  representative_name text not null,
  contact_email text not null,
  contact_phone text,
  city text not null,
  website_url text,
  social_url text,
  registration_number text,
  activity_summary text not null,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profile_roles enable row level security;
alter table public.organization_verification_requests enable row level security;

create or replace function public.is_profile_owner(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_profile_id = auth.uid();
$$;

create or replace function public.complete_profile_onboarding(
  display_name_input text,
  city_input text,
  coarse_area_input text,
  roles_input public.user_role[]
)
returns public.profiles
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_profile public.profiles;
  selected_role public.user_role;
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

  delete from public.profile_roles where profile_id = auth.uid();

  foreach selected_role in array roles_input loop
    insert into public.profile_roles (profile_id, role)
    values (auth.uid(), selected_role)
    on conflict do nothing;
  end loop;

  return updated_profile;
end;
$$;

create or replace function public.submit_organization_verification(
  organization_type_input public.organization_type,
  organization_name_input text,
  representative_name_input text,
  contact_email_input text,
  contact_phone_input text,
  city_input text,
  website_url_input text,
  social_url_input text,
  registration_number_input text,
  activity_summary_input text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  organization_id_result uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.organizations (
    name,
    city,
    website_url,
    social_url,
    verification_status,
    created_by,
    organization_type,
    representative_name,
    contact_email,
    contact_phone,
    registration_number,
    activity_summary
  )
  values (
    organization_name_input,
    city_input,
    website_url_input,
    social_url_input,
    'PENDING',
    auth.uid(),
    organization_type_input,
    representative_name_input,
    contact_email_input,
    contact_phone_input,
    registration_number_input,
    activity_summary_input
  )
  returning id into organization_id_result;

  insert into public.organization_verification_requests (
    organization_id,
    submitted_by,
    status,
    organization_type,
    organization_name,
    representative_name,
    contact_email,
    contact_phone,
    city,
    website_url,
    social_url,
    registration_number,
    activity_summary
  )
  values (
    organization_id_result,
    auth.uid(),
    'PENDING',
    organization_type_input,
    organization_name_input,
    representative_name_input,
    contact_email_input,
    contact_phone_input,
    city_input,
    website_url_input,
    social_url_input,
    registration_number_input,
    activity_summary_input
  );

  return organization_id_result;
end;
$$;

create policy profile_roles_self_or_admin_read
on public.profile_roles for select to authenticated
using (profile_id = auth.uid() or public.is_admin());

create policy profile_roles_self_manage
on public.profile_roles for all to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy organization_verification_member_or_admin_read
on public.organization_verification_requests for select to authenticated
using (
  public.is_admin()
  or submitted_by = auth.uid()
  or public.is_org_member(organization_id)
);

create policy organization_verification_submitter_insert
on public.organization_verification_requests for insert to authenticated
with check (submitted_by = auth.uid() and public.is_org_member(organization_id));

create policy organization_verification_admin_update
on public.organization_verification_requests for update to authenticated
using (public.is_admin())
with check (public.is_admin());

