# M3 Animal + Listing Creation Proof

Date: 2026-04-27

## Result

M3 Animal + Listing Creation is implemented and verified locally.

## Implemented Scope

- Shared contracts now include:
  - animal draft schema
  - animal sex enum
  - listing draft private/public fields
  - combined animal listing submission schema
- Supabase migration `0003_m3_animal_listing_creation.sql` adds:
  - public health summary on animals
  - listing submission timestamp and archive reason
  - photo primary marker and public URL metadata
  - tighter listing RLS so organizations can draft/submit but not activate listings
  - `create_animal_listing_draft`
  - `submit_listing_for_review`
  - `admin_set_listing_review_status`
- Mobile app now renders:
  - animal profile form
  - dog/cat and sex selection
  - temperament and public health fields
  - private shelter/rescuer notes
  - Adopt/Foster listing setup
  - public coarse area plus private exact location
  - draft vs submit-for-review intent
  - safe public preview that excludes private fields

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

cd "C:\BOTS\PetPal - every animal needs one\petpal-admin"
pnpm run lint
pnpm run build
```

## Evidence

- Supabase reset applied migrations `0001`, `0002`, and `0003`.
- Supabase pgTAP result: `Files=3, Tests=34`, `Result: PASS`.
- Mobile TypeScript passed.
- Shared typecheck/build passed.
- Admin lint/build passed.
- Expo web responded HTTP 200 on `http://127.0.0.1:8082`.
- Secret scan only found the documented anon-key placeholder in the mobile README.

## Notes

M3 still does not upload real photos or persist mobile form submissions. Those should land with the next integration pass after the creation RPCs are wired to authenticated client calls.

