# Android Fresh Install Smoke - 2026-04-30

Device: `R3CXA03J3LH` / `SM-S928B`
Package: `com.petpal.app.debug`

## Build And Install

- `npm run audit:copy-a11y`: passed
- `npm run build`: passed
- `npx cap sync android`: passed
- `frontend/android/gradlew.bat installDebug`: passed
- `adb shell pm clear com.petpal.app.debug`: passed
- Fresh launch host timing: `166ms`

Note: uninstalling the debug package returned `DELETE_FAILED_INTERNAL_ERROR`, so the fresh state was enforced with `pm clear`. Release package uninstall succeeded earlier.

## Smoke Coverage

- TAB1 Matches: launched successfully, photo-first card rendered, compatibility breakdown opened, match detail rendered with privacy copy.
- TAB2 Foster: normal-user Find/My Requests structure rendered, case cards rendered, case detail opened, Apply to foster opened the 5-step application flow.
- TAB3 Messages: grouped inbox rendered, match thread opened, context header rendered, safety menu rendered, View context opened context modal, message input accepted text and send cleared the draft.
- TAB4 Profile: Profile hub rendered, animal cards rendered, Profile scroll reached Preferences/Privacy/App sections, language toggle switched English to Romanian and back to English.

## Fixes Applied During Smoke

- Raised match/foster/message overlay z-index above bottom tabs so detail/action screens are not intercepted by bottom navigation.
- Added `min-height: 0` to the app flex stack/Profile scroll panes so lower Profile sections are reachable on Android WebView.

## Logs

- `post-fix-logcat.txt` captured.
- `post-fix-crash-logcat.txt` captured.
- No app-process `FATAL` or `ANR` markers found for `com.petpal.app.debug`.

Known test-tool note: crash buffer contains a `uiautomator` automation-process crash (`UiAutomationService already registered`) from repeated UI dumps. It is not the PetPal app process.
