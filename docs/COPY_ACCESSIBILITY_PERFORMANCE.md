# Copy, Accessibility, Performance Pass

Date: 2026-04-30

## Scope

- EN/RO translation parity.
- Default language remains English.
- Basic accessibility pass for touch targets, focus visibility, labels, contrast, and text wrapping.
- Build smoke for web and Android.
- Real-device performance smoke where an ADB device is available.

## Implemented

- Added a repeatable copy/accessibility audit script: `npm run audit:copy-a11y`.
- Added EN/RO keys for missing action labels, accessibility labels, time labels, and app version copy.
- Added explicit `type="button"` to interactive buttons.
- Added aria labels for icon-only actions, bottom tabs, message input/send, safety menu, animal selector, and compatibility score.
- Added dialog roles for modal surfaces and filter sheets.
- Added global 44px touch-target minimums, focus-visible rings, and text wrapping protection.
- Improved contrast for primary actions and known white-on-sage text cases.
- Removed the hardcoded Foster separator label from foster application cards.

## Verification

Commands run from `frontend/` unless noted:

```bash
npm run audit:copy-a11y
npm test -- --watchAll=false --passWithNoTests
npm run build
npx cap sync android
```

Android builds run from `frontend/android/` with temporary environment variables:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
.\gradlew.bat assembleDebug
.\gradlew.bat assembleRelease
```

Results:

- Copy/accessibility audit: passed.
- Translation keys checked: 358.
- React tests: passed with no tests found.
- React production build: passed.
- Capacitor Android sync: passed.
- Android debug build: passed.
- Android release build: passed.

## Blocked

Real-device performance smoke is blocked because ADB currently reports no connected devices:

```text
List of devices attached
```

The following checks still need a physical Android device connected and authorized:

- Cold start.
- Tab switching.
- Image-heavy screens.
- Message send.
- Upload flow.
