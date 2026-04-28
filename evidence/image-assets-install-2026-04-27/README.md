# PetPal Image Asset Install Evidence

Date: 2026-04-27

Installed into `PetPalMobileBuild`:

- `assets/petpal/app-background-v1.png`
- `assets/petpal/app-icon-v1.png`
- `assets/petpal/welcome-screen-v1.png`

Native app wiring:

- `app.json` icon now points to `./assets/petpal/app-icon-v1.png`.
- `app.json` splash now points to `./assets/petpal/welcome-screen-v1.png`.
- Android native resources were regenerated with `pnpm exec expo prebuild --platform android --no-install`.
- `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp` now renders the PetPal dog-cat-house mark.
- `android/app/src/main/res/values/colors.xml` uses the dark PetPal launch background.

Validation:

- `pnpm exec tsc --noEmit` passed.
- `.\android\gradlew.bat -p android :app:assembleDebug --console=plain` passed.
- `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` succeeded on `R3CXA03J3LH`.
- Device package `com.petpal.app` last update time: `2026-04-27 22:04:43`.

Captured evidence:

- `01-welcome.png` - first app welcome screen after initial app-level install.
- `02-discover.png` - Discover screen after tapping `Start safely`.
- `03-final-welcome.png` - final installed build after Android native icon/splash regeneration.
- `03-install.txt` - final ADB install output.
- `04-package-times.txt` - package version and update timestamp from the phone.
