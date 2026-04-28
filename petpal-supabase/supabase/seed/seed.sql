insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  phone,
  phone_change,
  phone_change_token,
  email_change_token_current,
  email_change_confirm_status,
  reauthentication_token,
  is_sso_user,
  is_anonymous,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rescue@petpal.local',
    crypt('petpal-demo-password', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    null,
    '',
    '',
    '',
    0,
    '',
    false,
    false,
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"PetPal Rescue Demo"}',
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'adopter@petpal.local',
    crypt('petpal-demo-password', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    null,
    '',
    '',
    '',
    0,
    '',
    false,
    false,
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Demo Adopter"}',
    now(),
    now()
  )
on conflict (id) do nothing;

insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at,
  id
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '{"sub":"10000000-0000-4000-8000-000000000001","email":"rescue@petpal.local","email_verified":true,"phone_verified":false}',
    'email',
    now(),
    now(),
    now(),
    '10000000-0000-4000-8000-000000000011'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '{"sub":"10000000-0000-4000-8000-000000000002","email":"adopter@petpal.local","email_verified":true,"phone_verified":false}',
    'email',
    now(),
    now(),
    now(),
    '10000000-0000-4000-8000-000000000012'
  )
on conflict (provider_id, provider) do update
set identity_data = excluded.identity_data,
    updated_at = now();

insert into public.profiles (
  id,
  display_name,
  city,
  coarse_area,
  verification_status,
  age_confirmed,
  onboarding_completed_at
)
values
  ('10000000-0000-4000-8000-000000000001', 'PetPal Rescue Demo', 'Bucharest', 'Sector 3', 'VERIFIED', true, now()),
  ('10000000-0000-4000-8000-000000000002', 'Demo Adopter', 'Bucharest', 'Sector 6', 'UNVERIFIED', true, now())
on conflict (id) do update
set display_name = excluded.display_name,
    city = excluded.city,
    coarse_area = excluded.coarse_area,
    verification_status = excluded.verification_status,
    age_confirmed = excluded.age_confirmed,
    onboarding_completed_at = excluded.onboarding_completed_at,
    updated_at = now();

insert into public.profile_roles (profile_id, role)
values
  ('10000000-0000-4000-8000-000000000001', 'RESCUER'),
  ('10000000-0000-4000-8000-000000000001', 'SHELTER_MEMBER'),
  ('10000000-0000-4000-8000-000000000002', 'ADOPTER'),
  ('10000000-0000-4000-8000-000000000002', 'FOSTER')
on conflict do nothing;

insert into public.admin_roles (profile_id, role)
values ('10000000-0000-4000-8000-000000000001', 'SUPER_ADMIN')
on conflict (profile_id) do update
set role = excluded.role;

insert into public.organizations (
  id,
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
  '20000000-0000-4000-8000-000000000001',
  'PetPal Rescue Demo',
  'Bucharest',
  'https://example.com/petpal-rescue',
  'https://instagram.com/petpal-demo',
  'VERIFIED',
  '10000000-0000-4000-8000-000000000001',
  'RESCUE_GROUP',
  'PetPal Demo Coordinator',
  'rescue@petpal.local',
  null,
  null,
  'Demo rescue organization used for local PetPal development and smoke tests.'
)
on conflict (id) do update
set name = excluded.name,
    city = excluded.city,
    verification_status = excluded.verification_status,
    updated_at = now();

insert into public.animals (
  id,
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
values
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Luna',
    'CAT',
    'Domestic shorthair mix',
    18,
    'Small',
    'FEMALE',
    'Quiet, affectionate, prefers slow introductions.',
    'Vaccinated, sterilized, indoor-only recommendation.'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'Bruno',
    'DOG',
    'Mixed breed',
    36,
    'Medium',
    'MALE',
    'Friendly, people-focused, needs short quiet walks.',
    'Recovering after treatment; follow-up visit already scheduled.'
  )
on conflict (id) do update
set name = excluded.name,
    temperament = excluded.temperament,
    public_health_summary = excluded.public_health_summary,
    updated_at = now();

insert into public.animal_listings (
  id,
  animal_id,
  organization_id,
  mode,
  status,
  title,
  description,
  city,
  coarse_area,
  submitted_at,
  reviewed_at,
  reviewed_by,
  expires_at
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'ADOPT',
    'ACTIVE',
    'Luna needs a calm apartment home',
    'Luna is a gentle young cat who does best with patient people and a predictable home rhythm.',
    'Bucharest',
    'Sector 3',
    now(),
    now(),
    '10000000-0000-4000-8000-000000000001',
    now() + interval '30 days'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'FOSTER',
    'ACTIVE',
    'Bruno needs a foster for recovery',
    'Bruno needs a temporary foster home while his rescuers coordinate medical follow-up and adoption screening.',
    'Ilfov',
    'Otopeni',
    now(),
    now(),
    '10000000-0000-4000-8000-000000000001',
    now() + interval '30 days'
  )
on conflict (id) do update
set status = excluded.status,
    title = excluded.title,
    description = excluded.description,
    expires_at = excluded.expires_at,
    updated_at = now();

insert into public.organizations (
  id,
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
  '20000000-0000-4000-8000-000000000009',
  'Mici Prieteni Rescue',
  'Bucharest',
  'https://example.com/mici-prieteni',
  'https://instagram.com/mici-prieteni-demo',
  'PENDING',
  '10000000-0000-4000-8000-000000000001',
  'RESCUE_GROUP',
  'Ana Ionescu',
  'ana@mici-prieteni.local',
  null,
  null,
  'Pending M10 organization used for the live admin moderation console.'
)
on conflict (id) do update
set verification_status = excluded.verification_status,
    updated_at = now();

insert into public.organization_verification_requests (
  id,
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
  '70000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000009',
  '10000000-0000-4000-8000-000000000001',
  'PENDING',
  'RESCUE_GROUP',
  'Mici Prieteni Rescue',
  'Ana Ionescu',
  'ana@mici-prieteni.local',
  null,
  'Bucharest',
  'https://example.com/mici-prieteni',
  'https://instagram.com/mici-prieteni-demo',
  null,
  'Pending M10 organization used for the live admin moderation console.'
)
on conflict (id) do update
set status = excluded.status,
    updated_at = now();

insert into public.verification_documents (
  id,
  organization_id,
  storage_path,
  document_type,
  status,
  reviewed_by,
  reviewed_at
)
values (
  '71000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000009',
  'verification-documents/mici-prieteni-registration.pdf',
  'REGISTRATION_PROOF',
  'PENDING',
  null,
  null
)
on conflict (id) do update
set status = excluded.status,
    storage_path = excluded.storage_path,
    document_type = excluded.document_type,
    reviewed_by = null,
    reviewed_at = null;

insert into public.animals (
  id,
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
  '30000000-0000-4000-8000-000000000009',
  '20000000-0000-4000-8000-000000000001',
  'Nora',
  'DOG',
  'Mixed breed',
  24,
  'Medium',
  'FEMALE',
  'Gentle, careful with new people, does best with calm routines.',
  'Vaccinated and waiting for foster placement.'
)
on conflict (id) do update
set name = excluded.name,
    temperament = excluded.temperament,
    public_health_summary = excluded.public_health_summary,
    updated_at = now();

insert into public.animal_listings (
  id,
  animal_id,
  organization_id,
  mode,
  status,
  title,
  description,
  city,
  coarse_area,
  submitted_at,
  expires_at
)
values (
  '40000000-0000-4000-8000-000000000009',
  '30000000-0000-4000-8000-000000000009',
  '20000000-0000-4000-8000-000000000001',
  'FOSTER',
  'PENDING_REVIEW',
  'Nora needs a foster home',
  'Nora needs a patient foster while the rescue completes adoption screening.',
  'Bucharest',
  'Sector 2',
  now(),
  now() + interval '30 days'
)
on conflict (id) do update
set status = excluded.status,
    title = excluded.title,
    description = excluded.description,
    submitted_at = excluded.submitted_at,
    expires_at = excluded.expires_at,
    updated_at = now();

insert into public.reports (
  id,
  reporter_id,
  reported_profile_id,
  listing_id,
  category,
  details,
  status
)
values (
  '80000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  'SAFETY_CONCERN',
  'M10 seeded report for the live admin moderation console.',
  'OPEN'
)
on conflict (id) do update
set status = excluded.status,
    details = excluded.details;

insert into public.user_suspensions (
  id,
  profile_id,
  suspended_by,
  reason,
  ends_at
)
values (
  '90000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'M10 seeded active suspension for admin review.',
  null
)
on conflict (id) do update
set reason = excluded.reason,
    ends_at = excluded.ends_at;
