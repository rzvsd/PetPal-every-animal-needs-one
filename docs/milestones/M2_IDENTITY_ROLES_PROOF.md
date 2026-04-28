# M2 Identity + Roles Proof

Date: 2026-04-27

## Result

M2 Identity + Roles is implemented and verified locally.

## Implemented Scope

- Shared contracts include user roles, organization types, profile onboarding schema, and organization verification schema.
- Supabase migration `0002_m2_identity_roles.sql` adds:
  - profile age gate and onboarding completion fields
  - profile roles
  - organization type and representative/contact fields
  - organization verification requests
  - onboarding and organization verification RPCs
  - RLS policies for profile roles and verification requests
- Mobile app renders the M2 onboarding workflow:
  - email sign-in placeholder
  - profile fields
  - age confirmation
  - coarse location
  - role selection
  - shelter/rescuer verification request form
  - Supabase env configuration status

## Commands Verified

```powershell
cd "C:\BOTS\PetPal - every animal needs one\petpal-supabase"
pnpm run db:reset
pnpm run db:test

cd "C:\BOTS\PetPal - every animal needs one\petpal-shared"
pnpm run typecheck
pnpm run build

cd "C:\BOTS\PetPal - every animal needs one\petpal-mobile"
pnpm exec tsc --noEmit
pnpm exec expo start --web --port 8082
```

## Evidence

- Supabase reset applied migrations `0001` and `0002`.
- Supabase pgTAP result: `Files=2, Tests=22`, `Result: PASS`.
- Mobile TypeScript passed.
- Shared typecheck/build passed.
- Expo web responded HTTP 200 on `http://127.0.0.1:8082`.
- Admin lint/build still passed after M2.

## Notes

- `.env.example` contains placeholders only. No real Supabase anon key or service-role key was added.
- Supabase local DB is running through Docker Desktop. Full API/Auth/Studio services are not required for the M2 RLS proof, but they will matter once mobile starts making real auth calls.

