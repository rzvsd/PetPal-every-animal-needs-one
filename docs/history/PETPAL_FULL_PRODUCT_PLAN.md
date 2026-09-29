# PetPal Full Product Implementation Plan

## Status

- Active app: `frontend` React / Capacitor app.
- Archived app: `Archive/old-ui/PetPalMobileBuild`.
- Backend: Supabase only.
- Current direction: 4 tabs, `Matches`, `Foster`, `Messages`, `Profile`.
- Default language: English. Romanian remains a toggle target.
- Push policy: local implementation first; push only when explicitly requested.

## Milestones

1. Baseline and truth cleanup.
2. Auth and session hardening.
3. Profile and animal data.
4. Photo upload.
5. Matches.
6. Foster network.
7. Messages and safety.
8. Verification and admin.
9. Notifications.
10. Payments.
11. Release readiness.

## Milestone 1 Acceptance

- `frontend` is documented as the active mobile app.
- `Archive/old-ui/PetPalMobileBuild` is documented as historical only.
- The current 4-tab product direction is reflected in the root README.
- Command gates are documented for Supabase, frontend build/test, Capacitor sync, and Android install.

## Milestone 2 Acceptance

- Supabase session persistence remains the production auth path.
- Local demo mode is visible only when `REACT_APP_ALLOW_LOCAL_DEMO=true`.
- Production example config keeps local demo mode disabled.
- Demo Supabase login credentials remain local/demo-only and are not required for production.
- Register/login/logout errors are shown on the auth screen without silently entering mock data.

## Command Gates

Run after every milestone when the relevant tool/runtime is available:

```powershell
git status -sb

cd petpal-supabase
pnpm run db:reset
pnpm run db:test

cd ..\frontend
npm run build
npm test -- --watchAll=false --passWithNoTests
npm run audit:copy-a11y
npx cap sync android
```

When mobile behavior changes and a phone is connected:

```powershell
cd frontend
npm run build
npx cap sync android
cd android
.\gradlew.bat :app:assembleDebug --console=plain

$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices -l
& $adb install -r ".\app\build\outputs\apk\debug\app-debug.apk"
& $adb shell am start -n com.petpal.app.debug/com.petpal.app.MainActivity
```

## Product Rules

- Exact location is never public.
- Public discovery reads safe views only, not private raw tables.
- Chat opens only after a mutual match, accepted foster application, or accepted foster invite.
- Service-role operations live only in Edge Functions or admin tooling.
- Safety, reporting, foster emergency, and basic animal welfare flows are never paywalled.

## Payment Defaults

- Donations and sponsorship come first.
- Small optional premium comes later for convenience only.
- Stripe is the first implementation default.
- NETOPIA is the Romania-local fallback if merchant onboarding or local payment needs require it.

## Payment Edge Functions

Mobile payment flows must call Supabase Edge Functions. The mobile app must never contain Stripe, NETOPIA, webhook, or service-role secrets.

Implemented function boundaries:

- `create-payment-session`
  - Requires an authenticated Supabase user.
  - Creates a `payment_sessions` row.
  - Creates a Stripe Checkout Session when `STRIPE_SECRET_KEY` is configured.
  - Returns a provider checkout URL to the client.
  - Rejects premium payments until the ethical premium layer is explicitly enabled.
  - Returns `501` for NETOPIA until NETOPIA merchant credentials and signing rules are configured.
- `stripe-payment-webhook`
  - Requires `STRIPE_WEBHOOK_SECRET`.
  - Verifies the Stripe signature.
  - Updates `payment_sessions.status` to `PAID`, `FAILED`, or `CANCELED`.

Required Supabase Edge Function secrets:

```powershell
supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set PAYMENT_SUCCESS_URL="petpal://payments/success?session_id={CHECKOUT_SESSION_ID}"
supabase secrets set PAYMENT_CANCEL_URL="petpal://payments/cancel?session_id={CHECKOUT_SESSION_ID}"
```

Android deep-link handling:

- The Android app registers `petpal://payments/...`.
- `petpal://payments/success` opens Profile and shows a payment-complete notice.
- `petpal://payments/cancel` opens Profile and shows a canceled-payment notice.
- The redirect notice is informational only. The final trusted payment state still comes from the Stripe webhook.

Local deploy/test shape:

```powershell
cd petpal-supabase
supabase functions deploy create-payment-session
supabase functions deploy stripe-payment-webhook --no-verify-jwt
```

Production rule: checkout state is confirmed by webhook, not by trusting the mobile redirect.
