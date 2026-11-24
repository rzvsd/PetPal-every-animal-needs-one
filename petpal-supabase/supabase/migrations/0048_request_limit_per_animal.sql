-- Seeding a rescue (pilot list item 5): one animal cannot collect more than
-- 10 open requests at once, so a popular post does not bury its owner and a
-- burst of offers cannot be used to spam. Answering or withdrawing one frees a place.

create or replace function public.limit_open_requests_per_animal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('foster-case-open-requests:' || new.case_id::text, 0));
  if (select count(*) from public.foster_requests r where r.case_id = new.case_id and r.status = 'PENDING') >= 10 then
    raise exception 'This animal already has 10 open offers. Try another animal, or try again after the owner answers.';
  end if;
  return new;
end $$;
revoke all on function public.limit_open_requests_per_animal() from public, anon, authenticated;
create trigger limit_open_requests_per_animal before insert on public.foster_requests
  for each row execute function public.limit_open_requests_per_animal();
