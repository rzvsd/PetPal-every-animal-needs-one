begin;
select no_plan();

-- Storage cleanup schedule (0041): the caller secret is generated in Vault and
-- only the service role can check it.
select is((select count(*)::integer from vault.secrets where name = 'storage_cleanup_secret'), 1,
  'the cleanup caller secret is generated once');
select ok(public.storage_cleanup_secret_matches((select decrypted_secret from vault.decrypted_secrets
  where name = 'storage_cleanup_secret')), 'the generated secret is accepted');
select ok(not public.storage_cleanup_secret_matches('wrong'), 'a wrong secret is refused');
select ok(not public.storage_cleanup_secret_matches(null), 'a missing secret is refused');
select ok(not has_function_privilege('anon', 'public.storage_cleanup_secret_matches(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.storage_cleanup_secret_matches(text)', 'execute'),
  'clients cannot probe the cleanup secret');
select ok(has_function_privilege('service_role', 'public.storage_cleanup_secret_matches(text)', 'execute'),
  'the storage-cleanup function can check the secret');

select * from finish();
rollback;
