# PetPal - every animal needs one

PetPal coordinates animal social contact and participant-led foster care, starting with dogs and cats in Bucharest / Ilfov. People and organizations can publish cases; PetPal does not certify animals, homes or capacity.

## Start here

These documents describe the product as it is now. When anything else disagrees with them, they win.

- `CONTEXT.md`: product language (what a match, case, request, placement or receipt means).
- `docs/adr/`: decisions and why they were made.
  - `0001-participant-led-foster.md`: participants decide; PetPal moderates, it does not certify.
  - `0002-ephemeral-typing-activity.md`: typing indicators are not stored.
  - `0003-participant-reviews.md`: foster home reviews are participant feedback, not a trust score.
- `docs/SUPABASE_INTEGRATION.md`: backend setup, push notifications, secrets.
- `docs/legal/`: draft privacy, terms and animal welfare policies (need counsel review before launch).
- `docs/history/`: earlier plans, milestone proofs and QA reports. Kept for reference; not current.

## Workspace

- `frontend`: the mobile app (React / Capacitor). The Android project is under `frontend/android`.
- `petpal-admin`: internal React console for platform moderation.
- `petpal-supabase`: database migrations, policies, Edge Functions, seed data and database tests.
- `petpal-oss-references`: OSS dependency and license notes.
- `Archive/old-ui/PetPalMobileBuild`: archived Expo / React Native prototype. Do not use it for current work.

## Design

The design system is being rewritten. Until then, the tokens in `frontend/tailwind.config.js` and `frontend/src/index.css` are what the app actually uses; `DESIGN.md`, `docs/design/` and `design_guidelines.json` are older drafts.

## Product Boundary

- Matches, Foster, Messages, Profile.
- Dogs and cats only; Romania-first pilot, starting with Bucharest / Ilfov.
- Matching contact opens after a mutual match, or through a limited Social walk request (dogs only, one per owner pair, at most 5 new requests a day; the chat continues only if the other owner accepts).
- Foster: requests and chat before acceptance, reservations separate from declared receipt, shared care registers, tasks and journals.

Disabled or gated until production-safe:

- Services marketplace
- Open community posting
- Animal sales and breeding offers
- Verified Mate (postponed; historical data is kept)

## Safety Defaults

- Participants publish their own cases. Moderators may hide abusive content; this is not certification.
- Exact locations stay private.
- Report and block are available from match cards and every chat.
- Sale-like foster text and capacity overrides are flagged to moderators automatically.
- Accounts can be deleted from the app; shared records stay under "Deleted user".
- Public discovery reads only safe public fields.

## Local checks

These also run in CI (`.github/workflows/ci.yml`) on every pull request.

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
