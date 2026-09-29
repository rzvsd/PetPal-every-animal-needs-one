# M8 Figma-to-Code Foundation Proof

Date: 2026-04-27

## Status

Foundation implemented.

This milestone does not claim full Figma parity yet because no exact Figma file, frame link, or selected node has been provided. The unblocked implementation work is complete: PetPal now has the generated brand assets installed, native Android icon/splash resources synced, and a real app-level welcome experience instead of a bitmap-only screen.

## Scope Implemented

- Installed generated PetPal assets into the mobile app:
  - `PetPalMobileBuild/assets/petpal/app-background-v1.png`
  - `PetPalMobileBuild/assets/petpal/app-icon-v1.png`
  - `PetPalMobileBuild/assets/petpal/welcome-screen-v1.png`
- Updated Expo app config:
  - `icon` uses `app-icon-v1.png`
  - `splash.image` uses `welcome-screen-v1.png`
  - Android adaptive icon uses `app-icon-v1.png`
- Regenerated Android native resources through Expo prebuild.
- Replaced the in-app welcome surface with native React Native UI:
  - native PetPal brand text
  - native product thesis copy
  - native trust pills
  - native `Start safely` button
  - generated animal artwork as the visual background
- Replaced the header placeholder `P` mark with the generated PetPal app icon.
- Kept the active v1 product boundary:
  - Adopt and Foster only
  - dogs and cats only
  - Bucharest / Ilfov pilot
  - application-first contact flow
  - gated chat remains intact

## Files Changed

- `PetPalMobileBuild/app.json`
- `PetPalMobileBuild/src/screens/WelcomeScreen.tsx`
- `PetPalMobileBuild/src/components/AppShell.tsx`
- `PetPalMobileBuild/src/screens/DiscoverScreen.tsx`
- `PetPalMobileBuild/android/app/src/main/res/**`
- `PetPalMobileBuild/assets/petpal/app-background-v1.png`
- `PetPalMobileBuild/assets/petpal/app-icon-v1.png`
- `PetPalMobileBuild/assets/petpal/welcome-screen-v1.png`

## Validation

TypeScript:

```powershell
pnpm exec tsc --noEmit
```

Result: pass.

Android build:

```powershell
.\android\gradlew.bat -p android :app:assembleDebug --console=plain
```

Result: `BUILD SUCCESSFUL`.

Phone install:

```powershell
adb -s R3CXA03J3LH install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Result: `Success`.

Installed package:

```text
versionCode=1 minSdk=24 targetSdk=36
versionName=1.0.0
lastUpdateTime=2026-04-27 22:25:25
firstInstallTime=2026-04-27 12:05:29
```

## Phone Evidence

Evidence folder:

`C:\BOTS\PetPal - every animal needs one\evidence\m8-foundation-2026-04-27`

Captured:

- `01-install.txt`
- `02-welcome.png`
- `02-welcome-ui.xml`
- `03-discover.png`
- `03-discover-ui.xml`
- `04-package-times.txt`

## Acceptance

Accepted for M8 foundation when:

- generated assets are installed in the mobile project
- app config and native Android resources use the PetPal icon/splash assets
- the in-app welcome screen is native UI, not only a flat bitmap
- phone evidence proves the installed package renders the new welcome and Discover surfaces
- typecheck and Android build pass

## Remaining M8 Work

Full M8 Figma-to-code parity still requires:

- exact Figma file/frame link or selected node
- fetched Figma design context
- fetched Figma screenshot
- exported or mapped design assets
- mobile implementation adjusted to match the Figma frame
- phone screenshots compared against the Figma target
