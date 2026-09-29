# Animal Match implementation and release gate — 2026-09-07

## Verdict

Local implementation and the checks listed below are complete. **Production release remains NO-GO** until the release-configured staging build is exercised on the Samsung, including push delivery and native lifecycle/keyboard checks.

The Samsung `R3CXA03J3LH` was connected at the start but disconnected before installation of the new APK. The installation command returned `device not found`; it was not retried against another device. The phone still has its earlier build. Browser results below are not phone acceptance results.

Final local APK, including the Social Walk follow-up: `frontend/android/app/build/outputs/apk/debug/app-debug.apk` (8,357,314 bytes). SHA-256: `AE2977A041DFC5A1E69EAECE3C326C41211FDAE1EE41BBE0ED6F96D43498A54B`. This is a local-Supabase debug build, not a staging release artifact.

## Implemented

- Discover uses the compact animal selector, modes, one filter sheet, photography, stored facts, labeled verification and About animal. Compatibility scores and synthetic explanations were removed, including unused demo values and translations.
- Browse/Saved uses account-owned records, database uniqueness and RLS. Discovery is paged by animal ID, 20 records per request. Filters apply only on Apply; dismissal discards drafts. Not now is a session-only skip per acting animal and mode.
- Playdate/Verified Mate Like failures keep the card and display an error; the action is guarded while pending. Mutual likes are serialized by animal pair/mode and reuse one match/conversation. Verified Mate checks remain server-enforced; owners cannot self-approve verification decisions through direct profile edits. Social Walk now uses the request flow documented below.
- Sheets are viewport-contained with fixed actions, focus handling and background interaction locked. Details and chat use bounded scrolling. The long-name header is compact; complete context is available in Match details. Android explicitly requests resize for the keyboard.
- Sends use a sender-scoped client UUID. The two-argument RPC remains compatible. Retrying an uncertain send reuses the server message and creates no extra notification event. Direct inserts cannot bypass serialized sending and notification creation.
- Sending/Sent/Failed states, explicit retry, account-scoped drafts/outbox, restart reconciliation and sign-out cleanup are implemented. Sent means server acceptance, not receipt/read by the other person.
- Authorized Realtime messages display immediately; HTTP reconciliation fills sequence gaps. The reconciliation cursor does not jump forward merely because a later outgoing message was accepted. Reconnect/foreground reconciliation and a five-second foreground fallback are included.
- Inbox pages are 20; opening a thread loads the latest 50 messages. Earlier pages preserve the scroll anchor. Unread totals cover the whole inbox, and read position advances while the thread is at its newest messages. Incoming messages do not move a reader away from older history.
- Block changes invalidate participant inbox state. Blocked messages/previews are hidden in both current and legacy read views. Push tap routing checks the conversation through the account-authorized inbox; new-message notification payloads contain IDs and generic text, not message bodies.
- Production-profile web builds disable demo access. Missing configuration is an explicit error, with no mock fallback. Android release asset merging requires the production build marker; it refuses ordinary test web assets.

## Verified locally

| Check | Result |
| --- | --- |
| SQL regression suite | PASS: 16 files, 265 assertions, including authenticated-role RLS tests |
| Frontend regression suite | PASS: 4 suites, 11 tests |
| Copy/accessibility static audit | PASS: 594 translation keys; this is not a complete assistive-technology audit |
| Frontend optimized test build | PASS |
| Production-profile offline build | PASS: only configuration error, zero demo buttons, no mock animals |
| Android release asset guard | PASS: rejected test assets; accepted production-profile assets after sync |
| Admin lint/build and shared package build | PASS |
| Android debug compilation | PASS; installation and native acceptance still pending |
| Discovery/filter UI | PASS at 412×915: identity and Like visible without initial scrolling, body stays viewport-sized |
| Failed Like | PASS: failure visible, candidate retained |
| Saved/Not now | PASS: saved record survives reload; Not now advances Saved and resets with the session |
| 500 candidates | PASS: bounded 20-record pages, 500 unique results |
| Concurrent reciprocal likes | PASS: a match is created; 20 concurrent repeat likes resolve to one conversation |
| Concurrent retry | PASS: 20 simultaneous requests with one UUID produce one message and one recipient notification event |
| Two-way browser messaging | PASS: 100 uniquely identified messages persisted once and appeared once on the recipient |
| Foreground browser latency | PASS after correction: another 100-message exchange, maximum 1,580 ms |
| Offline/restart/retry | PASS: failed text survived reload; explicit retry appeared once on the recipient |
| Draft restart | PASS |
| 1,000-message history | PASS: opens with 50; loading earlier shows 100 and preserves the visible anchor |
| History/unread | PASS: incoming message does not move history reader and remains unread there |
| Back order in browser | PASS: sheet/safety dialog → thread/inbox → Discover |
| Romanian, long names, increased text | PASS: 360×640 at 150% root font size, plus a 360×430 reduced viewport; composer remains accessible |
| Length limit | PASS: 4,001 characters disable Send; SQL independently rejects overlong text |
| Live block invalidation | PASS: the other participant's composer disables and cached messages disappear; direct reads return none |
| Sign-out | PASS: account chat storage removed |

An earlier latency run measured 2,222 ms and failed the strict threshold. The implementation then removed the extra HTTP wait before displaying an already-authorized Realtime message; the subsequent 100-message run passed. Both results are retained rather than replacing the failed evidence.

The reduced-viewport run initially exposed a real obstructed composer with long names and large text. The compact header correction was then retested successfully. Browser resizing is only a proxy for reduced space, not proof of native IME behavior.

Existing SQL tests that counted every row were scoped to their own seed/transaction fixtures so retained local QA data does not change their expected counts. No database reset was used for this implementation.

## Reproducible evidence

Local, git-ignored artifacts are under `output/playwright/QA-1788794589308/`:

- `result.json`: first 100-message exchange, the original latency failure, and 1,000-message history run.
- `latency-1788795296136.json`: corrected run, 100 messages, maximum 1,580 ms.
- `concurrency-*.json`: isolated simultaneous-like/send results.
- `lifecycle.json`: completed history/unread, Back, Romanian/large-text, block and sign-out checks.
- `discover.png`, `chat.png`, `romanian-large-text-filters.png`, `romanian-reduced-viewport-chat.png`: layout evidence. Initial failing layout screenshots are retained separately.

All traffic used seeded local test accounts. Generated QA animals and conversations remain available for inspection. The main conversation is `a0a67405-4b3e-4635-a071-c1b73576259c`. Its history now exceeds 1,000 because subsequent independent checks add messages. Each run uses a unique message batch label.

The block test refuses to touch an existing block. It uses INSERT, records the returned creation timestamp, and cleanup matches the exact blocker, blocked account and timestamp of only its own new record. This restriction was added after the initial cleanup was rejected by the safety check; the narrowed test was then allowed and passed.

The browser runner uses the installed Playwright runtime and seeded local credentials from the repository. It refuses a database host other than `127.0.0.1`:

```powershell
# From the repository root. Start the frontend separately with npm start.
npx --yes --package @playwright/cli playwright-cli --help
$qaPlaywright = Get-ChildItem "$env:LOCALAPPDATA/npm-cache/_npx/*/node_modules/playwright/package.json" | Select-Object -First 1
$env:NODE_PATH = Split-Path (Split-Path $qaPlaywright.FullName)
$env:PETPAL_QA_RUN = 'QA-1788794589308'
$env:PETPAL_QA_PHASE = 'chat' # rpc, chat or lifecycle reuse these fixtures
node frontend/scripts/verify-match-readiness.cjs
```

Use `PETPAL_QA_PHASE=all` without `PETPAL_QA_RUN` for a fresh complete fixture run. It creates and retains 501 animal profiles plus separate race-test profiles. `PETPAL_QA_APP_URL` can point at a locally served optimized build; it defaults to `http://localhost:3000`. Do not run this against real-user data.

Regression commands, from their corresponding package directories:

```text
frontend: npm test -- --watchAll=false
frontend: npm run audit:copy-a11y
frontend: npm run build
frontend: npm run build:production:offline
petpal-admin: npm run lint; npm run build
petpal-shared: npm run build
petpal-supabase: supabase test db
frontend: npx cap sync android
frontend/android: .\gradlew.bat assembleDebug
frontend/android: .\gradlew.bat :app:verifyReleaseWebAssets
```

On this Windows installation, the working Supabase executable is `petpal-supabase/node_modules/.pnpm/supabase@2.95.3/node_modules/supabase/bin/supabase.exe`. Realtime was disabled in the existing local config; it is now enabled. The local stack was restarted with its database volume preserved.

## Rollout order and outstanding release gate

1. Apply additive migrations **0016 → 0017 → 0018 → 0019** to staging first. They provide saved animals, discovery/send/read contracts, legacy-compatible views/RPCs, unread totals, block invalidation and Social Walk consent. Do not edit already-applied migration files.
2. Supply the staging HTTPS Supabase configuration, Firebase/FCM configuration and release signing through the existing secret/configuration mechanism. Do not commit credentials.
3. Build production-profile web assets, sync Android, and install the release-configured staging build on the reconnected Samsung. The offline production build used above proves the no-demo guard only; it is not staging acceptance.
4. Repeat discover → mutual like → chat with Samsung client A and independent browser client B; repeat the 100-message/two-second check and native network loss, rapid taps, background/resume, restart, session expiry and blocking scenarios.
5. Verify actual keyboard open/closed, Android Back/predictive Back, system text scaling, push registration/delivery and notification-to-thread navigation. Confirm no obstructed controls, unauthorized reads, duplicate notifications or message loss.

Missing at verification time: connected phone, staging project configuration, `google-services.json`/FCM delivery setup and release signing configuration. Native session-expiry/background/push acceptance was not claimed. No remote deployment or Git push was performed for this implementation. Payments and broader Foster redesign were left outside this task.

## Follow-up: Social Walk without a mutual match

Implemented after the user approved a single first-message request with recipient acceptance, decline or blocking. No new dependencies, test files or test helpers were added in this follow-up. The existing chat, drafts, safety actions, Realtime subscription and notification queue are reused.

- Social Walk shows **Suggest a walk / Propune o plimbare**. Both animals must have Social Walk enabled when a request is sent; the target must be discoverable and neither owner may have blocked the other.
- A request and its first message commit atomically. A per-owner-pair lock reuses the existing Social conversation, including reciprocal/concurrent requests or a request using a different animal. A declined request cannot be repeated. Existing Social chats from before this change remain usable.
- Incoming requests and sent/declined/accepted states appear in Messages. Only the recipient may accept or decline. No further messages are permitted before acceptance, enforced at the database boundary for both send RPC signatures and older clients. Legacy Social likes cannot create a new chat; Playdate and Verified Mate keep mutual likes.
- The first-message draft is account-scoped and saved before sending. A failed request retains the text; retry does not duplicate the conversation/message. Blocking uses the existing safety flow. Nothing here promises an actual scheduled walk or animal compatibility.

Verification:

- Existing regression suites still pass: **265 SQL assertions, 11 frontend tests**; copy/accessibility audit now checks **613 keys**. Final web build, Capacitor sync and Android debug compilation pass.
- **31 direct SQL assertions**, executed against existing seeded accounts inside a rolled-back transaction, pass: ownership, length validation, pending-send rejection, unrelated-account reads/decisions, same-owner repeat protection, refusal, blocking, acceptance and authorized sending. The initial direct-insert assertion expected RLS to run first; it was corrected after observing the consent trigger reject the insert before RLS. A separate accepted-chat assertion confirms direct inserts are still RLS-blocked.
- **20 concurrent reciprocal requests** through authenticated HTTP produce exactly one conversation, one first message and one recipient notification event. Decline and repeat protection pass. Retained local QA thread: `5b2cafb5-c59e-4204-9ec8-5ab4051f84a2` (Max/Rocky).
- Two independent browsers pass: failed request preserves text, successful retry appears immediately at the recipient, neither side has a composer before acceptance, recipient acceptance enables both composers, two-way replies and reload preserve the three messages exactly once. Retained local QA thread: `7ed55e4f-379d-4bac-91be-c0652fe12ee2` (Max/Luna).
- Incoming request controls fit **360×640 at 150% root text size**. Romanian accepted/declined views were checked. A browser assertion run during a development hot reload landed on the space chooser, so navigation was repeated after reload and the persistence assertion then passed; it was not a message-loss defect.
- Screenshots: `output/playwright/social-walk-pending-sender.png`, `social-walk-incoming-large-text.png`, `social-walk-accepted-chat.png`, `social-walk-declined-ro.png`, `social-walk-accepted-ro.png`.

Migration 0019 is applied **locally only**. The refreshed debug APK includes this change but has not been installed or accepted on the physical phone. The staging/FCM/signing/native release gate above remains unchanged.
