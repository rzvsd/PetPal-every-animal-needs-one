# Password reset App Link

Password reset emails bring the phone back into PetPal through a verified
https App Link, `https://<host>/reset`, and the link carries a one-time PKCE
code instead of session tokens.

- Android opens the link only in the app whose signing key the host lists in
  `/.well-known/assetlinks.json`. Other apps cannot claim it the way they could
  claim the old `petpal://reset` scheme.
- The code can only be exchanged on the device that asked for the reset,
  because the PKCE verifier never leaves that app. A stolen link is useless.
- Consequence: the person must ask for the reset in the app and open the email
  on the same phone. Opening it on another device shows "That link no longer
  works. Ask for a new one on this phone and open it here."

## One-time setup

1. **Pick the host.** Any https domain you control, for example
   `petpal.example.com`. It only has to serve one static file.
2. **Serve `https://<host>/.well-known/assetlinks.json`** with
   `Content-Type: application/json`, over https with no redirects:

   ```json
   [
     {
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
         "namespace": "android_app",
         "package_name": "com.petpal.app",
         "sha256_cert_fingerprints": ["<RELEASE KEY SHA-256>", "<PLAY APP SIGNING KEY SHA-256>"]
       }
     },
     {
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
         "namespace": "android_app",
         "package_name": "com.petpal.app.debug",
         "sha256_cert_fingerprints": ["<DEBUG KEY SHA-256>"]
       }
     }
   ]
   ```

   Fingerprints: `keytool -list -v -keystore <keystore> -alias <alias>` (the
   debug keystore is `~/.android/debug.keystore`, alias `androiddebugkey`,
   password `android`). With Play App Signing, also add the key shown in
   Play Console > Setup > App signing.
3. **Supabase dashboard** > Authentication > URL Configuration > Redirect URLs:
   add `https://<host>/reset` and remove `petpal://reset`.
4. **Build with the host set.** Set `REACT_APP_AUTH_LINK_HOST=<host>` (bare host
   name, no `https://`) in the shell before `npm run build:production`,
   `npx cap sync android` and the Gradle build. Gradle reads the same variable
   (or `-PPETPAL_APP_LINK_HOST=<host>`) for the manifest. The production web
   build and signed release builds refuse to run without it.
5. **Check verification** after installing:
   `adb shell pm get-app-links com.petpal.app` should show the host as
   `verified`. To retry: `adb shell pm verify-app-links --re-verify com.petpal.app`.

The email template must keep using `{{ .ConfirmationURL }}` (the default),
which redirects to `https://<host>/reset?code=...`.

## Cold start

The app reads the link both from `appUrlOpen` (app already running) and from
`App.getLaunchUrl()` (app opened by the link), and handles each link once.
