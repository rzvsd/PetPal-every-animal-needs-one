create table public.owner_animal_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  species public.species not null,
  breed_or_mix text,
  is_mixed_breed boolean not null default false,
  approximate_age_months integer check (approximate_age_months is null or approximate_age_months between 0 and 360),
  sex text not null default 'UNKNOWN' check (sex in ('FEMALE', 'MALE', 'UNKNOWN')),
  size_label text check (size_label is null or size_label in ('SMALL', 'MEDIUM', 'LARGE')),
  weight_kg numeric(6,2) check (weight_kg is null or weight_kg between 0 and 200),
  sterilized_status text not null default 'UNKNOWN' check (sterilized_status in ('YES', 'NO', 'UNKNOWN')),
  vaccine_status text not null default 'UNKNOWN' check (vaccine_status in ('UP_TO_DATE', 'PARTIAL', 'EXPIRED', 'UNKNOWN')),
  health_document_status text not null default 'UNVERIFIED' check (health_document_status in ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED')),
  admin_mate_approval_status text not null default 'UNVERIFIED' check (admin_mate_approval_status in ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED', 'LOCKED')),
  temperament_tags text[] not null default '{}',
  energy_level text check (energy_level is null or energy_level in ('LOW', 'MEDIUM', 'HIGH')),
  good_with_dogs boolean,
  good_with_cats boolean,
  good_with_children boolean,
  city text,
  coarse_area text,
  photo_urls text[] not null default '{}',
  active_match_modes text[] not null default array['PLAY', 'SOCIAL'],
  profile_completeness integer not null default 0 check (profile_completeness between 0 and 100),
  verification_status text not null default 'UNVERIFIED' check (verification_status in ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_animal_profiles_modes_check check (
    active_match_modes <@ array['PLAY', 'SOCIAL', 'VERIFIED_MATE']::text[]
  )
);

create index owner_animal_profiles_owner_id_idx
on public.owner_animal_profiles (owner_id, created_at desc);

alter table public.owner_animal_profiles enable row level security;

create policy owner_animal_profiles_self_read
on public.owner_animal_profiles for select to authenticated
using (owner_id = auth.uid());

create policy owner_animal_profiles_self_insert
on public.owner_animal_profiles for insert to authenticated
with check (owner_id = auth.uid());

create policy owner_animal_profiles_self_update
on public.owner_animal_profiles for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy owner_animal_profiles_self_delete
on public.owner_animal_profiles for delete to authenticated
using (owner_id = auth.uid());

create or replace function public.calculate_owner_animal_completeness(
  name_input text,
  species_input public.species,
  breed_or_mix_input text,
  approximate_age_months_input integer,
  sex_input text,
  size_label_input text,
  vaccine_status_input text,
  sterilized_status_input text,
  temperament_tags_input text[],
  city_input text,
  coarse_area_input text,
  photo_urls_input text[]
)
returns integer
language sql
immutable
as $$
  select (
    case when nullif(trim(coalesce(name_input, '')), '') is not null then 10 else 0 end +
    case when species_input is not null then 10 else 0 end +
    case when nullif(trim(coalesce(breed_or_mix_input, '')), '') is not null then 10 else 0 end +
    case when approximate_age_months_input is not null then 10 else 0 end +
    case when coalesce(sex_input, 'UNKNOWN') <> 'UNKNOWN' then 10 else 0 end +
    case when nullif(trim(coalesce(size_label_input, '')), '') is not null then 10 else 0 end +
    case when coalesce(vaccine_status_input, 'UNKNOWN') <> 'UNKNOWN' then 10 else 0 end +
    case when coalesce(sterilized_status_input, 'UNKNOWN') <> 'UNKNOWN' then 10 else 0 end +
    case when coalesce(array_length(temperament_tags_input, 1), 0) > 0 then 10 else 0 end +
    case when nullif(trim(coalesce(city_input, '')), '') is not null
       and nullif(trim(coalesce(coarse_area_input, '')), '') is not null then 5 else 0 end +
    case when coalesce(array_length(photo_urls_input, 1), 0) > 0 then 5 else 0 end
  )::integer;
$$;

create or replace function public.upsert_owner_animal_profile(
  animal_id_input uuid,
  name_input text,
  species_input public.species,
  breed_or_mix_input text,
  is_mixed_breed_input boolean,
  approximate_age_months_input integer,
  sex_input text,
  size_label_input text,
  weight_kg_input numeric,
  sterilized_status_input text,
  vaccine_status_input text,
  temperament_tags_input text[],
  energy_level_input text,
  good_with_dogs_input boolean,
  good_with_cats_input boolean,
  good_with_children_input boolean,
  city_input text,
  coarse_area_input text,
  photo_urls_input text[],
  active_match_modes_input text[]
)
returns public.owner_animal_profiles
language plpgsql
security invoker
set search_path = public
as $$
declare
  upserted public.owner_animal_profiles;
  completeness integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  completeness := public.calculate_owner_animal_completeness(
    name_input,
    species_input,
    breed_or_mix_input,
    approximate_age_months_input,
    sex_input,
    size_label_input,
    vaccine_status_input,
    sterilized_status_input,
    coalesce(temperament_tags_input, '{}'),
    city_input,
    coarse_area_input,
    coalesce(photo_urls_input, '{}')
  );

  if animal_id_input is null then
    insert into public.owner_animal_profiles (
      owner_id,
      name,
      species,
      breed_or_mix,
      is_mixed_breed,
      approximate_age_months,
      sex,
      size_label,
      weight_kg,
      sterilized_status,
      vaccine_status,
      temperament_tags,
      energy_level,
      good_with_dogs,
      good_with_cats,
      good_with_children,
      city,
      coarse_area,
      photo_urls,
      active_match_modes,
      profile_completeness
    )
    values (
      auth.uid(),
      name_input,
      species_input,
      nullif(trim(coalesce(breed_or_mix_input, '')), ''),
      coalesce(is_mixed_breed_input, false),
      approximate_age_months_input,
      coalesce(sex_input, 'UNKNOWN'),
      size_label_input,
      weight_kg_input,
      coalesce(sterilized_status_input, 'UNKNOWN'),
      coalesce(vaccine_status_input, 'UNKNOWN'),
      coalesce(temperament_tags_input, '{}'),
      energy_level_input,
      good_with_dogs_input,
      good_with_cats_input,
      good_with_children_input,
      city_input,
      coarse_area_input,
      coalesce(photo_urls_input, '{}'),
      coalesce(active_match_modes_input, array['PLAY', 'SOCIAL']),
      completeness
    )
    returning * into upserted;
  else
    update public.owner_animal_profiles
    set name = name_input,
        species = species_input,
        breed_or_mix = nullif(trim(coalesce(breed_or_mix_input, '')), ''),
        is_mixed_breed = coalesce(is_mixed_breed_input, false),
        approximate_age_months = approximate_age_months_input,
        sex = coalesce(sex_input, 'UNKNOWN'),
        size_label = size_label_input,
        weight_kg = weight_kg_input,
        sterilized_status = coalesce(sterilized_status_input, 'UNKNOWN'),
        vaccine_status = coalesce(vaccine_status_input, 'UNKNOWN'),
        temperament_tags = coalesce(temperament_tags_input, '{}'),
        energy_level = energy_level_input,
        good_with_dogs = good_with_dogs_input,
        good_with_cats = good_with_cats_input,
        good_with_children = good_with_children_input,
        city = city_input,
        coarse_area = coarse_area_input,
        photo_urls = coalesce(photo_urls_input, '{}'),
        active_match_modes = coalesce(active_match_modes_input, array['PLAY', 'SOCIAL']),
        profile_completeness = completeness,
        updated_at = now()
    where id = animal_id_input
      and owner_id = auth.uid()
    returning * into upserted;

    if upserted.id is null then
      raise exception 'Animal profile not found';
    end if;
  end if;

  return upserted;
end;
$$;

create or replace view public.my_animal_profiles_view as
select
  id,
  owner_id,
  name,
  species,
  breed_or_mix,
  is_mixed_breed,
  approximate_age_months,
  sex,
  size_label,
  weight_kg,
  sterilized_status,
  vaccine_status,
  health_document_status,
  admin_mate_approval_status,
  temperament_tags,
  energy_level,
  good_with_dogs,
  good_with_cats,
  good_with_children,
  city,
  coarse_area,
  photo_urls,
  active_match_modes,
  profile_completeness,
  verification_status,
  created_at,
  updated_at
from public.owner_animal_profiles
where owner_id = auth.uid();

grant select on public.my_animal_profiles_view to authenticated;
