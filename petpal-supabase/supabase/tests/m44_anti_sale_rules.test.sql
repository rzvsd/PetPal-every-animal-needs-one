begin;
select no_plan();

-- Sale wording (0044): wider Romanian and English phrases, and homes are scanned too.
select ok(public.looks_like_sale('Vind pui de pisică'), '"vind" is sale wording');
select ok(public.looks_like_sale('Se dă contra cost'), '"contra cost" is sale wording');
select ok(public.looks_like_sale('Taxă de adopție simbolică'), '"taxă de adopție" is sale wording');
select ok(public.looks_like_sale('Small rehoming fee'), '"rehoming fee" is sale wording');
select ok(public.looks_like_sale('Doar 200 lei'), 'an amount in lei is flagged');
select ok(not public.looks_like_sale('Friendly cat, needs a quiet home for two weeks.'), 'ordinary text is not flagged');
select ok(not public.looks_like_sale('Prefer să fie singura pisică din casă.'), 'Romanian text with "pre" inside a word is not flagged');

insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000004401','m44home@example.test');
insert into public.profiles(id,display_name,city) values ('10000000-0000-4000-8000-000000004401','M44 Home','Bucharest');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000004401',true);
create temp table home(id uuid) on commit drop;
grant all on home to authenticated;
insert into home select public.save_foster_home(null,'{"name":"Pui de vânzare","city":"Bucharest","published":true,"capacity":2}');
reset role;
select is((select count(*) from public.reports where reported_profile_id = '10000000-0000-4000-8000-000000004401'
  and reporter_id is null and listing_id is null and category = 'AUTO_SALE_TEXT' and status = 'OPEN'), 1::bigint,
  'a foster home that mentions a sale opens one automatic report');
update public.foster_home_profiles set name = 'Pui de vânzare ieftin' where id = (select id from home);
select is((select count(*) from public.reports where reported_profile_id = '10000000-0000-4000-8000-000000004401'
  and category = 'AUTO_SALE_TEXT' and status = 'OPEN'), 1::bigint, 'editing it again does not open a second report');

select * from finish();
rollback;
