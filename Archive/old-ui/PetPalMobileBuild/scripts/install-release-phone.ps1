$ErrorActionPreference = 'Stop'

$adb = 'C:\Users\razva\AppData\Local\Android\Sdk\platform-tools\adb.exe'
$apk = Join-Path $PSScriptRoot '..\android\app\build\outputs\apk\release\app-release.apk'

if (-not (Test-Path -LiteralPath $adb)) {
  throw "ADB not found at $adb"
}

if (-not (Test-Path -LiteralPath $apk)) {
  throw "Release APK not found at $apk. Run android\gradlew.bat -p android :app:assembleRelease first."
}

$devices = & $adb devices -l
$deviceLine = $devices | Select-String -Pattern '\bdevice\b' | Select-Object -First 1

if (-not $deviceLine) {
  $devices
  throw 'No Android device is visible to ADB. Enable USB debugging, accept the RSA prompt, and reconnect the phone.'
}

$serial = ($deviceLine.ToString() -split '\s+')[0]

& $adb -s $serial reverse tcp:54321 tcp:54321
& $adb -s $serial install -r $apk
& $adb -s $serial shell pm clear com.petpal.app
& $adb -s $serial shell monkey -p com.petpal.app 1

"Installed and launched PetPal on $serial"
