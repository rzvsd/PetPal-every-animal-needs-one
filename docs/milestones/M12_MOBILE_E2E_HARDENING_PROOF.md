# M12 Mobile Pilot E2E Hardening Proof

Date: 2026-04-28

## Status

Complete.

M12 is implemented, locally validated, installed on the connected Android phone, and physically smoke-tested against local Supabase through `adb reverse`.

## Scope

M12 hardens the mobile pilot journey from live discovery through application, shelter acceptance, gated chat, report, and block.

Implemented:

- Android local Supabase network security config for USB-reversed localhost.
- Accepted applications open the matching protected chat thread instead of landing in an unselected inbox.
- Application cards pass the accepted application id into chat opening.
- Report flow prefers the latest message from the other participant.
- Block flow treats closed message visibility as success after the block RPC.
- Added `pnpm run typecheck`.
- Added `pnpm run smoke:e2e`.
- Updated Expo to the expected SDK patch version.
- Built and installed a standalone Android release APK.

## Code Changes

Mobile:

- `PetPalMobileBuild/src/app/PetPalApp.tsx`
- `PetPalMobileBuild/src/hooks/useConversations.ts`
- `PetPalMobileBuild/src/screens/ApplicationsScreen.tsx`
- `PetPalMobileBuild/scripts/mobile-e2e-smoke.mjs`
- `PetPalMobileBuild/package.json`
- `PetPalMobileBuild/pnpm-lock.yaml`
- `PetPalMobileBuild/android/app/src/main/AndroidManifest.xml`
- `PetPalMobileBuild/android/app/src/main/res/xml/network_security_config.xml`

## Validation

Evidence folder:

- `evidence/m12-full-phone-e2e-2026-04-28`

Commands and checks:

```bash
pnpm run build
pnpm run typecheck
pnpm exec expo install --check
pnpm run db:reset
pnpm run db:test
pnpm run smoke:e2e
adb devices -l
adb reverse tcp:54321 tcp:54321
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell monkey -p com.petpal.app 1
adb shell input ...
docker exec supabase_db_petpal-supabase psql ...
```

Results:

- Shared package build: pass.
- Shared package typecheck: pass.
- Admin build: pass.
- Admin lint: pass.
- Mobile TypeScript: pass.
- Expo dependency check: pass.
- Supabase reset: pass.
- Supabase RLS/database tests: pass.
- Supabase test files: 8.
- Supabase tests: 131.
- Admin live smoke: pass.
- Mobile scripted E2E smoke: pass.
- Android release APK install: pass.
- Physical phone launch: pass.
- Physical phone live discovery: pass.
- Physical phone listing detail: pass.
- Physical phone application submit: pass.

## Scripted E2E Proof

`pnpm run smoke:e2e` proved the full business path:

- Live discovery returned 2 approved listings.
- The smoke selected the Foster listing for Bruno.
- The adopter had 0 conversations before applying.
- The adopter submitted a real application.
- The rescue accepted the application.
- The accepted application opened a gated conversation.
- Rescue and adopter exchanged 2 messages.
- The adopter reported the rescue-authored message.
- The report stayed open for moderation.
- The adopter blocked the rescue profile.
- Messages visible after block dropped to 0.

Evidence:

- `evidence/m12-full-phone-e2e-2026-04-28/11-mobile-e2e-smoke.txt`

## Physical Phone Proof

Device:

- Serial: `R3CXA03J3LH`
- Model: `SM-S928B`
- Installed package: `com.petpal.app`
- Version name: `1.0.0`
- Version code: `1`

APK:

- `PetPalMobileBuild/android/app/build/outputs/apk/release/app-release.apk`
- Size: 63,435,596 bytes

Phone evidence:

- `13-adb-device-before-install.txt`
- `14-adb-reverse-54321.txt`
- `15-adb-install-release.txt`
- `16-adb-launch.txt`
- `17-phone-welcome.png`
- `19-phone-discover.png`
- `23-phone-listings.png`
- `27-phone-animal-detail.png`
- `31-phone-application-flow.png`
- `39-phone-application-review-ready.png`
- `41-phone-application-submitted.png`
- `43-db-applications-after-phone-submit.txt`
- `44-phone-logcat-error-scan.txt`

Physical phone flow proved:

- Release APK installed successfully.
- App launched successfully.
- Welcome screen rendered.
- App connected to local Supabase through USB reverse.
- Live discovery showed 2 approved listings.
- Bruno foster listing opened.
- Application wizard opened.
- Required fields reached ready-to-submit state.
- Submit created a real local Supabase application.
- App navigated to My requests and showed Bruno as `SUBMITTED`.
- Database confirmed the submitted Bruno foster application row.

## Acceptance

M12 is accepted.

The only limitation in the physical phone text-entry proof is that Android shell input wrote `%20` literally for spaces in two long fields. That did not block validation because the app accepted the values, the phone submitted the application, and the database confirmed the row. The scripted E2E smoke covers the cleaner full business path through acceptance, gated chat, report, and block.
