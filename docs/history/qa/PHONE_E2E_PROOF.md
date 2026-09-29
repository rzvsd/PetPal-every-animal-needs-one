# PetPal Phone E2E Proof - 2026-04-27

## Scope

Physical Android phone smoke for the PetPal mobile M6 flow against local Supabase.

## Device

- Serial: `R3CXA03J3LH`
- Model: `SM_S928B`
- Android: `16`
- Screen: `1440x3120`, density `560`

## Build And Install

- APK built from the no-space junction path: `C:\BOTS\PetPalMobileBuild`
- APK installed: `C:\BOTS\PetPalMobileBuild\android\app\build\outputs\apk\debug\app-debug.apk`
- Package/activity: `com.petpal.app/.MainActivity`
- USB reverse used:
  - `tcp:54321 -> tcp:54321` for local Supabase
  - `tcp:8081 -> tcp:8081` for Metro

## Runtime Fix

The first physical-phone launch exposed a React Native runtime failure before the app rendered:

- `ReferenceError: Property 'FormData' doesn't exist`

Fix applied in mobile:

- `petpal-mobile/index.ts` imports a native-global bootstrap before the app module.
- `petpal-mobile/src/polyfills/installNativeGlobals.ts` installs React Native XHR/FormData globals before Supabase is imported.

Final relaunch rendered the app successfully with local Supabase data.

## Phone Flow Result

The following end-to-end path was exercised on the connected phone:

1. App launches.
2. Local Supabase discovery loads.
3. Two approved listings render: Bruno foster and Luna adoption.
4. Foster application fields are completed for Bruno.
5. Application submits through Supabase.
6. Organization inbox accepts the latest application.
7. Gated conversation opens only after acceptance.
8. Message sends through gated chat.
9. Latest message report creates a moderation report.
10. Rescue demo profile is blocked.
11. Follow-up send is rejected with `Messaging is blocked for this conversation`.

## Evidence

Evidence folder:

- `C:\BOTS\PetPal - every animal needs one\evidence\phone-e2e-2026-04-27`

Key files:

- `phone-petpal-after-polyfill-clear.png` / `phone-ui-after-polyfill-clear.xml`
- `phone-petpal-after-submit.png` / `phone-ui-after-submit.xml`
- `phone-petpal-after-accept.png` / `phone-ui-after-accept.xml`
- `phone-petpal-after-send.png` / `phone-ui-after-send.xml`
- `phone-petpal-after-report.png` / `phone-ui-after-report.xml`
- `phone-petpal-after-block.png` / `phone-ui-after-block.xml`
- `phone-petpal-after-blocked-send.png` / `phone-ui-after-blocked-send.xml`
- `phone-petpal-final-bootstrap-fix.png` / `phone-ui-final-bootstrap-fix.xml`
- `metro-phone.log`

## Quality Checks

Passed:

- `pnpm exec tsc --noEmit` in `petpal-mobile`
- `pnpm exec supabase db reset` in `petpal-supabase`
- `pnpm run db:test` in `petpal-supabase`

DB test result:

- `Files=6, Tests=89`
- `Result: PASS`

Phone log review after final relaunch:

- No `FATAL EXCEPTION`
- No `ReferenceError`
- No RedBox runtime failure
- No Metro resolution failure

## Notes

- The phone E2E created real local rows, so the local Supabase DB was reset afterwards to restore a clean seeded baseline.
- Metro remained available on `http://127.0.0.1:8081` during the phone proof.
- Final logcat still includes a non-fatal React Native dev warning for the `setUpXHR` bootstrap import; it does not create a RedBox and the app renders normally.
