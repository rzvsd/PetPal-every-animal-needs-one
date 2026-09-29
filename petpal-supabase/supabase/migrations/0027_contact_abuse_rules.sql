-- M3 contact and abuse rules: limited social walk requests, automatic
-- moderation flags, foster case limits, uploaded-only foster photos and
-- persistent passes.

-- 1. Social walks: dogs only, at most 5 new requests a day. One request per
-- owner pair, block and suspension checks were already enforced.
create or replace function public.request_social_walk(my_animal_id_input uuid, target_animal_id_input uuid, body_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare my_owner uuid; target_owner uuid; existing_id uuid; match_result uuid; conversation_result uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if body_input is null or char_length(trim(body_input)) < 1 or char_length(body_input) > 4000 then
    raise exception 'Message body must be between 1 and 4000 characters'; end if;
  select owner_id into my_owner from public.owner_animal_profiles where id = my_animal_id_input;
  select owner_id into target_owner from public.owner_animal_profiles where id = target_animal_id_input;
  if my_owner is distinct from auth.uid() or target_owner is null or target_owner = auth.uid()
    or public.is_profile_blocked_between(my_owner,target_owner) then
    raise exception 'Social Walk profile is not available'; end if;
  if not exists (select 1 from public.owner_animal_profiles where id = my_animal_id_input
    and 'SOCIAL' = any(active_match_modes)) or not exists (
    select 1 from public.match_candidates_view where animal_id = target_animal_id_input
      and 'SOCIAL' = any(active_match_modes)
  ) then raise exception 'Social Walk must be enabled for both animals'; end if;
  if (select count(*) from public.owner_animal_profiles
      where id in (my_animal_id_input, target_animal_id_input) and species = 'DOG') < 2 then
    raise exception 'Social walks are for dogs only'; end if;

  -- One request per owner pair, even with multiple animals or concurrent reciprocal requests.
  perform pg_advisory_xact_lock(hashtextextended('social:' || least(my_owner,target_owner)::text || greatest(my_owner,target_owner)::text,0));
  select c.id into existing_id from public.conversations c
    join public.animal_matches am on am.id = c.match_id and am.mode = 'SOCIAL'
    join public.conversation_participants a on a.conversation_id = c.id and a.profile_id = my_owner
    join public.conversation_participants b on b.conversation_id = c.id and b.profile_id = target_owner
    order by (c.social_request_status is not null) desc,c.created_at desc limit 1;
  if existing_id is not null then return existing_id; end if;

  if (select count(*) from public.conversations c
      where c.social_request_sender_id = my_owner and c.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Daily walk request limit reached. Try again tomorrow.'; end if;

  insert into public.animal_matches(animal_a_id,animal_b_id,mode)
    values(least(my_animal_id_input,target_animal_id_input),greatest(my_animal_id_input,target_animal_id_input),'SOCIAL')
    returning id into match_result;
  insert into public.conversations(source,match_id,social_request_sender_id,social_request_status)
    values('MATCH',match_result,my_owner,'PENDING') returning id into conversation_result;
  insert into public.conversation_participants(conversation_id,profile_id)
    values(conversation_result,my_owner),(conversation_result,target_owner);
  perform public.send_conversation_message(conversation_result,body_input,gen_random_uuid());
  return conversation_result;
end $$;

-- 2. Reports without a reporter are automatic PetPal flags for moderators.
-- Only reports a person files count against their daily limit.
alter table public.reports alter column reporter_id drop not null;

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

  if new.reporter_id is not null and new.reporter_id = auth.uid() and (
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

-- 3. Foster cases whose text looks like a sale are queued for moderators.
-- Participants still publish directly; this is a flag, not an approval step.
create or replace function public.flag_sale_like_foster_case()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if concat_ws(' ', new.title, new.description, new.medical_needs, new.home_fit)
       ~* '\m(v[aâ]nd|v[aâ]nzare|pre[tț]ul?|sell|selling|for sale|price)\M|\d+\s*(lei|ron|eur|euro|€|\$)'
     and not exists (
       select 1 from public.reports r
       where r.listing_id = new.id and r.reporter_id is null and r.category = 'AUTO_SALE_TEXT' and r.status = 'OPEN'
     ) then
    insert into public.reports(reporter_id, reported_profile_id, listing_id, category, details)
    values (null, new.responsible_id, new.id, 'AUTO_SALE_TEXT',
      'Automatic flag: foster case text mentions a sale or a price.');
  end if;
  return new;
end;
$$;

create trigger flag_sale_like_foster_case
after insert or update of title, description, medical_needs, home_fit on public.animal_listings
for each row when (new.mode = 'FOSTER')
execute function public.flag_sale_like_foster_case();

-- 4. At most 5 new foster cases per person a day.
create or replace function public.limit_new_foster_cases()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and (
    select count(*) from public.animal_listings l
    where l.responsible_id = auth.uid() and l.mode = 'FOSTER' and l.created_at > now() - interval '1 day'
  ) >= 5 then
    raise exception 'Daily foster case limit reached. Try again tomorrow.';
  end if;
  return new;
end;
$$;

create trigger limit_new_foster_cases
before insert on public.animal_listings
for each row when (new.mode = 'FOSTER')
execute function public.limit_new_foster_cases();

-- 5. Foster photos must be files the person uploaded to PetPal, stored as the
-- object path (<uid>/<id>/<file>). Arbitrary URLs would load third-party
-- content on viewers' devices and reveal their IP addresses. Unchanged legacy
-- values are kept.
create or replace function public.is_own_uploaded_photo(value text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select value like auth.uid()::text || '/%'
    and exists (select 1 from storage.objects o where o.bucket_id = 'animal-photos' and o.name = value);
$$;

revoke all on function public.is_own_uploaded_photo(text) from public, anon;
grant execute on function public.is_own_uploaded_photo(text) to authenticated;

create or replace function public.guard_foster_animal_photo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and coalesce(new.photo_url, '') <> ''
     and (tg_op = 'INSERT' or new.photo_url is distinct from old.photo_url)
     and not public.is_own_uploaded_photo(new.photo_url) then
    raise exception 'Photos must be uploaded in PetPal';
  end if;
  return new;
end;
$$;

create trigger guard_foster_animal_photo
before insert or update of photo_url on public.animals
for each row execute function public.guard_foster_animal_photo();

create or replace function public.guard_foster_home_photos()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and exists (
    select 1 from unnest(new.photos) as photo
    where photo <> ''
      and (tg_op = 'INSERT' or not photo = any(old.photos))
      and not public.is_own_uploaded_photo(photo)
  ) then
    raise exception 'Photos must be uploaded in PetPal';
  end if;
  return new;
end;
$$;

create trigger guard_foster_home_photos
before insert or update of photos on public.foster_home_profiles
for each row execute function public.guard_foster_home_photos();

-- 6. Reservations beyond a home's declared capacity are shown to moderators
-- as a welfare signal. The participant acknowledgement is unchanged.
create or replace function public.flag_capacity_override()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(public.foster_capacity_warning(new.home_id, new.animal_id), false) then
    insert into public.reports(reporter_id, reported_profile_id, listing_id, category, details)
    select null, h.profile_id,
      (select r.case_id from public.foster_requests r where r.id = new.request_id),
      'CAPACITY_OVERRIDE', 'Automatic flag: a reservation exceeds the home''s declared capacity, availability or species.'
    from public.foster_home_profiles h where h.id = new.home_id;
  end if;
  return new;
end;
$$;

create trigger flag_capacity_override
before insert on public.foster_placements
for each row execute function public.flag_capacity_override();

-- 7. Passing on an animal is remembered, so it does not reappear.
create table public.match_passes (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  my_animal_id uuid not null references public.owner_animal_profiles(id) on delete cascade,
  target_animal_id uuid not null references public.owner_animal_profiles(id) on delete cascade,
  mode text not null check (mode in ('PLAY', 'SOCIAL')),
  created_at timestamptz not null default now(),
  primary key (my_animal_id, target_animal_id, mode)
);

alter table public.match_passes enable row level security;

create policy match_passes_owner_read
on public.match_passes for select to authenticated
using (profile_id = auth.uid());

create policy match_passes_owner_insert
on public.match_passes for insert to authenticated
with check (
  profile_id = auth.uid()
  and exists (select 1 from public.owner_animal_profiles a where a.id = my_animal_id and a.owner_id = auth.uid())
);

grant select, insert on public.match_passes to authenticated;

create or replace function public.discover_match_candidates(my_animal_id_input uuid, mode_input text, filters_input jsonb default '{}'::jsonb,
  saved_only_input boolean default false, after_id_input uuid default null::uuid)
returns setof public.match_candidates_view
language plpgsql
stable
security definer
set search_path = public
as $$
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
    and (saved_only_input or not exists(select 1 from public.match_passes p where p.my_animal_id = my_animal_id_input
      and p.target_animal_id = c.animal_id and p.mode = mode_input))
    order by c.animal_id limit 20;
end $$;

-- Passes are personal data: deleted with the account and included in exports.
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
  delete from public.match_passes where profile_id = profile_id_input;
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
    'matchPasses', (select coalesce(jsonb_agg(jsonb_build_object('myAnimalId', p.my_animal_id, 'targetAnimalId', p.target_animal_id,
      'mode', p.mode, 'createdAt', p.created_at)), '[]') from public.match_passes p where p.profile_id = auth.uid()),
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
