# M1 Runtime Proof

Date: 2026-04-27

## Result

M1 Data Model + RLS Runtime Proof is verified locally.

## Commands

```powershell
cd "C:\BOTS\PetPal - every animal needs one\petpal-supabase"
pnpm exec supabase start --debug
pnpm run db:reset
pnpm run db:test
```

## Evidence

- Docker Desktop Linux engine was reachable through the `desktop-linux` context.
- Supabase CLI version: `2.95.3`.
- `pnpm run db:reset` applied `0001_initial_petpal_schema.sql` and seeded `supabase/seed/seed.sql`.
- `pnpm run db:test` ran `supabase/tests/rls_baseline.test.sql`.
- pgTAP result: `Files=1, Tests=12`, `Result: PASS`.

## Notes

The first `supabase start` needed time to pull images and initialize the Postgres container. After `supabase_db_petpal-supabase` became healthy, reset and tests passed.

