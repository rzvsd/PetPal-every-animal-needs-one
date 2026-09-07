alter table public.conversations
  alter column application_id drop not null;

alter table public.conversations
  add column if not exists source text not null default 'FOSTER',
  add column if not exists match_id uuid,
  add column if not exists foster_invite_id uuid;

create table public.animal_match_likes (
  id uuid primary key default gen_random_uuid(),
  my_animal_id uuid not null references public.owner_animal_profiles(id) on delete cascade,
  target_animal_id uuid not null references public.owner_animal_profiles(id) on delete cascade,
  liker_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('PLAY', 'SOCIAL', 'VERIFIED_MATE')),
  created_at timestamptz not null default now(),
  unique (my_animal_id, target_animal_id, mode),
  check (my_animal_id <> target_animal_id)
);

create table public.animal_matches (
  id uuid primary key default gen_random_uuid(),
  animal_a_id uuid not null references public.owner_animal_profiles(id) on delete cascade,
  animal_b_id uuid not null references public.owner_animal_profiles(id) on delete cascade,
  mode text not null check (mode in ('PLAY', 'SOCIAL', 'VERIFIED_MATE')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  unique (animal_a_id, animal_b_id, mode),
  check (animal_a_id < animal_b_id)
);

create table public.foster_home_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  verified_status public.verification_status not null default 'PENDING',
  accepts_species public.species[] not null default array['DOG', 'CAT']::public.species[],
  accepts_sizes text[] not null default array['SMALL', 'MEDIUM'],
  max_animals_at_once integer not null default 1 check (max_animals_at_once between 1 and 10),
  availability_status text not null default 'LIMITED' check (availability_status in ('AVAILABLE', 'LIMITED', 'UNAVAILABLE')),
  available_from date,
  preferred_duration text not null default 'ONE_TWO_WEEKS' check (preferred_duration in ('FEW_DAYS', 'ONE_TWO_WEEKS', 'ONE_MONTH', 'UNTIL_ADOPTION', 'UNKNOWN')),
  housing_type text not null default 'Not specified',
  has_separate_room boolean not null default false,
  other_pets text,
  children_in_home text,
  experience_summary text not null default '',
  previous_foster_count integer not null default 0 check (previous_foster_count >= 0),
  can_transport boolean not null default false,
  can_handle_medical_needs boolean not null default false,
  needs_food_covered boolean not null default true,
  needs_vet_covered boolean not null default true,
  response_time_label text,
  bio text not null default '',
  photos text[] not null default '{}',
  past_fosters text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foster_home_profiles_sizes_check check (
    accepts_sizes <@ array['SMALL', 'MEDIUM', 'LARGE']::text[]
  )
);

create table public.foster_invites (
  id uuid primary key default gen_random_uuid(),
  foster_case_id uuid not null references public.animal_listings(id) on delete cascade,
  foster_home_profile_id uuid not null references public.foster_home_profiles(id) on delete cascade,
  sent_by_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'SENT' check (status in ('SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (foster_case_id, foster_home_profile_id)
);

create table public.foster_home_reviews (
  id uuid primary key default gen_random_uuid(),
  foster_home_profile_id uuid not null references public.foster_home_profiles(id) on delete cascade,
  foster_case_id uuid references public.animal_listings(id) on delete set null,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (foster_home_profile_id, foster_case_id, reviewer_id)
);

create table public.payment_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('STRIPE', 'NETOPIA')),
  purpose text not null check (purpose in ('DONATION', 'SPONSORSHIP', 'PREMIUM')),
  amount_cents integer not null check (amount_cents between 100 and 100000000),
  currency text not null default 'RON' check (currency in ('RON', 'EUR', 'USD')),
  status text not null default 'CREATED' check (status in ('CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELED')),
  checkout_url text,
  provider_session_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.animal_match_likes enable row level security;
alter table public.animal_matches enable row level security;
alter table public.foster_home_profiles enable row level security;
alter table public.foster_invites enable row level security;
alter table public.foster_home_reviews enable row level security;
alter table public.payment_sessions enable row level security;

alter table public.conversations
  add constraint conversations_match_id_fkey foreign key (match_id) references public.animal_matches(id) on delete cascade,
  add constraint conversations_foster_invite_id_fkey foreign key (foster_invite_id) references public.foster_invites(id) on delete cascade;

alter table public.conversations
  add constraint conversations_match_id_key unique (match_id),
  add constraint conversations_foster_invite_id_key unique (foster_invite_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'conversations_context_check'
      and conrelid = 'public.conversations'::regclass
  ) then
    alter table public.conversations
      add constraint conversations_context_check check (
        (source = 'FOSTER' and application_id is not null and match_id is null and foster_invite_id is null)
        or (source = 'MATCH' and application_id is null and match_id is not null and foster_invite_id is null)
        or (source = 'FOSTER_INVITE' and application_id is null and match_id is null and foster_invite_id is not null)
      );
  end if;
end $$;

create policy animal_match_likes_self_read
on public.animal_match_likes for select to authenticated
using (liker_id = auth.uid() or public.is_admin());

create policy animal_matches_participant_read
on public.animal_matches for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.owner_animal_profiles oap
    where oap.owner_id = auth.uid()
      and oap.id in (animal_a_id, animal_b_id)
  )
);

create policy foster_home_profiles_self_read
on public.foster_home_profiles for select to authenticated
using (profile_id = auth.uid() or public.is_admin());

create policy foster_home_profiles_self_insert
on public.foster_home_profiles for insert to authenticated
with check (profile_id = auth.uid());

create policy foster_home_profiles_self_update
on public.foster_home_profiles for update to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy foster_invites_involved_read
on public.foster_invites for select to authenticated
using (
  sent_by_user_id = auth.uid()
  or public.is_listing_org_member(foster_case_id)
  or exists (
    select 1
    from public.foster_home_profiles fhp
    where fhp.id = foster_home_profile_id
      and fhp.profile_id = auth.uid()
  )
  or public.is_admin()
);

create policy foster_home_reviews_involved_read
on public.foster_home_reviews for select to authenticated
using (
  reviewer_id = auth.uid()
  or exists (
    select 1
    from public.foster_home_profiles fhp
    where fhp.id = foster_home_profile_id
      and fhp.profile_id = auth.uid()
  )
  or public.is_admin()
);

create policy payment_sessions_self_read
on public.payment_sessions for select to authenticated
using (profile_id = auth.uid() or public.is_admin());

create or replace view public.match_candidates_view as
select
  oap.id as animal_id,
  oap.owner_id,
  oap.name,
  oap.species,
  oap.breed_or_mix,
  oap.is_mixed_breed,
  oap.approximate_age_months,
  oap.sex,
  oap.size_label,
  oap.weight_kg,
  oap.sterilized_status,
  oap.vaccine_status,
  oap.health_document_status,
  oap.admin_mate_approval_status,
  oap.temperament_tags,
  oap.energy_level,
  oap.good_with_dogs,
  oap.good_with_cats,
  oap.good_with_children,
  oap.city,
  oap.coarse_area,
  oap.photo_urls,
  oap.active_match_modes,
  oap.profile_completeness,
  oap.verification_status,
  p.verification_status as owner_verification_status,
  exists (
    select 1
    from public.animal_match_likes aml
    join public.owner_animal_profiles mine on mine.id = aml.target_animal_id
    where aml.my_animal_id = oap.id
      and mine.owner_id = auth.uid()
  ) as has_liked_back
from public.owner_animal_profiles oap
join public.profiles p on p.id = oap.owner_id
where oap.owner_id <> auth.uid()
  and oap.profile_completeness >= 50
  and coalesce(array_length(oap.photo_urls, 1), 0) > 0;

create or replace view public.foster_home_profiles_view as
select
  fhp.id,
  fhp.profile_id,
  p.display_name,
  p.city,
  p.coarse_area,
  fhp.verified_status,
  fhp.accepts_species,
  fhp.accepts_sizes,
  fhp.max_animals_at_once,
  fhp.availability_status,
  fhp.available_from,
  fhp.preferred_duration,
  fhp.housing_type,
  fhp.has_separate_room,
  fhp.other_pets,
  fhp.children_in_home,
  fhp.experience_summary,
  fhp.previous_foster_count,
  fhp.can_transport,
  fhp.can_handle_medical_needs,
  fhp.needs_food_covered,
  fhp.needs_vet_covered,
  fhp.response_time_label,
  fhp.bio,
  fhp.photos,
  fhp.past_fosters,
  round(avg(fhr.rating)::numeric, 1) as rating_average,
  count(fhr.id)::integer as review_count
from public.foster_home_profiles fhp
join public.profiles p on p.id = fhp.profile_id
left join public.foster_home_reviews fhr on fhr.foster_home_profile_id = fhp.id
where fhp.availability_status <> 'UNAVAILABLE'
group by fhp.id, p.id;

create or replace view public.my_foster_invites_view as
select
  fi.id,
  fi.foster_case_id,
  fi.foster_home_profile_id,
  fi.sent_by_user_id,
  fi.status,
  fi.message,
  fi.created_at,
  fi.updated_at
from public.foster_invites fi
where fi.sent_by_user_id = auth.uid()
  or public.is_listing_org_member(fi.foster_case_id)
  or exists (
    select 1
    from public.foster_home_profiles fhp
    where fhp.id = fi.foster_home_profile_id
      and fhp.profile_id = auth.uid()
  );

drop view if exists public.my_conversations_view;

create view public.my_conversations_view as
select
  c.id as conversation_id,
  c.source,
  c.application_id,
  null::uuid as match_id,
  null::uuid as foster_invite_id,
  app.status::text as application_status,
  l.id as listing_id,
  a.name as animal_name,
  null::text as related_animal_name,
  null::text as match_mode,
  l.city,
  l.coarse_area,
  o.name as organization_name,
  o.verification_status::text as organization_verification_status,
  (
    select array_agg(cp_other.profile_id)
    from public.conversation_participants cp_other
    where cp_other.conversation_id = c.id
      and cp_other.profile_id <> auth.uid()
  ) as other_participant_ids,
  exists (
    select 1 from public.blocks b
    where b.blocker_id = auth.uid()
      and b.blocked_id = any(
        coalesce((
          select array_agg(cp_other.profile_id)
          from public.conversation_participants cp_other
          where cp_other.conversation_id = c.id
            and cp_other.profile_id <> auth.uid()
        ), '{}')
      )
  ) as blocked_by_me,
  exists (
    select 1 from public.reports r
    where r.reporter_id = auth.uid()
      and r.details like '%' || c.id::text || '%'
  ) as reported_by_me,
  (
    select m.body
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) as last_message_body,
  (
    select m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) as last_message_at,
  c.created_at
from public.conversations c
join public.conversation_participants cp on cp.conversation_id = c.id
join public.applications app on app.id = c.application_id
join public.animal_listings l on l.id = app.listing_id
join public.animals a on a.id = l.animal_id
join public.organizations o on o.id = l.organization_id
where cp.profile_id = auth.uid()
  and c.source = 'FOSTER'
union all
select
  c.id as conversation_id,
  c.source,
  null::uuid as application_id,
  am.id as match_id,
  null::uuid as foster_invite_id,
  am.status as application_status,
  null::uuid as listing_id,
  mine.name as animal_name,
  theirs.name as related_animal_name,
  am.mode as match_mode,
  theirs.city,
  theirs.coarse_area,
  null::text as organization_name,
  theirs.verification_status::text as organization_verification_status,
  (
    select array_agg(cp_other.profile_id)
    from public.conversation_participants cp_other
    where cp_other.conversation_id = c.id
      and cp_other.profile_id <> auth.uid()
  ) as other_participant_ids,
  exists (
    select 1 from public.blocks b
    where b.blocker_id = auth.uid()
      and b.blocked_id = any(
        coalesce((
          select array_agg(cp_other.profile_id)
          from public.conversation_participants cp_other
          where cp_other.conversation_id = c.id
            and cp_other.profile_id <> auth.uid()
        ), '{}')
      )
  ) as blocked_by_me,
  exists (
    select 1 from public.reports r
    where r.reporter_id = auth.uid()
      and r.details like '%' || c.id::text || '%'
  ) as reported_by_me,
  (
    select m.body
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) as last_message_body,
  (
    select m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) as last_message_at,
  c.created_at
from public.conversations c
join public.conversation_participants cp on cp.conversation_id = c.id
join public.animal_matches am on am.id = c.match_id
join public.owner_animal_profiles mine on mine.owner_id = auth.uid()
  and mine.id in (am.animal_a_id, am.animal_b_id)
join public.owner_animal_profiles theirs on theirs.id in (am.animal_a_id, am.animal_b_id)
  and theirs.owner_id <> auth.uid()
where cp.profile_id = auth.uid()
  and c.source = 'MATCH'
union all
select
  c.id as conversation_id,
  c.source,
  null::uuid as application_id,
  null::uuid as match_id,
  fi.id as foster_invite_id,
  fi.status as application_status,
  l.id as listing_id,
  a.name as animal_name,
  p.display_name as related_animal_name,
  null::text as match_mode,
  l.city,
  l.coarse_area,
  p.display_name as organization_name,
  fhp.verified_status::text as organization_verification_status,
  (
    select array_agg(cp_other.profile_id)
    from public.conversation_participants cp_other
    where cp_other.conversation_id = c.id
      and cp_other.profile_id <> auth.uid()
  ) as other_participant_ids,
  false as blocked_by_me,
  exists (
    select 1 from public.reports r
    where r.reporter_id = auth.uid()
      and r.details like '%' || c.id::text || '%'
  ) as reported_by_me,
  (
    select m.body
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) as last_message_body,
  (
    select m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) as last_message_at,
  c.created_at
from public.conversations c
join public.conversation_participants cp on cp.conversation_id = c.id
join public.foster_invites fi on fi.id = c.foster_invite_id
join public.foster_home_profiles fhp on fhp.id = fi.foster_home_profile_id
join public.profiles p on p.id = fhp.profile_id
join public.animal_listings l on l.id = fi.foster_case_id
join public.animals a on a.id = l.animal_id
where cp.profile_id = auth.uid()
  and c.source = 'FOSTER_INVITE';

grant select on public.match_candidates_view to authenticated;
grant select on public.foster_home_profiles_view to authenticated;
grant select on public.my_foster_invites_view to authenticated;
grant select on public.my_conversations_view to authenticated;

create or replace function public.like_match_candidate(
  my_animal_id_input uuid,
  target_animal_id_input uuid,
  mode_input text
)
returns table (matched boolean, match_id uuid, conversation_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  my_owner uuid;
  target_owner uuid;
  a_id uuid;
  b_id uuid;
  match_result uuid;
  conversation_result uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if mode_input not in ('PLAY', 'SOCIAL', 'VERIFIED_MATE') then
    raise exception 'Unsupported match mode';
  end if;

  select owner_id into my_owner
  from public.owner_animal_profiles
  where id = my_animal_id_input;

  select owner_id into target_owner
  from public.owner_animal_profiles
  where id = target_animal_id_input;

  if my_owner <> auth.uid() or target_owner is null or target_owner = auth.uid() then
    raise exception 'Match candidate not available';
  end if;

  if not exists (
    select 1
    from public.owner_animal_profiles
    where id = my_animal_id_input
      and mode_input = any(active_match_modes)
      and (
        mode_input <> 'VERIFIED_MATE'
        or (health_document_status = 'VERIFIED' and admin_mate_approval_status = 'VERIFIED')
      )
  ) or not exists (
    select 1
    from public.owner_animal_profiles
    where id = target_animal_id_input
      and mode_input = any(active_match_modes)
      and profile_completeness >= 50
      and coalesce(array_length(photo_urls, 1), 0) > 0
      and (
        mode_input <> 'VERIFIED_MATE'
        or (health_document_status = 'VERIFIED' and admin_mate_approval_status = 'VERIFIED')
      )
  ) then
    raise exception 'Match mode is not available for both animals';
  end if;

  insert into public.animal_match_likes (my_animal_id, target_animal_id, liker_id, mode)
  values (my_animal_id_input, target_animal_id_input, auth.uid(), mode_input)
  on conflict (my_animal_id, target_animal_id, mode) do update
    set created_at = public.animal_match_likes.created_at;

  if exists (
    select 1
    from public.animal_match_likes
    where my_animal_id = target_animal_id_input
      and target_animal_id = my_animal_id_input
      and mode = mode_input
  ) then
    a_id := least(my_animal_id_input, target_animal_id_input);
    b_id := greatest(my_animal_id_input, target_animal_id_input);

    insert into public.animal_matches (animal_a_id, animal_b_id, mode)
    values (a_id, b_id, mode_input)
    on conflict (animal_a_id, animal_b_id, mode) do update
      set status = 'ACTIVE'
    returning id into match_result;

    insert into public.conversations (source, match_id)
    values ('MATCH', match_result)
    on conflict on constraint conversations_match_id_key do update
      set match_id = excluded.match_id
    returning id into conversation_result;

    insert into public.conversation_participants (conversation_id, profile_id)
    values
      (conversation_result, my_owner),
      (conversation_result, target_owner)
    on conflict do nothing;

    return query select true, match_result, conversation_result;
    return;
  end if;

  return query select false, null::uuid, null::uuid;
end;
$$;

create or replace function public.upsert_my_foster_home_profile(
  accepts_species_input public.species[],
  accepts_sizes_input text[],
  availability_status_input text,
  housing_type_input text,
  bio_input text,
  max_animals_at_once_input integer default 1,
  available_from_input date default null,
  preferred_duration_input text default 'ONE_TWO_WEEKS',
  has_separate_room_input boolean default false,
  other_pets_input text default null,
  children_in_home_input text default null,
  experience_summary_input text default '',
  previous_foster_count_input integer default 0,
  can_transport_input boolean default false,
  can_handle_medical_needs_input boolean default false,
  needs_food_covered_input boolean default true,
  needs_vet_covered_input boolean default true,
  response_time_label_input text default null,
  photos_input text[] default '{}',
  past_fosters_input text[] default '{}'
)
returns public.foster_home_profiles
language plpgsql
security invoker
set search_path = public
as $$
declare
  upserted public.foster_home_profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.foster_home_profiles (
    profile_id,
    accepts_species,
    accepts_sizes,
    max_animals_at_once,
    availability_status,
    available_from,
    preferred_duration,
    housing_type,
    has_separate_room,
    other_pets,
    children_in_home,
    experience_summary,
    previous_foster_count,
    can_transport,
    can_handle_medical_needs,
    needs_food_covered,
    needs_vet_covered,
    response_time_label,
    bio,
    photos,
    past_fosters
  )
  values (
    auth.uid(),
    coalesce(accepts_species_input, array['DOG', 'CAT']::public.species[]),
    coalesce(accepts_sizes_input, array['SMALL', 'MEDIUM']),
    coalesce(max_animals_at_once_input, 1),
    coalesce(availability_status_input, 'LIMITED'),
    available_from_input,
    coalesce(preferred_duration_input, 'ONE_TWO_WEEKS'),
    coalesce(nullif(trim(housing_type_input), ''), 'Not specified'),
    coalesce(has_separate_room_input, false),
    nullif(trim(coalesce(other_pets_input, '')), ''),
    nullif(trim(coalesce(children_in_home_input, '')), ''),
    coalesce(nullif(trim(experience_summary_input), ''), ''),
    coalesce(previous_foster_count_input, 0),
    coalesce(can_transport_input, false),
    coalesce(can_handle_medical_needs_input, false),
    coalesce(needs_food_covered_input, true),
    coalesce(needs_vet_covered_input, true),
    nullif(trim(coalesce(response_time_label_input, '')), ''),
    coalesce(nullif(trim(bio_input), ''), ''),
    coalesce(photos_input, '{}'),
    coalesce(past_fosters_input, '{}')
  )
  on conflict (profile_id) do update
    set accepts_species = excluded.accepts_species,
        accepts_sizes = excluded.accepts_sizes,
        max_animals_at_once = excluded.max_animals_at_once,
        availability_status = excluded.availability_status,
        available_from = excluded.available_from,
        preferred_duration = excluded.preferred_duration,
        housing_type = excluded.housing_type,
        has_separate_room = excluded.has_separate_room,
        other_pets = excluded.other_pets,
        children_in_home = excluded.children_in_home,
        experience_summary = excluded.experience_summary,
        previous_foster_count = excluded.previous_foster_count,
        can_transport = excluded.can_transport,
        can_handle_medical_needs = excluded.can_handle_medical_needs,
        needs_food_covered = excluded.needs_food_covered,
        needs_vet_covered = excluded.needs_vet_covered,
        response_time_label = excluded.response_time_label,
        bio = excluded.bio,
        photos = excluded.photos,
        past_fosters = excluded.past_fosters,
        updated_at = now()
  returning * into upserted;

  return upserted;
end;
$$;

create or replace function public.send_foster_invite(
  foster_case_id_input uuid,
  foster_home_profile_id_input uuid,
  message_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_id_result uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_listing_org_member(foster_case_id_input) and not public.is_admin() then
    raise exception 'Only the rescue or shelter managing this case can invite foster homes';
  end if;

  insert into public.foster_invites (
    foster_case_id,
    foster_home_profile_id,
    sent_by_user_id,
    message
  )
  values (
    foster_case_id_input,
    foster_home_profile_id_input,
    auth.uid(),
    nullif(trim(coalesce(message_input, '')), '')
  )
  on conflict (foster_case_id, foster_home_profile_id) do update
    set message = excluded.message,
        status = 'SENT',
        updated_at = now()
  returning id into invite_id_result;

  return invite_id_result;
end;
$$;

create or replace function public.respond_to_foster_invite(
  foster_invite_id_input uuid,
  status_input text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.foster_invites;
  foster_home_owner uuid;
  conversation_result uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if status_input not in ('ACCEPTED', 'DECLINED') then
    raise exception 'Unsupported invite response';
  end if;

  select * into invite_row
  from public.foster_invites
  where id = foster_invite_id_input;

  select profile_id into foster_home_owner
  from public.foster_home_profiles
  where id = invite_row.foster_home_profile_id;

  if invite_row.id is null or foster_home_owner <> auth.uid() then
    raise exception 'Foster invite not found';
  end if;

  update public.foster_invites
  set status = status_input,
      updated_at = now()
  where id = foster_invite_id_input
  returning * into invite_row;

  if status_input = 'ACCEPTED' then
    insert into public.conversations (source, foster_invite_id)
    values ('FOSTER_INVITE', foster_invite_id_input)
    on conflict on constraint conversations_foster_invite_id_key do update
      set foster_invite_id = excluded.foster_invite_id
    returning id into conversation_result;

    insert into public.conversation_participants (conversation_id, profile_id)
    values
      (conversation_result, invite_row.sent_by_user_id),
      (conversation_result, foster_home_owner)
    on conflict do nothing;
  end if;

  return conversation_result;
end;
$$;

create or replace function public.rate_foster_home(
  foster_home_profile_id_input uuid,
  foster_case_id_input uuid,
  rating_input integer,
  comment_input text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  review_id_result uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.foster_home_reviews (
    foster_home_profile_id,
    foster_case_id,
    reviewer_id,
    rating,
    comment
  )
  values (
    foster_home_profile_id_input,
    foster_case_id_input,
    auth.uid(),
    rating_input,
    nullif(trim(coalesce(comment_input, '')), '')
  )
  on conflict (foster_home_profile_id, foster_case_id, reviewer_id) do update
    set rating = excluded.rating,
        comment = excluded.comment
  returning id into review_id_result;

  return review_id_result;
end;
$$;

create or replace function public.create_payment_session(
  provider_input text,
  purpose_input text,
  amount_cents_input integer,
  currency_input text default 'RON',
  metadata_input jsonb default '{}'::jsonb
)
returns public.payment_sessions
language plpgsql
security invoker
set search_path = public
as $$
declare
  session_result public.payment_sessions;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if purpose_input in ('PREMIUM') then
    raise exception 'Premium payments are not enabled yet';
  end if;

  insert into public.payment_sessions (
    profile_id,
    provider,
    purpose,
    amount_cents,
    currency,
    status,
    checkout_url,
    metadata
  )
  values (
    auth.uid(),
    provider_input,
    purpose_input,
    amount_cents_input,
    currency_input,
    'CREATED',
    'petpal://payments/' || gen_random_uuid()::text,
    coalesce(metadata_input, '{}'::jsonb)
  )
  returning * into session_result;

  return session_result;
end;
$$;

grant execute on function public.like_match_candidate(uuid, uuid, text) to authenticated;
grant execute on function public.upsert_my_foster_home_profile(public.species[], text[], text, text, text, integer, date, text, boolean, text, text, text, integer, boolean, boolean, boolean, boolean, text, text[], text[]) to authenticated;
grant execute on function public.send_foster_invite(uuid, uuid, text) to authenticated;
grant execute on function public.respond_to_foster_invite(uuid, text) to authenticated;
grant execute on function public.rate_foster_home(uuid, uuid, integer, text) to authenticated;
grant execute on function public.create_payment_session(text, text, integer, text, jsonb) to authenticated;
