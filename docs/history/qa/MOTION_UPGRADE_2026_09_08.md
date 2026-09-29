# Motion and Foster presentation — 2026-09-08

The agreed changes are implemented locally. This report records the checks performed on this change; it does not replace phone acceptance or certify production readiness.

## Delivered

- Foster uses cream surfaces, restrained sage and clay accents, consistent fields, correctly sized checkboxes/radios, and stable form actions. The current directory, home, requests and placement workflows are preserved.
- Shared motion covers navigation selection, entry, disclosures, dialogs, sheets, saved feedback and new message bubbles. The app preference and operating-system reduced-motion preference both suppress movement. Startup decoration is brief and does not intercept input.
- Ordinary Likes retain the candidate while the request is pending and on failure. Only a confirmed mutual match gets the short two-heart celebration. Social Walk retains its request flow.
- Dirty forms ask whether to discard; clean forms close directly. Nested confirmations retain focus and make the underlying dialog inert. Foster photo uploads keep the form busy until finished.
- Saved owner and animal details drive basic-detail checklists. Unknown breed/sex is an answer; completeness is not verification. General verification badges and new Verified Mate entry points are withdrawn, consistent with ADR 0001.
- Real, optional typing activity uses authenticated RPCs, no draft text, a six-second expiry and current authorization checks. Sharing defaults on and controls outgoing activity. Polling and publishing stop with visibility, connection, thread and account changes.

The [RareUI component catalogue](https://www.rareui.com/components) informed restrained reaction, selection, counter and transition patterns. Six component documentation pages and the EmojiReaction source were reviewed. PetPal uses its existing Framer Motion dependency; no component package was added. The obsolete five-step Foster application was not reintroduced.

## Checks completed

| Check | Evidence/result |
| --- | --- |
| Existing frontend regression suite | `CI=true npm test -- --watchAll=false --runInBand`: four suites, 19 tests passed, including added typing cases in the existing messaging test file. |
| Copy/accessibility audit | `npm run audit:copy-a11y`: passed, 847 translation keys. This is a static audit, not a screen-reader acceptance test. |
| Targeted frontend lint | Passed on changed components and services. |
| Optimized web build | Passed. Final preview bundle: `main.f50c58d5.js`, 243.01 kB gzip; CSS: `main.83340073.css`, 9.87 kB gzip. |
| Production-profile offline build | Passed; intentionally shows the missing-configuration guard. These assets were synced into Android. |
| Android release compilation | `gradlew :app:assembleRelease`: passed, 191 actionable tasks. APK is unsigned and contains the offline configuration guard. |
| Local SQL typing/match checks | Existing m6 suite: 24 assertions passed. Existing m19 suite: 42 assertions passed. Migration 0024 applied to the existing local database without a reset. |
| Foster form behavior | Changing the home name and pressing Back opened the discard confirmation. Keep editing retained the draft. Restoring original values, including capacity, allowed a clean close and returned focus to Edit home. |
| Nested profile dialog | Cancel with an edited display name opened a confirmation; the page and editor were inert beneath it. Keyboard focus stayed in the confirmation; dismissal restored the editor and its draft. |
| Preference persistence | Reduced motion and server-backed typing sharing survived reload. Both were restored to their original values after the check: reduced motion off, typing sharing on. |
| Responsive/localized visuals | Foster and settings inspected at 390×844; Romanian settings inspected at 320×760. Fields, switches and navigation remained contained. Language restored to English. |

Browser checks used the running local Supabase service and an existing seeded account. No Foster/profile form changes were submitted. No new test files or fixtures were created; regression changes extend existing files.

## Evidence

- [Foster explore](../../output/motion-qa-2026-09-08/foster-explore.png)
- [Foster fields and fixed actions](../../output/motion-qa-2026-09-08/foster-fields.png)
- [Foster discard confirmation](../../output/motion-qa-2026-09-08/foster-discard.png)
- [Comfort and privacy](../../output/motion-qa-2026-09-08/preferences.png)
- [Romanian settings at 320px](../../output/motion-qa-2026-09-08/preferences-ro-320.png)

Unsigned APK: `frontend/android/app/build/outputs/apk/release/app-release-unsigned.apk` (5,140,781 bytes).

SHA-256: `CFDAE04C0D3F29D3FCCD3100F051E92D98F150CEFB838065145DA57FB07E97E8`.

## Remaining limits

The broader SQL run is not green: the existing m18 test fails in `rate_foster_home` because its `ON CONFLICT` target has no matching unique/exclusion constraint (planned 33 assertions, ran 29). That routine and its schema were not changed by this work.

No Android device was connected. Native keyboard, touch/drag behavior, frame pacing, push and background/resume behavior still need device acceptance. The unsigned offline APK proves packaging only; it is not a configured release for use.

Typing authorization and lifecycle behavior have SQL and hook-test coverage. A fresh two-browser positive typing exchange was not completed: the retained local conversation pairs include a suspended participant. Existing accounts were not unsuspended to manufacture a passing demonstration.

No remote migration, deployment, commit or push was performed. Before deploying the frontend, apply migration 0024 to the intended backend and perform the remaining device and two-account acceptance checks.

## Follow-up: visible motion and installed Dev update

The user reported that the installed app still felt static. The initial work emphasized subtle transitions and conditional feedback, and did not deliver the expected visual character. The subsequent phone audit in `PHONE_PRODUCTION_AUDIT_2026_09_08.md` records installation of those earlier changes; an outdated build was not assumed to explain the feedback.

This follow-up adds an original SVG dog-and-cat illustration to the space chooser and Foster Explore. It greets on entry, with a wagging tail, head tilt, blink and settling entrance; tapping **Say hello** replays it. Decorative movement finishes rather than looping indefinitely. The chooser cards have more pronounced entrances, Foster results enter with a short capped stagger, and the navigation highlight is now a moving pill with a brief icon bounce/rotation.

A direct browser check also exposed stale reduced-motion state: the installed Framer Motion hook takes an initial snapshot and does not subscribe React state to later system-setting changes. The shared PetPal hook now uses React's `useSyncExternalStore` with the native media-query change event. System reduce-motion and the app preference remain additive; neither is overridden to force animation.

Verified on the final code:

- Existing frontend tests: four suites, 19 tests passed. Copy audit: 848 keys passed. Targeted lint and optimized build passed.
- Replay sampling captured changing tail transforms during eight timed samples; navigation sampling captured seven distinct icon transforms. A later check found zero running greeting animations at rest. These are browser behavior checks, not phone frame-rate measurements.
- Changing the emulated system preference while the page stayed open immediately set the shared reduced flag, disabled the replay control and reduced CSS animation duration to 0.01 ms. Returning to normal re-enabled replay. Emulation and temporary diagnostic variables were cleared; no account preference was changed.
- Visual inspection at 390×844 and 320×760; [chooser](../../output/motion-qa-2026-09-08/lively-chooser.png) and [Foster Explore](../../output/motion-qa-2026-09-08/lively-foster.png) screenshots retained.
- Final web assets: `main.74520209.js` (244.45 kB gzip), `main.17fe2af2.css` (10.41 kB gzip). Capacitor sync and Android debug compilation passed.
- The initial in-place install was rejected because the isolated build used a different debug signing key. Certificate comparison found that the existing user's development key matched the installed app. The APK was signed with that existing key and **updated successfully without uninstalling or clearing data**.
- Samsung `R3CXA03J3LH`, package `com.petpal.app.debug`: last update **2026-09-08 16:01:41**; first installation remains **2026-09-08 13:54:28**. Artifact: `frontend/android/app/build/outputs/apk/debug/app-debug-user-signed.apk`. SHA-256: `65B5A1009CADA06EBE2CB0C0FFCDB9DEAA77436272A262DC83846F705ECEEE6E`.

The APK remains PetPal Dev against the existing local backend. This follow-up did not fix or re-certify the separate backend/account/release findings in the phone audit. No new test files, packages, remote deployment or repository push were added.
