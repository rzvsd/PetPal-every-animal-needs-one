# Android Release

PetPal Android production builds are Capacitor builds from `frontend/`.

## Build Profiles

Debug:

- package id: `com.petpal.app.debug`
- app name: `PetPal Dev`
- allows local cleartext traffic for `127.0.0.1`, `localhost`, and `10.0.2.2`
- intended for laptop/local Supabase testing only

Release:

- package id: `com.petpal.app`
- app name: `PetPal`
- cleartext traffic disabled
- no local Supabase demo credentials are included
- should use HTTPS production Supabase env values

## Production Env

Set production env in CI or the current shell before building:

```powershell
$env:REACT_APP_SUPABASE_URL="https://your-project-ref.supabase.co"
$env:REACT_APP_SUPABASE_ANON_KEY="your-production-anon-key"
$env:REACT_APP_VERSION="1.0.0"
```

Do not use `http://127.0.0.1:54321`, `localhost`, `10.0.2.2`, or demo login env vars for production.

The production web build is guarded by:

```powershell
cd "C:\BOTS\PetPal - every animal needs one\frontend"
npm run build:production
```

For a local packaging smoke with no backend baked into the app:

```powershell
cd "C:\BOTS\PetPal - every animal needs one\frontend"
npm run build:production:offline
```

## Release Signing

Use environment variables in CI:

```powershell
$env:PETPAL_RELEASE_STORE_FILE="C:\secure\petpal-upload-key.jks"
$env:PETPAL_RELEASE_STORE_PASSWORD="..."
$env:PETPAL_RELEASE_KEY_ALIAS="petpal-upload"
$env:PETPAL_RELEASE_KEY_PASSWORD="..."
```

Or copy:

```text
frontend/android/keystore.properties.example
```

to:

```text
frontend/android/keystore.properties
```

and fill real values. Never commit the keystore or passwords.

## Build Release APK/AAB

```powershell
cd "C:\BOTS\PetPal - every animal needs one\frontend"
npm run build:production
npx cap sync android

cd android
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME="C:\Users\razva\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
.\gradlew.bat :app:assembleRelease :app:bundleRelease --console=plain
```

Local unsigned/debug-signed verification only:

```powershell
cd "C:\BOTS\PetPal - every animal needs one\frontend"
npm run build:production:offline
npx cap sync android

cd android
$env:PETPAL_ALLOW_DEBUG_RELEASE_SIGNING="true"
.\gradlew.bat :app:assembleRelease :app:bundleRelease --console=plain
```

Outputs:

```text
frontend/android/app/build/outputs/apk/release/
frontend/android/app/build/outputs/bundle/release/
```

## Install Release APK Locally

```powershell
$adb="C:\Users\razva\AppData\Local\Android\Sdk\platform-tools\adb.exe"
& $adb install -r "C:\BOTS\PetPal - every animal needs one\frontend\android\app\build\outputs\apk\release\app-release.apk"
```

If the artifact is unsigned, use a signed APK/AAB before distributing.

## Verification Checklist

- App icon: `@mipmap/ic_launcher` / `@mipmap/ic_launcher_round`
- App name: `PetPal`
- Package id: `com.petpal.app`
- Permissions: `INTERNET`, `POST_NOTIFICATIONS`
- Release cleartext traffic: disabled
- Release manifest does not include debug `network_security_config`
- Production web bundle does not contain `127.0.0.1:54321`, `localhost`, or demo Supabase credentials
