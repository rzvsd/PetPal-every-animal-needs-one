# Test accounts for stress testing

Creates **20 test users** (each posts one animal that needs a foster home) and
**20 test foster homes**, runs a stress pass over them, and removes all of it
again with one command.

| Script | What it does |
| --- | --- |
| `node seed.mjs [--users 20] [--fosters 20]` | Creates the accounts with the service key, confirms their email, onboards them (18+, terms), publishes a home per foster and an animal per user. |
| `node load.mjs [--messages 10]` | All 40 sign in at once, load lists, 60 applications (3 per animal) at once, every owner accepts one at once, both sides of each chat send messages at once, 40 inbox loads. Prints p50/p95 per phase and writes `load-report.local.json`. |
| `psql "$DATABASE_URL" -f cleanup.sql` | Deletes every test account and every row that hangs off one (follows the foreign keys), plus moderator alerts and sign-in audit rows about them. One transaction: all or nothing. |

## How test accounts are marked

- email `pp-test-f01@petpal.test` … `pp-test-u20@petpal.test` (`.test` is a reserved domain, no email is ever sent)
- name `TEST Ana F01`, home `[TEST] Ana's foster home`, animal `[TEST] Rex`, description says "TEST ACCOUNT / TEST ANIMAL"
- `user_metadata.petpal_test_account = true`

`cleanup.sql` matches only `pp-test-%@petpal.test` and refuses to run if more than 500 accounts match.

## Logins

Each account gets its own random password. They are written only to
`test-accounts.local.json` next to the scripts (git-ignored, file mode 600) and
never printed. Use it to sign in to the app as any test account.

## Run against a local stack (recommended)

```sh
cd petpal-supabase
pnpm supabase start            # all migrations + seed.sql
cd scripts/test-accounts && npm install
export SUPABASE_ANON_KEY=<Publishable key from `supabase status`>
export SUPABASE_SERVICE_ROLE_KEY=<Secret key from `supabase status`>
node seed.mjs && node load.mjs
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f cleanup.sql   # or: pnpm supabase db reset
```

## Against a hosted project

The scripts refuse any URL that is not `127.0.0.1`/`localhost` unless
`PETPAL_ALLOW_HOSTED=yes` is set. Before using it on the live pilot project, know that:

- Test homes and animals are **published**, so real pilot users see them in the lists until cleanup runs.
- Activity can raise automatic flags, which push an alert to every moderator.
- Pilot numbers count the test accounts until cleanup runs.

Set `SUPABASE_URL=https://<ref>.supabase.co` plus the two keys, run the scripts,
then run `cleanup.sql` in the dashboard SQL editor (it runs as `postgres`).

## Expected "errors" in load.mjs

- `CAPACITY_ACK_REQUIRED`: the owner picked a home that is already full; the app asks the owner to confirm. The script does not confirm, because confirming files an automatic flag that alerts moderators.
- `You are sending messages too quickly`: the 30 messages per minute per sender limit.
