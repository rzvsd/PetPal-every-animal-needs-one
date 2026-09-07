# PetPal - every animal needs one

PetPal is a trusted local adoption and foster platform for animals. The first public product focuses on verified shelters and rescuers, starting with dogs and cats in Bucharest / Ilfov.

This repository is the PetPal monorepo. It keeps the mobile app, admin app, shared contracts, Supabase backend, OSS notes, design docs, milestone proof, and QA evidence together in one GitHub repository.

## Workspace

- `frontend`: active public mobile app. It is a React / Capacitor app and is the source for the Android app currently installed on the phone.
- `petpal-admin`: internal React admin console for verification and moderation.
- `petpal-shared`: shared TypeScript enums, schemas, and product rules.
- `petpal-supabase`: database migrations, policies, Edge Functions, seed data, and RLS tests.
- `petpal-oss-references`: OSS dependency and license notes.
- `Archive/old-ui/PetPalMobileBuild`: archived Expo / React Native prototype. Do not use it for current product work.

## Design System

- `DESIGN.md`: PetPal's product-specific design contract.
- `docs/design/PETPAL_DESIGN.md`: PetPal's applied visual identity and UI rules.
- `docs/design/UI_UX_TRANSFORMATION_PLAN.md`: UI/UX milestone plan and evidence notes.
- `docs/design/FIGMA_GENERATION_PROMPT.md`: Figma prompt for the next production design pass.

## Product Boundary

Current public product direction:

- Matches
- Foster
- Messages
- Profile
- Dogs and cats only
- Romania-first pilot, starting with Bucharest / Ilfov
- Application-first contact flow for foster
- Mutual-match-only contact flow for matching
- Play, Social, and Verified Mate remain visible product modes, with Verified Mate gated behind safety and verification

Disabled or gated until production-safe:

- Services marketplace
- Open community posting
- Animal sales
- Breeding offers
- Ungated Verified Mate or breeding-style marketplace behavior

## Safety Defaults

- Listings start private until approved.
- Exact locations stay private.
- Chat opens only after an accepted application.
- Reports, blocks, audit logs, and admin moderation exist from day one.
- Public discovery must read only safe public fields.

## Active Implementation Runbook

The milestone implementation plan and command gates live in `docs/implementation/PETPAL_FULL_PRODUCT_PLAN.md`.

## Release Policy Drafts

- `docs/legal/PRIVACY_POLICY.md`
- `docs/legal/TERMS_AND_SAFETY.md`
- `docs/legal/ANIMAL_WELFARE_POLICY.md`

Core local checks:

```powershell
cd petpal-supabase
pnpm run db:reset
pnpm run db:test

cd ..\frontend
npm run build
npm test -- --watchAll=false --passWithNoTests
npm run audit:copy-a11y
npx cap sync android
```

Android debug install uses the Capacitor project under `frontend/android`.

## Milestone Proof

- M1 backend runtime proof: `petpal-supabase/M1_RUNTIME_PROOF.md`
- M2 identity and roles proof: `docs/milestones/M2_IDENTITY_ROLES_PROOF.md`
- M3 animal and listing creation proof: `docs/milestones/M3_ANIMAL_LISTING_PROOF.md`
- M4 discovery and applications proof: `docs/milestones/M4_DISCOVERY_APPLICATIONS_PROOF.md`
- M5 real data proof: `docs/milestones/M5_REAL_DATA_PROOF.md`
- M6 gated chat proof: `docs/milestones/M6_GATED_CHAT_PROOF.md`
- M7 UI/UX Figma contract proof: `docs/milestones/M7_UI_UX_FIGMA_CONTRACT_PROOF.md`
- M8 Figma-to-code foundation proof: `docs/milestones/M8_FIGMA_TO_CODE_FOUNDATION_PROOF.md`
- M9 admin moderation proof: `docs/milestones/M9_ADMIN_MODERATION_PROOF.md`
- M10 live admin integration proof: `docs/milestones/M10_LIVE_ADMIN_INTEGRATION_PROOF.md`
- M11 admin security and production readiness proof: `docs/milestones/M11_ADMIN_SECURITY_PRODUCTION_READINESS_PROOF.md`
- M12 mobile pilot E2E hardening proof: `docs/milestones/M12_MOBILE_E2E_HARDENING_PROOF.md`
- M13 UI/UX rebuild proof: `docs/milestones/M13_UI_UX_REBUILD_PROOF.md`
- M14 design overhaul proof: `docs/milestones/M14_DESIGN_OVERHAUL_PROOF.md`
- Full milestone E2E proof: `docs/qa/FULL_MILESTONE_E2E_2026_04_28.md`
- Phone E2E proof: `docs/qa/PHONE_E2E_PROOF.md`
