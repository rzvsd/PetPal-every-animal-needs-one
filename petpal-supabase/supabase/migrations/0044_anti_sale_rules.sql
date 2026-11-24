-- Pilot rule set against selling animals and farming reviews.
-- 1. One sale-text check, with wider Romanian and English wording.
-- 2. Foster cases and foster homes are both scanned; a hit opens one
--    automatic report for the moderator (never blocks the save).
-- 3. A home can be reviewed only after the animal spent 48 hours in its care.

create or replace function public.looks_like_sale(text_input text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(text_input, '') ~* (
    '\m(v[aâ]nd|vind|v[aâ]nz[aă]ri?|vanzare|pre[tț]ul?|contra\s+cost|contra\s+cal[aă]|'
    || 'tax[aăe]\s+(de\s+)?adop[tț]i[ea]|adoption\s+fee|rehoming\s+fee|negociabil|negotiable|'
    || 'sell|selling|for\s+sale|price)\M'
    || '|\d+\s*(lei|ron|eur|euro|€|\$)'
  );
$$;
revoke all on function public.looks_like_sale(text) from public, anon;
grant execute on function public.looks_like_sale(text) to authenticated;

create or replace function public.flag_sale_like_foster_case()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.looks_like_sale(concat_ws(' ', new.title, new.description, new.medical_needs, new.home_fit))
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

create or replace function public.flag_sale_like_foster_home()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.looks_like_sale(concat_ws(' ', new.name, new.bio, new.experience_summary, new.website))
     and not exists (
       select 1 from public.reports r
       where r.reported_profile_id = new.profile_id and r.listing_id is null and r.reporter_id is null
         and r.category = 'AUTO_SALE_TEXT' and r.status = 'OPEN'
     ) then
    insert into public.reports(reporter_id, reported_profile_id, listing_id, category, details)
    values (null, new.profile_id, null, 'AUTO_SALE_TEXT',
      'Automatic flag: foster home text mentions a sale or a price.');
  end if;
  return new;
end;
$$;
revoke all on function public.flag_sale_like_foster_home() from public, anon, authenticated;

drop trigger if exists flag_sale_like_foster_home on public.foster_home_profiles;
create trigger flag_sale_like_foster_home
after insert or update of name, bio, experience_summary, website on public.foster_home_profiles
for each row execute function public.flag_sale_like_foster_home();

create or replace function public.review_foster_placement(placement_id_input uuid,rating_input integer,comment_input text)
returns uuid language plpgsql security definer set search_path = public as $$
declare p public.foster_placements; r public.foster_requests; result uuid;
begin
  if not public.foster_actor_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  select * into p from public.foster_placements where id = placement_id_input;
  select * into r from public.foster_requests where id = p.request_id;
  if p.status <> 'COMPLETED' or r.id is null or auth.uid() not in (r.sender_id,r.recipient_id) then
    raise exception 'Reviews require a completed placement between these participants'; end if;
  if exists(select 1 from public.foster_home_profiles h where h.id = p.home_id and h.profile_id = auth.uid())
    or exists(select 1 from public.foster_home_members m where m.home_id = p.home_id and m.profile_id = auth.uid() and m.status = 'ACTIVE') then
    raise exception 'You cannot review your own foster home'; end if;
  -- Two accounts cannot trade reviews through a placement that lasted minutes.
  if p.received_at is null or coalesce(p.ended_at, now()) - p.received_at < interval '48 hours' then
    raise exception 'Reviews open only after the animal spent 48 hours in care'; end if;
  if rating_input is null or rating_input not between 1 and 5 then raise exception 'Choose a rating from 1 to 5'; end if;
  if char_length(coalesce(comment_input,'')) > 2000 then raise exception 'Review is too long'; end if;
  insert into public.foster_home_reviews(foster_home_profile_id,foster_case_id,placement_id,reviewer_id,rating,comment)
    values(p.home_id,r.case_id,p.id,auth.uid(),rating_input,trim(comment_input))
    on conflict(placement_id,reviewer_id) where placement_id is not null do update set rating = excluded.rating,comment = excluded.comment
    returning id into result;
  return result;
end $$;
