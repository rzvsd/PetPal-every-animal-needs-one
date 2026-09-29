# M5 Real Data Proof

Date: 2026-04-27

## Scope

M5 wires the PetPal mobile app to local Supabase for real approved Adopt/Foster discovery listings and gated adoption/foster application submission.

The mobile app keeps a demo fallback, but when `petpal-mobile/.env.local` is present it reads from local Supabase at `http://127.0.0.1:54321`.

## Acceptance Criteria

- Local Supabase API/Auth/REST stack starts on Docker.
- Database reset applies migrations `0001` through `0005` and seed data.
- Public REST discovery returns only safe active Adopt/Foster rows.
- Demo adopter can authenticate through Supabase Auth.
- Authenticated adopter can submit an application through the RPC boundary.
- `my_applications_view` returns the submitted application summary without exposing private answers in the list view.
- Mobile app typechecks and can build/export for web with Supabase env loaded.
- Service-role/secret keys are not committed into app code.

## Implementation Notes

- `petpal-supabase/supabase/config.toml` disables nonessential local services for this Windows smoke path: storage, studio, inbucket, realtime, analytics, edge runtime, and pooler are not required for M5.
- `0001_initial_petpal_schema.sql` now creates storage buckets only when the `storage.buckets` table exists, so database-only local runs do not fail.
- `0005_m5_mobile_real_data.sql` replaces the public discovery/application summary views so safe API views can perform raw-table joins behind RLS.
- `submit_adoption_foster_application` is `security definer`; it still explicitly checks that the target listing is active and in Adopt/Foster before inserting.
- `seed.sql` includes demo Auth users plus `auth.identities` rows so password auth works locally.
- `petpal-mobile/.env.local` contains only the local Supabase URL and publishable key and is ignored by the mobile repo.

## Smoke Evidence

### Supabase Runtime

Command:

```powershell
pnpm exec supabase start
```

Result:

- Project URL: `http://127.0.0.1:54321`
- REST: `http://127.0.0.1:54321/rest/v1`
- GraphQL: `http://127.0.0.1:54321/graphql/v1`
- DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

### Database Reset

Command:

```powershell
pnpm run db:reset
```

Result:

- Applied migrations `0001_initial_petpal_schema.sql` through `0005_m5_mobile_real_data.sql`.
- Seeded demo users, organization, animals, and active listings.
- Finished successfully on branch `main`.

### pgTAP Tests

Command:

```powershell
pnpm run db:test
```

Result:

```text
Files=5, Tests=69
Result: PASS
```

### REST/Auth/Application Smoke

Discovery request:

```powershell
GET http://127.0.0.1:54321/rest/v1/discovery_listings_view?select=listing_id,animal_name,mode,city,organization_name&order=animal_name.asc
```

Result:

```text
DISCOVERY_COUNT=2
Bruno / FOSTER / Ilfov / PetPal Rescue Demo
Luna / ADOPT / Bucharest / PetPal Rescue Demo
```

Auth request:

```powershell
POST http://127.0.0.1:54321/auth/v1/token?grant_type=password
```

Result:

```text
AUTH_USER=adopter@petpal.local
```

Application RPC:

```powershell
POST http://127.0.0.1:54321/rest/v1/rpc/submit_adoption_foster_application
```

Result:

```text
APPLICATION_ID=petpal-trustcare
MY_APPLICATIONS_COUNT=1
status=SUBMITTED
animal_name=Luna
organization_name=PetPal Rescue Demo
```

### Mobile Checks

Command:

```powershell
pnpm exec tsc --noEmit
```

Result: pass.

Command:

```powershell
pnpm exec expo export --platform web
```

Result:

```text
env: load .env.local
env: export EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY
Exported: dist
```

Static smoke:

```powershell
python -m http.server 8086 --bind 127.0.0.1 --directory dist
```

Result:

```text
STATIC_HTTP_STATUS=200
```

Persistent background server note: `Start-Process` returned `Access is denied` in this shell, so the exported bundle was served through a temporary PowerShell job for the HTTP 200 smoke.

### Shared/Admin Checks

Commands:

```powershell
pnpm run typecheck
pnpm run build
```

Result for `petpal-shared`: pass.

Commands:

```powershell
pnpm run lint
pnpm run build
```

Result for `petpal-admin`: pass.

### Secret Scan

Command:

```powershell
Select-String -Pattern 'sb_secret|service_role|SUPABASE_SERVICE|JWT_SECRET|eyJ[a-zA-Z0-9_-]{20,}'
```

Result:

- No high-risk secret hits in source files.
- Only package lockfile integrity hashes matched the JWT-shaped pattern.

## Demo Accounts

- Rescue: `rescue@petpal.local`
- Adopter: `adopter@petpal.local`
- Password: `petpal-demo-password`

## Status

M5 is complete for local development proof.

Next milestone: M6 gated chat and notifications.
