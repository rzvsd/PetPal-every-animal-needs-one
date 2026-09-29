# M13 UI/UX Rebuild Proof

Date: 2026-04-28

## Status

Implemented, release-built, installed on the connected Android phone, and smoke-tested on-device.

## Goal

Replace the smoke-test-feeling mobile UI with a cleaner PetPal product surface based on:

- `DESIGN.md`
- `docs/design/PETPAL_DESIGN.md`
- Mobile navigation and accessibility guidance from Material / Android references
- Mobile form guidance around persistent labels, clear help text, and large touch targets

## What Changed

Rewritten mobile UI layer:

- `PetPalMobileBuild/src/design/tokens.ts`
- `PetPalMobileBuild/src/components/ui.tsx`
- `PetPalMobileBuild/src/components/AppShell.tsx`
- `PetPalMobileBuild/src/components/BottomTabs.tsx`
- `PetPalMobileBuild/src/screens/WelcomeScreen.tsx`
- `PetPalMobileBuild/src/screens/DiscoverScreen.tsx`
- `PetPalMobileBuild/src/screens/AnimalDetailScreen.tsx`
- `PetPalMobileBuild/src/screens/ApplicationFlowScreen.tsx`
- `PetPalMobileBuild/src/screens/ApplicationsScreen.tsx`
- `PetPalMobileBuild/src/screens/InboxScreen.tsx`
- `PetPalMobileBuild/src/screens/ShelterScreen.tsx`
- `PetPalMobileBuild/src/screens/ProfileScreen.tsx`

Preserved:

- PetPal logo assets.
- Generated animal and background imagery.
- Supabase API layer.
- Discovery/application/conversation hooks.
- Existing tested business flow.
- M12 E2E smoke script.

Removed from the visible product surface:

- Letter-box tab buttons.
- Excessive white/pale boxed sections.
- QA-demo wording such as `Application studio`.
- Overlapping nested-card visual rhythm.
- Discovery text that felt generic rather than trust-led.

## Design Direction

The new surface follows the PetPal design direction:

- Warm matte canvas instead of stark white.
- Deep trust header and stable bottom navigation.
- Real animal imagery as the first signal.
- Clear workflow bands for discovery, application, chat, shelter, and profile.
- Persistent form labels with helper text.
- Large touch targets for mobile interaction.
- 6-8px radii.
- Copy focused on verified rescues, private locations, application-first contact, and safer handoffs.

## Quality Checks

Evidence folder:

- `evidence/m13-uiux-rebuild-2026-04-28`
- `evidence/m13-phone-install-2026-04-28`

Passed:

- Mobile TypeScript: `01-mobile-typecheck.txt`
- Expo dependency check: `02-expo-check.txt`
- Supabase reset before DB tests: `03-db-reset-before-tests.txt`
- Supabase DB/RLS tests: `04-db-test.txt`
- Mobile scripted E2E smoke: `05-mobile-e2e-smoke.txt`
- Supabase reset before phone install: `06-db-reset-before-phone.txt`
- Android release build: `07-android-assemble-release.txt`
- Release APK info: `08-release-apk-info.txt`

DB/RLS result:

- Files: 8.
- Tests: 131.
- Result: pass.

Mobile E2E result:

- Discovery loaded 2 approved listings.
- Bruno foster application submitted.
- Rescue accepted application.
- Gated chat opened.
- Two messages exchanged.
- Rescue-authored message reported.
- Rescue profile blocked.
- Messages visible after block dropped to 0.

Release APK:

- `PetPalMobileBuild/android/app/build/outputs/apk/release/app-release.apk`
- Size after welcome-screen correction: 67,220,300 bytes

## Phone Install Status

Installed and validated on the connected Samsung phone.

Device:

- `R3CXA03J3LH`
- `model:SM_S928B`
- Evidence: `evidence/m13-phone-install-2026-04-28/01-adb-device.txt`

Install proof:

- ADB reverse for local Supabase: `02-adb-reverse-54321.txt`
- Initial release install: `03-adb-install-release.txt`
- Initial data clear: `04-adb-clear-app-data.txt`
- Initial launch: `05-adb-launch.txt`
- Initial package info: `06-phone-package-info.txt`

Welcome-screen correction:

- The first installed build showed the new UI, but the welcome screen reused a generated image with embedded PetPal text, which collided with the live welcome copy.
- `PetPalMobileBuild/src/screens/WelcomeScreen.tsx` now uses `app-background-v1.png` for the welcome hero instead.
- Post-fix TypeScript check: `18-post-fix-typecheck.txt`
- Post-fix release build: `19-post-fix-assemble-release.txt`
- Post-fix APK info: `20-post-fix-apk-info.txt`

Post-fix phone install proof:

- Connected device: `21-post-fix-adb-device.txt`
- ADB reverse: `22-post-fix-adb-reverse-54321.txt`
- Install result: `23-post-fix-adb-install-release.txt`
- Data clear: `24-post-fix-adb-clear-app-data.txt`
- Launch: `25-post-fix-adb-launch.txt`
- Package info: `26-post-fix-phone-package-info.txt`

On-device screenshots:

- Fixed welcome screen: `27-phone-welcome-fixed.png`
- Discovery screen: `30-phone-discover.png`
- Listing card scroll: `33-phone-listings.png`
- Animal detail screen: `36-phone-detail.png`
- Foster application screen: `39-phone-application.png`

On-device UI tree/signals:

- Fixed welcome: `28-phone-welcome-fixed-ui.xml`, `29-phone-welcome-fixed-signals.txt`
- Discovery: `31-phone-discover-ui.xml`, `32-phone-discover-signals.txt`
- Listings: `34-phone-listings-ui.xml`, `35-phone-listings-signals.txt`
- Detail: `37-phone-detail-ui.xml`, `38-phone-detail-signals.txt`
- Application: `40-phone-application-ui.xml`, `41-phone-application-signals.txt`

Runtime crash scan:

- Logcat tail: `42-phone-logcat-tail.txt`
- Broad scan includes Samsung/system and `uiautomator` noise: `43-phone-logcat-error-scan.txt`
- Strict app fatal scan: `44-phone-logcat-fatal-scan.txt`
- Result: no app fatal exceptions or React JS fatal signatures found in the captured logcat tail.

## Install Commands

Preferred helper from `PetPalMobileBuild`:

```powershell
.\scripts\install-release-phone.ps1
```

Manual commands:

```powershell
$adb = 'C:\Users\razva\AppData\Local\Android\Sdk\platform-tools\adb.exe'
& $adb devices -l
& $adb -s R3CXA03J3LH reverse tcp:54321 tcp:54321
& $adb -s R3CXA03J3LH install -r 'android\app\build\outputs\apk\release\app-release.apk'
& $adb -s R3CXA03J3LH shell pm clear com.petpal.app
& $adb -s R3CXA03J3LH shell monkey -p com.petpal.app 1
```

## Acceptance

M13 implementation is code-complete, automated-validation complete, release-built, installed on the connected phone, and smoke-tested on-device through:

- Welcome.
- Discovery.
- Listing scroll.
- Animal detail.
- Foster application entry.

The installed phone build is the upgraded UI, not the old smoke-test surface.
