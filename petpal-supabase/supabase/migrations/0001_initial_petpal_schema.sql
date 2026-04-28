create extension if not exists "pgcrypto";

create type public.petpal_mode as enum ('ADOPT', 'FOSTER', 'PLAY', 'SERVICES', 'COMMUNITY', 'MATE');
create type public.listing_status as enum ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'REJECTED', 'ARCHIVED');
create type public.verification_status as enum ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
create type public.application_status as enum ('SUBMITTED', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');
create type public.species as enum ('DOG', 'CAT');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  city text,
  coarse_area text,
  verification_status public.verification_status not null default 'UNVERIFIED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  website_url text,
  social_url text,
  verification_status public.verification_status not null default 'PENDING',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('OWNER', 'MANAGER', 'VIEWER')),
  created_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

create table public.admin_roles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('MODERATOR', 'DOCUMENT_REVIEWER', 'SUPER_ADMIN')),
  created_at timestamptz not null default now()
);

create table public.animals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  species public.species not null,
  breed_or_mix text,
  approximate_age_months integer check (approximate_age_months is null or approximate_age_months between 0 and 360),
  size_label text,
  sex text not null check (sex in ('FEMALE', 'MALE', 'UNKNOWN')),
  temperament text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.animal_private_details (
  animal_id uuid primary key references public.animals(id) on delete cascade,
  private_notes text,
  internal_health_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.animal_photos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.animal_listings (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mode public.petpal_mode not null check (mode in ('ADOPT', 'FOSTER')),
  status public.listing_status not null default 'DRAFT',
  title text not null,
  description text not null,
  city text not null,
  coarse_area text,
  expires_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listing_private_details (
  listing_id uuid primary key references public.animal_listings(id) on delete cascade,
  exact_location text,
  private_handover_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listing_status_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.animal_listings(id) on delete cascade,
  from_status public.listing_status,
  to_status public.listing_status not null,
  changed_by uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.animal_listings(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  status public.application_status not null default 'SUBMITTED',
  housing_type text not null,
  animal_experience text not null,
  other_pets text,
  children_in_home text,
  landlord_approval text,
  motivation text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  from_status public.application_status,
  to_status public.application_status not null,
  changed_by uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  reported_profile_id uuid references public.profiles(id),
  listing_id uuid references public.animal_listings(id),
  message_id uuid references public.messages(id),
  category text not null,
  details text,
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  storage_path text not null,
  document_type text not null,
  status public.verification_status not null default 'PENDING',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (profile_id is not null or organization_id is not null)
);

create table public.user_suspensions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  suspended_by uuid not null references public.profiles(id),
  reason text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  action text not null,
  report_id uuid references public.reports(id),
  listing_id uuid references public.animal_listings(id),
  profile_id uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('IOS', 'ANDROID', 'WEB')),
  created_at timestamptz not null default now()
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create view public.listing_public_view as
select
  l.id as listing_id,
  l.mode,
  l.status,
  l.title,
  l.description,
  l.city,
  l.coarse_area,
  l.expires_at,
  a.id as animal_id,
  a.name,
  a.species,
  a.breed_or_mix,
  a.approximate_age_months,
  a.size_label,
  a.sex,
  a.temperament,
  o.id as organization_id,
  o.name as organization_name
from public.animal_listings l
join public.animals a on a.id = l.animal_id
join public.organizations o on o.id = l.organization_id
where l.status = 'ACTIVE';

grant select on public.listing_public_view to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.admin_roles enable row level security;
alter table public.animals enable row level security;
alter table public.animal_private_details enable row level security;
alter table public.animal_photos enable row level security;
alter table public.animal_listings enable row level security;
alter table public.listing_private_details enable row level security;
alter table public.listing_status_history enable row level security;
alter table public.applications enable row level security;
alter table public.application_status_history enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.verification_documents enable row level security;
alter table public.user_suspensions enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notification_events enable row level security;
alter table public.audit_logs enable row level security;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    execute $storage$
      insert into storage.buckets (id, name, public)
      values
        ('animal-photos', 'animal-photos', false),
        ('verification-documents', 'verification-documents', false)
      on conflict (id) do nothing
    $storage$;
  end if;
end $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_roles ar
    where ar.profile_id = auth.uid()
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_roles ar
    where ar.profile_id = auth.uid()
      and ar.role = 'SUPER_ADMIN'
  );
$$;

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.profile_id = auth.uid()
  );
$$;

create or replace function public.is_listing_org_member(target_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.animal_listings l
    join public.organization_members om on om.organization_id = l.organization_id
    where l.id = target_listing_id
      and om.profile_id = auth.uid()
  );
$$;

create or replace function public.is_conversation_participant(target_conversation_id uuid)
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
      and cp.profile_id = auth.uid()
  );
$$;

create or replace function public.add_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_members (organization_id, profile_id, role)
  values (new.id, new.created_by, 'OWNER')
  on conflict do nothing;
  return new;
end;
$$;

create trigger organizations_add_owner
after insert on public.organizations
for each row execute function public.add_organization_owner();

create policy profiles_select_self_or_admin
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy profiles_insert_self
on public.profiles for insert to authenticated
with check (id = auth.uid());

create policy profiles_update_self
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy organizations_select_member_or_verified
on public.organizations for select to authenticated
using (verification_status = 'VERIFIED' or public.is_org_member(id) or public.is_admin());

create policy organizations_insert_creator
on public.organizations for insert to authenticated
with check (created_by = auth.uid());

create policy organizations_update_member_or_admin
on public.organizations for update to authenticated
using (public.is_org_member(id) or public.is_admin())
with check (public.is_org_member(id) or public.is_admin());

create policy organization_members_select_member_or_admin
on public.organization_members for select to authenticated
using (public.is_org_member(organization_id) or public.is_admin());

create policy organization_members_admin_manage
on public.organization_members for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy admin_roles_admin_read
on public.admin_roles for select to authenticated
using (public.is_admin());

create policy admin_roles_super_admin_manage
on public.admin_roles for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy animals_org_member_manage
on public.animals for all to authenticated
using (public.is_org_member(organization_id) or public.is_admin())
with check (public.is_org_member(organization_id) or public.is_admin());

create policy animal_private_details_org_member_manage
on public.animal_private_details for all to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.animals a
    where a.id = animal_id
      and public.is_org_member(a.organization_id)
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.animals a
    where a.id = animal_id
      and public.is_org_member(a.organization_id)
  )
);

create policy animal_photos_org_member_manage
on public.animal_photos for all to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.animals a
    where a.id = animal_id
      and public.is_org_member(a.organization_id)
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.animals a
    where a.id = animal_id
      and public.is_org_member(a.organization_id)
  )
);

create policy animal_listings_org_member_manage
on public.animal_listings for all to authenticated
using (public.is_org_member(organization_id) or public.is_admin())
with check (public.is_org_member(organization_id) or public.is_admin());

create policy listing_private_details_org_member_manage
on public.listing_private_details for all to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.animal_listings l
    where l.id = listing_id
      and public.is_org_member(l.organization_id)
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.animal_listings l
    where l.id = listing_id
      and public.is_org_member(l.organization_id)
  )
);

create policy listing_status_history_org_member_read
on public.listing_status_history for select to authenticated
using (public.is_listing_org_member(listing_id) or public.is_admin());

create policy listing_status_history_org_member_insert
on public.listing_status_history for insert to authenticated
with check (public.is_listing_org_member(listing_id) or public.is_admin());

create policy applications_applicant_or_org_read
on public.applications for select to authenticated
using (
  applicant_id = auth.uid()
  or public.is_listing_org_member(listing_id)
  or public.is_admin()
);

create policy applications_insert_for_active_listing
on public.applications for insert to authenticated
with check (
  applicant_id = auth.uid()
  and exists (
    select 1
    from public.animal_listings l
    where l.id = listing_id
      and l.status = 'ACTIVE'
  )
);

create policy applications_applicant_withdraw
on public.applications for update to authenticated
using (applicant_id = auth.uid())
with check (applicant_id = auth.uid() and status = 'WITHDRAWN');

create policy applications_org_update
on public.applications for update to authenticated
using (public.is_listing_org_member(listing_id) or public.is_admin())
with check (public.is_listing_org_member(listing_id) or public.is_admin());

create policy application_status_history_applicant_or_org_read
on public.application_status_history for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.applications a
    where a.id = application_id
      and (a.applicant_id = auth.uid() or public.is_listing_org_member(a.listing_id))
  )
);

create policy application_status_history_org_insert
on public.application_status_history for insert to authenticated
with check (
  public.is_admin()
  or exists (
    select 1 from public.applications a
    where a.id = application_id
      and public.is_listing_org_member(a.listing_id)
  )
);

create policy conversations_participant_read
on public.conversations for select to authenticated
using (public.is_conversation_participant(id) or public.is_admin());

create policy conversation_participants_participant_read
on public.conversation_participants for select to authenticated
using (profile_id = auth.uid() or public.is_conversation_participant(conversation_id) or public.is_admin());

create policy messages_participant_read
on public.messages for select to authenticated
using (public.is_conversation_participant(conversation_id) or public.is_admin());

create policy messages_participant_insert
on public.messages for insert to authenticated
with check (sender_id = auth.uid() and public.is_conversation_participant(conversation_id));

create policy reports_reporter_or_admin_read
on public.reports for select to authenticated
using (reporter_id = auth.uid() or public.is_admin());

create policy reports_reporter_insert
on public.reports for insert to authenticated
with check (reporter_id = auth.uid());

create policy reports_admin_update
on public.reports for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy blocks_self_manage
on public.blocks for all to authenticated
using (blocker_id = auth.uid())
with check (blocker_id = auth.uid());

create policy verification_documents_owner_org_or_admin_read
on public.verification_documents for select to authenticated
using (
  public.is_admin()
  or profile_id = auth.uid()
  or (organization_id is not null and public.is_org_member(organization_id))
);

create policy verification_documents_owner_org_insert
on public.verification_documents for insert to authenticated
with check (
  profile_id = auth.uid()
  or (organization_id is not null and public.is_org_member(organization_id))
);

create policy verification_documents_admin_update
on public.verification_documents for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy user_suspensions_admin_only
on public.user_suspensions for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy moderation_actions_admin_only
on public.moderation_actions for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy push_tokens_self_manage
on public.push_tokens for all to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy notification_events_self_read
on public.notification_events for select to authenticated
using (profile_id = auth.uid() or public.is_admin());

create policy notification_events_admin_insert_update
on public.notification_events for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy audit_logs_admin_read
on public.audit_logs for select to authenticated
using (public.is_admin());

create policy audit_logs_admin_insert
on public.audit_logs for insert to authenticated
with check (public.is_admin());
