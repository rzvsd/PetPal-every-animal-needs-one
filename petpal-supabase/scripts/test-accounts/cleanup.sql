-- Removes every PetPal test account (email pp-test-*@petpal.test) and every
-- row that hangs off one: profiles, homes, animals, requests, chats, messages,
-- notifications, reports, ... It follows the foreign keys, so it also removes
-- rows that only exist because of a test account (for example a message in a
-- chat with a test account).
--
-- Run as the postgres user: psql "$DATABASE_URL" -f cleanup.sql
-- or paste into the Supabase dashboard SQL editor.
-- Everything runs in one transaction: if anything fails, nothing is deleted.
begin;

create temp table pp_test_ids on commit drop as
  select id from auth.users where email like 'pp-test-%@petpal.test';

do $$
declare n int;
begin
  select count(*) into n from pp_test_ids;
  raise notice 'Test accounts found: %', n;
  -- Guard: the seed script makes at most a few hundred. Anything bigger means the pattern is wrong.
  if n > 500 then raise exception 'Refusing: % accounts match the test pattern', n; end if;
end $$;

-- Deletes rows of tbl matching cond, after first deleting (recursively) every
-- row in other tables that references them through a foreign key.
create function pg_temp.pp_purge(tbl regclass, cond text, depth int default 0) returns void
language plpgsql as $$
declare
  fk record;
  child_cond text;
  found_rows boolean;
begin
  if depth > 12 then raise exception 'FK chain too deep at %', tbl; end if;
  for fk in
    select c.conrelid::regclass as child, c.confdeltype,
      (select string_agg(format('%I', a.attname), ',' order by k.ord) from unnest(c.conkey) with ordinality k(attnum, ord)
         join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as child_cols,
      (select string_agg(format('%I', a.attname), ',' order by k.ord) from unnest(c.confkey) with ordinality k(attnum, ord)
         join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum) as parent_cols
    from pg_constraint c
    where c.contype = 'f' and c.confrelid = tbl
  loop
    child_cond := format('(%s) in (select %s from %s where %s)', fk.child_cols, fk.parent_cols, tbl, cond);
    if fk.child = tbl then
      -- Self-reference (e.g. a task repeating another): unlink first.
      execute format('update %s set (%s) = row(%s) where %s', tbl, fk.child_cols,
        (select string_agg('null', ',') from regexp_split_to_table(fk.child_cols, ',')), child_cond);
      continue;
    end if;
    if fk.confdeltype in ('n', 'd') then continue; end if; -- SET NULL / SET DEFAULT: the database handles it
    execute format('select exists (select 1 from %s where %s)', fk.child, child_cond) into found_rows;
    if found_rows then
      perform pg_temp.pp_purge(fk.child, child_cond, depth + 1);
    end if;
  end loop;
  execute format('delete from %s where %s', tbl, cond);
end $$;

select pg_temp.pp_purge('auth.users'::regclass, 'id in (select id from pp_test_ids)');

-- Rows that point at test data only through JSON, not a foreign key:
-- moderator alerts about reports that no longer exist, and sign-in audit rows.
delete from public.notification_events e
where e.payload ? 'reportId' and not exists (select 1 from public.reports r where r.id::text = e.payload->>'reportId');
delete from auth.audit_log_entries
where payload->>'actor_username' like 'pp-test-%@petpal.test'
   or payload->'traits'->>'user_email' like 'pp-test-%@petpal.test';

do $$
declare n int;
begin
  select count(*) into n from auth.users where email like 'pp-test-%@petpal.test';
  raise notice 'Test accounts left: %', n;
end $$;

commit;
