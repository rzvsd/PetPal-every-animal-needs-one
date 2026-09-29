# M14 Design Overhaul Proof

Date: 2026-04-28

## Status

Implemented and release-built.

Phone install is blocked right now because ADB does not list the connected device.

## Goal

Correct the first UI/UX revamp by making the design source of truth real and PetPal-specific, then applying it across colors, screen flow, section hierarchy, and writing style.

## What Changed

Design contract:

- Replaced the generic `DESIGN.md` format/example document with a real PetPal design brief.
- Locked the product direction as calm rescue operations, not dating-style discovery.
- Defined guidance for colors, typography, layout, elevation, shapes, components, and writing.

Mobile app:

- `PetPalMobileBuild/src/design/tokens.ts`
- `PetPalMobileBuild/src/components/ui.tsx`
- `PetPalMobileBuild/src/components/AppShell.tsx`
- `PetPalMobileBuild/src/components/BottomTabs.tsx`
- `PetPalMobileBuild/src/app/PetPalApp.tsx`
- `PetPalMobileBuild/src/screens/WelcomeScreen.tsx`
- `PetPalMobileBuild/src/screens/DiscoverScreen.tsx`
- `PetPalMobileBuild/src/screens/AnimalDetailScreen.tsx`
- `PetPalMobileBuild/src/screens/ApplicationFlowScreen.tsx`
- `PetPalMobileBuild/src/screens/ApplicationsScreen.tsx`
- `PetPalMobileBuild/src/screens/InboxScreen.tsx`
- `PetPalMobileBuild/src/screens/ShelterScreen.tsx`
- `PetPalMobileBuild/src/screens/ProfileScreen.tsx`

## Design Corrections

- Replaced the heavy tan wash with a softer paper canvas.
- Reduced oversized hero sections so useful content appears earlier.
- Made animal cards more compact and less poster-like.
- Tightened bottom navigation height and labels.
- Reworked application flow from a loud blue panel into a calmer guided form.
- Rewrote major screen copy to sound like a trusted rescue workflow instead of a generic demo.
- Kept touch targets at mobile-safe sizes.
- Preserved logo and generated animal imagery.

## Research Applied

The pass used current mobile UX principles:

- Stable tab navigation for top-level sections.
- Optional, lightweight onboarding instead of a long instructional launch flow.
- At least 48dp touch targets for interactive controls.
- Persistent labels close to form fields.
- Images should carry real informational value on mobile, not just decoration.

## Quality Checks

Evidence folder:

- `evidence/m14-design-overhaul-2026-04-28`

Passed:

- Mobile TypeScript: `01-mobile-typecheck.txt`
- Android release build: `02-android-assemble-release.txt`
- Release APK info: `03-release-apk-info.txt`

Release APK:

- `PetPalMobileBuild/android/app/build/outputs/apk/release/app-release.apk`
- Size: 67,220,440 bytes

## Phone Install Status

Blocked by ADB device visibility.

Before ADB restart:

- `04-adb-devices-before-restart.txt`

After ADB restart:

- `06-adb-devices-after-restart.txt`

Both checks currently show:

```text
List of devices attached
```

with no device rows.

## Acceptance

M14 is source-complete and release-build complete.

Phone acceptance remains pending until the Android device appears again in `adb devices -l`.
