# PetPal Mobile

Expo / React Native app for PetPal.

## v1 Product Scope

- Adopt and Foster only
- Dogs and cats only
- Bucharest / Ilfov pilot
- Application-first flow before chat
- No Mate, Play, Services, or open Community posting in public v1

## M2 Identity Setup

Copy `.env.example` to `.env` when wiring to a local Supabase project:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<local anon key from supabase status>
```

The app currently renders the M2 onboarding/profile/role/verification workflow and exposes whether Supabase env config is present.

## M3 Animal + Listing Setup

The app also renders the M3 animal/listing workflow:

- animal profile inputs for dogs/cats
- public health and temperament fields
- private notes separated from public preview
- Adopt/Foster listing mode selection
- public city/coarse area plus private exact location
- draft vs submit-for-review intent

## M4 Discovery + Applications

The app now renders the M4 adoption/foster workflow:

- approved listing browsing with mode/species/city filters
- animal detail surface
- adoption/foster application form readiness
- my applications summary
- organization application inbox and review status controls

## Commands

```bash
pnpm install
pnpm start
pnpm run android
pnpm run ios
pnpm run web
```

## Safety Defaults

The mobile client should never query raw sensitive tables for discovery. It should use public-safe backend views and rely on Supabase RLS for private data enforcement.
