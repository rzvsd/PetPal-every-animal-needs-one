-- The hosted database lost foster_requests_view: 0034 dropped it, and the
-- statement that recreates it did not run there. The Foster tabs read their
-- requests from this view, so recreate it exactly as 0034 defines it.
-- `create or replace` is a no-op where the view already exists.

create or replace view public.foster_requests_view as
select r.*,a.name as animal_name,a.species,a.photo_url as photo,h.name as home_name,h.profile_id as home_owner_id,
  l.responsible_id as case_owner_id,sp.display_name as sender_name,rp.display_name as recipient_name,
  c.id as conversation_id,p.id as placement_id,p.status as placement_status,
  (h.profile_id = auth.uid()) as receiving_home_is_mine,p.outcome as placement_outcome,p.ended_at as placement_ended_at
from public.foster_requests r join public.animal_listings l on l.id = r.case_id join public.animals a on a.id = l.animal_id
join public.foster_home_profiles h on h.id = r.home_id join public.profiles sp on sp.id = r.sender_id
join public.profiles rp on rp.id = r.recipient_id left join public.conversations c on c.foster_request_id = r.id
left join public.foster_placements p on p.request_id = r.id where public.foster_request_visible(r.id);
grant select on public.foster_requests_view to authenticated;

notify pgrst, 'reload schema';
