# PetPal phone and production audit — 2026-09-08

## Scope and plan

Audit the current uncommitted UI/motion/typing changes over `db64e48`, preserving them. Do not implement fixes, create new test files, reset databases, deploy, or push. Use existing suites plus direct browser, phone and local-backend checks. Any synthetic data must be scoped and cleaned up; no real payments, account deletions, or external load testing.

1. Build the current configured app and install on the attached Samsung SM-S928B (Android 16).
2. Inspect navigation, native Back/keyboard, forms, focus, reduced motion, uploads, permissions, background/resume and disconnect/reconnect.
3. Exercise Animal Match, Foster, messages/typing and moderation with test accounts; distinguish positive behavior from rejected unauthorized behavior.
4. Run bounded local stress checks and existing SQL regression suites; record concurrency, pagination and latency evidence without claiming production capacity.
5. Assess release packaging, signing, backend/dependency readiness and data boundaries; deliver ranked findings, evidence, limitations and a go/no-go verdict.

## Build and installation evidence

- Frontend: 4 existing Jest suites / 19 tests PASS; copy/accessibility audit PASS / 847 keys. Static checks are not screen-reader acceptance.
- Optimized configured web build PASS: `main.9e9e6710.js` / 242.76 kB gzip; CSS 9.84 kB gzip.
- Admin lint/build PASS; shared TypeScript typecheck PASS.
- Capacitor sync and Android `assembleDebug` PASS (111 tasks; 22 executed, 89 up-to-date).
- Installation initially refused with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`. The user explicitly approved removal of the existing Dev app and local app data. Only `com.petpal.app.debug` was uninstalled, then the new APK installed successfully. Server data was not removed.
- APK SHA-256: `5B120D0D652CDF8EA4C6695D95CAD244452FD4B57628B1932F1C72B95CE67AB0`.
- Native cold launch PASS (`am start -W`, 565 ms activity launch; not time-to-usable-data). App WebView inspected over CDP, not an emulated desktop page.
- This is `PetPal Dev`, with the full current UI and the local Supabase backend reached through ADB reverse port 54321. It is not a production deployment and depends on the laptop connection.
- DB, Auth, Storage, Realtime and Kong local health-checks healthy; REST running; migration 0024 is recorded. An unrelated SignalXi container is unhealthy and was not modified.
- Initial direct SQL invocation lacked pgTAP. Rerun created pgTAP within each test transaction and rolled it back; no persistent extension installation. 15/16 existing suites completed successfully. The m18 suite passed 29 assertions then failed at legacy `rate_foster_home` because its ON CONFLICT columns no longer match a unique constraint. Authenticated EXECUTE on that legacy routine is revoked; current Foster UI calls `review_foster_placement`. This is a stale regression gate, not proof that current placement reviews fail.
- No Firebase `google-services.json` or release `keystore.properties` found in the expected Android paths. Release signing/configuration and actual push delivery require separate verification.

## Verdict

**NO-GO for production. The bounded local audit is finished, with failures and explicit coverage limits—not a production certification.** The notification-permission crash was fixed and the patched APK installed after explicit user approval. The resumed audit made no further product-code changes. Local functional flows largely work, but stress targets, the typing adapter, account workflows, dependency triage and production configuration/operational acceptance remain open.

### Final acceptance gates

| Gate | Result | What this establishes |
| --- | --- | --- |
| Frontend existing tests / copy audit | PASS | 4 suites, 19 tests; 847 translation keys; repeated after runtime work. |
| Web/admin/shared builds | PASS | Optimized frontend build, admin lint/build and shared typecheck completed earlier in this same audit; not rerun after every runtime step because product code was unchanged. |
| Android debug / physical installation | PASS | Patched APK installed on Samsung SM-S928B / Android 16; actual native permission grant and cold restarts no longer crash. |
| Existing SQL regression gates | FAIL overall | Final rerun: 15 of 16 suites pass. Legacy m18 aborts after 29 passing assertions at its obsolete review upsert. All transactions roll back. |
| Animal Match bounded discovery / races | PASS | 500 candidates, pages of at most 20; reciprocal likes and same-ID retries deduplicate correctly. |
| Two-way message delivery | Functional PASS; latency FAIL | Both 100-message runs delivered and persisted once; maxima 4,384 and 4,326 ms exceed the existing 2,000 ms target. |
| Local read load | Bounded PASS | 1,600 requests, 8 workers, zero errors in 26.097 s; not a soak or production-capacity result. |
| Large-history growth | MIXED | PostgreSQL statement timeout at 850 messages under host pressure; reached 1,000 after reducing load. Subsequent history/unread lifecycle passed. |
| Messaging lifecycle / safety | PASS with typing defect | Browser offline explicit retry, draft persistence, Back hierarchy, large text, length limit, block/unblock invalidation and sign-out cleanup passed. Typing clear is broken in the client adapter. |
| Foster lifecycle / role boundaries | PASS for exercised paths | Create/apply/chat/reserve/receive/complete/review; 100-animal registry, task completion, browser photo upload, reader/revocation checks. |
| Moderator UI / RPC boundaries | PASS for exercised paths | Synthetic listing hidden with a required reason; persisted moderation hold and audit entry; non-admin and stale-version calls rejected. |
| Phone-specific UI | PARTIAL PASS | Native Back/discard, real keyboard positioning, background/resume draft, picker open/cancel, reduced-motion setting and cold-start profile recovery checked. Real device offline delivery and completed native media upload not proven. |
| Release / external services | BLOCKED or UNVERIFIED | Local backend, absent Firebase/signing files, release-assets guard rejects current dev assets; actual push/payment/email-provider delivery and hosted operational checks outstanding. |

### Ranked open findings

1. **Release blocker — this is a laptop-connected Dev build, not a deployable production configuration.** Firebase configuration and release signing are absent in the inspected paths. `build-production-web.js` rejects `http://127.0.0.1:54321`; `:app:verifyReleaseWebAssets` rejects the current assets because the production build marker is absent. Both guards were executed and rejected as expected. Fixing the native crash does not make push work. No signed release, hosted-backend acceptance or real push delivery was demonstrated.
2. **Release acceptance gap — account/privacy/safety surfaces remain prototypes.** `ProfileTab.js:744` exports the current in-memory subset, not a complete server-side account export. At lines 1064–1065 and 1308, blocked-user/report history is hardcoded empty; line 1346 displays the disabled account-deletion notice. Notification choices visibly say they are local prototype settings. Complete these workflows or explicitly remove their production promises before release; this is not a legal-compliance opinion.
3. **P2 confirmed — ghost typing, including closed chats.** `supabaseApi.js:355` maps empty RPC data `[]` to true through `Boolean(data)` at line 363. `useMessaging.js:355` supplies `Date.now()` for its missing timestamp and renews the indicator. Raw participant RPC checks correctly return active then no rows after clear; the adapter is the failing boundary. The physical phone showed “Someone is typing…” alongside a closed-request notice and disabled composer. No fix was made during the resumed audit.
4. **P2 confirmed target miss — message latency and resource sensitivity.** Two runs missed the existing 2-second receipt target, and simultaneous history growth caused a DB timeout; a separate authentication attempt returned 504 before load workers started. An eight-worker read run later passed after reducing browser pressure. Determine the bottleneck under controlled representative load; these measurements cannot distinguish production server capacity from this 8 GB local machine's contention.
5. **Unresolved, potentially high-impact — intermittent authenticated profile hydration.** Earlier phone state showed mock Alex / `user-demo`, generated an invalid profile UUID query and failed the Foster overview while retaining an authenticated session. Sign-out/sign-in recovered. A later true cold restart restored Ana correctly and did not reproduce the defect; desktop reload also did not reproduce it. Keep this as an observed reliability finding, not a proven deterministic P1 root cause or evidence of cross-account disclosure. Investigate `AppContext.js` session/data initialization before acceptance.
6. **Dependency gate — unresolved advisories, reachability not assessed.** Frontend `npm audit --omit=dev`: 44 findings (2 critical, 22 high, 9 moderate, 11 low). React-scripts is under production dependencies, so this includes build tooling. Admin uses pnpm, not npm; `pnpm audit --prod --json` reports one high and one moderate `ws` advisory across 17 production dependencies. The first npm attempt was inapplicable because there is no npm lockfile; it is not a clean scan. Prioritize current advisory triage and distinguish browser bundle exposure from Node/build exposure; no package changes or exploit tests were made.
7. **P2 regression-gate debt — obsolete review SQL test.** Final m18 still fails with “there is no unique or exclusion constraint matching the ON CONFLICT specification”. The legacy function is not authenticated-callable; the current placement-review UI was separately exercised successfully. Update the obsolete test/function contract with approval; do not mark the whole DB regression gate green.

**Additional observation:** an already-open sender placement detail retained its earlier “In care” state after the other participant completed care. This is stale open-view behavior, not evidence that the database transition failed; the receiving phone and DB both showed COMPLETED. Cross-participant refresh behavior merits explicit acceptance criteria.

## Fixed blocker P1 — native push initialization crashed login/relaunch

The installed app calls `PushNotifications.register()` after authentication and permission approval, although no Firebase Android configuration is present. The native plugin throws rather than returning a rejected JavaScript promise, so the surrounding JavaScript try/catch does not protect the process.

Phone evidence from the Android crash buffer, 2026-09-08 13:55:37 local time, PID 24279:

```text
FATAL EXCEPTION: CapacitorPlugins
Process: com.petpal.app.debug
Caused by: java.lang.IllegalStateException: Default FirebaseApp is not initialized in this process com.petpal.app.debug. Make sure to call FirebaseApp.initializeApp(Context) first.
at com.google.firebase.FirebaseApp.getInstance(FirebaseApp.java:179)
at com.google.firebase.messaging.FirebaseMessaging.getInstance(FirebaseMessaging.java:120)
at com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin.register(PushNotificationsPlugin.java:102)
```

An additional relaunch at 13:55:43, PID 24833, produced the same exception. Earlier instances at 13:53 also appear in the buffer. The user manually uninstalled between attempts and explicitly requested reinstallation; the second install succeeded at 13:54:28 and cold activity launch took 470 ms. The repeated failure after a fresh installation establishes that replacing the APK is not the remedy.

Relevant path: `frontend/src/context/AppContext.js` auto-registers push for a signed-in Supabase account; `frontend/src/services/pushNotifications.js` requests permission and then calls native register; `frontend/android/app/build.gradle` treats absent `google-services.json` as a log-only condition.

The user subsequently explicitly requested the fix and installation. `MainActivity.java` now registers an app-owned push-plugin subclass that converts native `IllegalStateException` from register/unregister into a rejected plugin call (`PUSH_NOT_CONFIGURED`). Configured builds retain the existing plugin path. No dependency code or existing UI changes were modified. This prevents the crash; it does not configure Firebase, establish delivery, or add a visible notification-status UI.

### Remediation verification on the physical phone

- Incremental Android build PASS: 111 tasks, 4 executed, 107 up-to-date, 46 seconds.
- In-place APK update PASS at 14:06:48 local time; existing app data preserved. Patched APK SHA-256: `16EB4E6F10FC01D51C9B63EE1BC2540CAC8B94D94CB9790377993267B1CA7DD0`.
- Launch with notification permission already granted PASS; native register returned `PUSH_NOT_CONFIGURED` instead of terminating process 26717.
- Revoked only PetPal's notification permission, relaunched and tapped the actual Android **Allow** button. Permission became granted, process 27035 stayed alive, and Foster navigation rendered. The register rejection was logged at 14:07:38; that process had no crash-buffer entries.
- Two subsequent cold restarts completed (387 ms and 392 ms activity launch, not data readiness). First restarted process 27410 again returned the expected rejection with no crash-buffer entries and rendered the space chooser.
- `git diff --check` PASS (line-ending warnings only). No new test files, database changes, commit or push for this fix.

## Initial checkpoint before the user requested continuation

At the initial crash-fix handoff, extended runtime and stress checks had not run and no persistent synthetic data had been created. The subsequent sections record the requested continuation; the final gate table above supersedes this checkpoint.

## Resumed acceptance and stress evidence — chronological checkpoints

The user requested continuation after the crash-fix handoff. The preceding "not yet exercised" section is the pre-resumption checkpoint, not the final coverage matrix. Product code remains unchanged during this audit.

- Local PetPal containers healthy (REST running); existing static web assets served at 127.0.0.1:3000. Physical phone remains on the installed patched APK through ADB reverse.
- Pre-run baseline: 515 owner animal profiles, 8 conversations, 1,113 messages, 5 user profiles. Demo Adopter remains suspended; the existing stress script was run with active seeded Rocky/Luna owners instead. Existing historical QA data is not cleanup scope.
- Scoped match run: `QA-AUDIT-20260908-1788866670823`. 500 candidates enumerated in bounded 20-row pages with no duplicates. Concurrent reciprocal likes plus 20 repeat likes reused a single conversation; 20 simultaneous same-ID message retries produced one message and one notification. JSON evidence is under `output/playwright/QA-AUDIT-20260908-1788866670823/`.
- Existing browser script's instant Back-dialog count assertion ran during an exit animation; waiting for hidden completed within 3 seconds. Its later filtered-card checks also raced old content. In-memory runner adjustments waited for animation/current-run cards; source files were not changed. The original full-script run is not a pass.
- Two-browser 100-message run: all 100 arrived and persisted exactly once; slowest receipt 4,384 ms, failing the script's 2,000 ms target. This is local foreground browser timing under concurrent audit activity, not production capacity.
- **Confirmed P2: ghost typing.** Real typing appeared, but remained visible for more than 10 seconds after clearing the input. `loadSupabaseConversationTyping` maps an empty RPC array to `Boolean(data)` (true); the hook then substitutes the current time when `updatedAt` is null. Consequently repeated empty responses renew the indicator. DB inspection showed no typing rows. The hook-level fixtures did not exercise this adapter behavior.
- **Observed P1 candidate: phone profile hydration.** With an authenticated persisted session the phone displayed mock user Alex and queried `organization_members` with `profile_id=eq.user-demo` (HTTP 400), leaving the Foster overview unavailable while its directory still rendered. Fresh sign-out/sign-in as Ana restored a working Foster view. A desktop reload did not reproduce it. Root cause and cold-start reproducibility remain under investigation; do not infer account data leakage from this evidence.
- Phone native Back: after keyboard dismissal, Back with an edited profile draft showed the nested discard confirmation. The audit discarded the unsaved draft, not the stored profile. Sign-out and seeded Ana sign-in succeeded.
- Isolated unpublished foster home `81000000-0000-4000-8000-000000000908`, name `QA-AUDIT-20260908 Foster 100`, holds 100 synthetic registered animals with 100 distinct animal identifiers. Registration via authenticated RPCs took 17,323 ms total. Placement IDs use the `82000000-0000-4000-8000-` prefix, indices 1–100. Provenance: `Synthetic local verification only: QA-AUDIT-20260908`. Cleanup is pending at this checkpoint.
- Current frontend `npm audit --omit=dev`: 44 findings (2 critical, 22 high, 9 moderate, 11 low). This includes build-time tooling because react-scripts is a production dependency; these counts do not mean all advisories are reachable in the shipped WebView.
- Foster registry UI PASS at 390×844: four pages × 25 rows, 100 unique row labels, last-page Next disabled, search for animal 100 and loaded care detail. Physical phone search also passed. The first detail screenshot captured loading; `phone-audit-foster-100-detail-loaded.png` is the loaded browser evidence.
- A synthetic care task was created and explicitly marked done from the browser; DB confirmed task `f8b0dd2a-3926-4504-9d15-197964301937` completed. Invalid text-file photo selection was rejected by native HTML validity. An existing QA screenshot was uploaded, JPEG-converted and saved to the unpublished QA home. Its exact storage object is `10000000-0000-4000-8000-000000000003/81000000-0000-4000-8000-000000000908/1788868254981-c7967631-8f95-4d4a-b224-25266c204666.jpg`; cleanup pending. The real Android Google Photos picker opened after detaching CDP interception and cancelled without selecting personal media. Native media selection/upload itself is not yet proven.
- Initial eight-worker read-load attempt failed authentication with HTTP 504 before worker execution. During concurrent large-history growth, the host had 346,976 KiB free out of 8,183,096 KiB and DB/Kong CPU exceeded 100% of one core; PetPal containers remained healthy. Five confirmed task-owned older browser sessions were closed (foster-admin/home/rescue, readiness, productioncheck); other apps and Docker services were untouched.
- Repeated read-load PASS: 1,600 requests, eight workers, 26,097 ms until request cap, 61.31 requests/s, zero errors, p50 15 ms, p95 43 ms, p99 86 ms, max 1,410 ms, maximum 25 rows returned. It reached the request cap before the 60-second time cap; do not call this a completed 60-second soak or production-capacity benchmark.
- Second 100-message UI run delivered all messages once, max receipt 4,326 ms. Browser offline message survived reload and explicit retry persisted once. The history-fill step then hit a PostgreSQL statement timeout at 850 total messages. After reducing browser load, the same thread reached exactly 1,000 with 150 more authenticated RPC writes, p95 25 ms/max 67 ms. This does not erase the earlier stress failure.
- Fresh synthetic Foster handover created through browser UI: case `d2d9bc5b-0f8b-4453-807d-942bf5d98a42`, animal `31ade224-544a-4aa3-a2b3-2562fca5cc55`, request `c2acea3e-0ba8-4e15-b9ea-9dea4f1e6b8b`, conversation `b95d5b07-16b4-43e3-a9f7-b960583142fc`. Rocky published; Ana discovered/applied on phone; two-way pre-acceptance chat passed. Full-home acceptance required the acknowledgement checkbox and produced RESERVED. Sender UI lacked receipt and authenticated SQL rejected sender receipt; Ana explicitly declared receipt on phone, yielding IN_CARE.
- Phone draft survived native Home/background and resume. With actual keyboard shown and viewport reduced to 420 CSS px, composer occupied y=350.20..393.20 and remained visible; bottom tabs hidden in thread. An ADB reverse-removal attempt did not interrupt existing connections: its message sent successfully and no Retry appeared, so it is not offline-recovery proof. Port 54321 was restored in `finally`.
- Transactional role checks PASS, all rolled back: outsider cannot read private QA registry; invited/accepted READER can read 100+ placements but cannot write a care note; revocation removes access immediately. Existing suspended account unchanged.
- Additional release gaps by source inspection: Delete account only displays a disabled-prototype notice; blocked-users and report-history screens hardcode zero/empty notices; export is current in-memory profile/animals/preferences, explicitly labeled not a formal account export; notification preferences are local prototype settings. These are not complete production account/privacy workflows.

## Final runtime checks

- The phone explicitly ended the synthetic placement with a reason. DB placement `cbdb433a-4e31-4168-a3da-8a636d44c9ba` and its request became COMPLETED. The phone displayed Completed, a journal entry and a participant review action. A clearly labeled synthetic 5/5 review saved and rendered. Opening chat showed the closed-request/history notice with disabled message input and Send, while retaining the four earlier messages. This verifies the current review path independently of the obsolete m18 function.
- Existing lifecycle script rerun PASS. In-memory changes used active seeded Rocky instead of suspended Adopter, waited for the exiting dialog and for the animated sheet to settle within the 640 px viewport with a 1 px rounding tolerance. No script/test files were edited. Verified history-reader scroll position, unread count, New messages, nested Back hierarchy, Romanian at 360×640 with 24 px root text, a 4,001-character send rejection, composer within 360×430, hidden bottom tabs, cross-participant block access/cache invalidation, unblock recovery and sign-out clearing local chat storage. `output/playwright/QA-AUDIT-20260908-1788866670823/lifecycle.json` records the result. This rerun does not convert the original all-phase script or its failed latency checks to PASS.
- Direct authenticated typing RPC check PASS in a rolled-back transaction: Rocky set active, Luna saw active; Rocky cleared it, Luna received no rows. No persistent typing rows were left by that check.
- Moderator browser UI PASS on the exact synthetic case only: empty reason failed HTML validity, a labeled reason was submitted, listing became PAUSED with `moderation_hold=true`, and `LISTING_PAUSE` plus its reason appeared in moderation history. Independent rolled-back RPC checks rejected non-admin access and stale timestamps. Existing report/account moderation records were not acted upon.
- Phone cold restart at 15:17 local time: process 7809, COLD launch 527 ms (activity timing only). Persisted Ana profile and Foster navigation worked. No entries for this process in the Android crash buffer. Current Firebase registration still rejects rather than delivering push.
- Physical-phone reduced-motion switch PASS: `aria-pressed=true` and root `data-petpal-reduced-motion=true`; enabled preference survived leaving/reopening the settings screen. Restored to its original disabled setting. English and typing-enabled settings left as observed. This is not an Android TalkBack or full assistive-technology acceptance test.
- Final repeat: all 19 existing frontend tests and copy audit / 847 keys PASS. All 16 existing SQL suites rerun after synthetic cleanup: 15 PASS; m18 failed after 29 passing assertions with the same unique-constraint error. Temporary pgTAP setup was inside each transaction; no persistent extension installation.

## Synthetic-data cleanup and final state

Cleanup completed at approximately 15:23 local time, not merely scheduled. Storage cleanup used the authenticated Storage API for exactly the uploaded QA JPEG; the object was absent afterward and the QA folder listing empty.

Database cleanup ran in one transaction with exact run prefix, owner, home provenance, case IDs, relationship checks and expected counts. It removed:

- 517 owner-animal profiles: 501 discovery fixtures and 16 reciprocal-race fixtures; their nine matches and associated dependent likes/saves.
- 101 Foster animals and placements, one synthetic home, case and request, one review, one task, 105 journal entries and four request events.
- Ten conversations, 1,014 messages, 2,032 related notification events and the one synthetic listing-moderation audit entry.

Original-data JSON digests for nine tables were captured immediately before cleanup and compared inside the transaction after deletion: profiles, owner animals, animals, listings, foster homes, conversations, messages, matches and notifications all unchanged. This establishes cleanup safety; it does not imply authentication/activity timestamps were never touched during normal audit logins.

Restored counts: **515 owner animals, 8 conversations, 1,113 messages, 5 profiles, 3 animals, 3 listings, 1 foster home, 0 Foster requests and 0 placements.** Historical QA records already present before this run were preserved. Sequence counters were not rewound; gaps in Foster identifiers are expected. Synthetic records have been deleted, not moved to trash; their shapes can be recreated from the existing script and this report, but no data backup for restoring their exact transient state was retained. Screenshots and metric artifacts remain for inspection.

Phone left on the patched Dev build's space chooser, with Ana's session and ADB reverse 54321 available. Local PetPal DB/Auth/Storage/Realtime/Kong health checks healthy; REST running. No Docker reset, volume deletion, production deployment, Git commit or push. Existing UI/motion changes and the separately authorized native push-crash fix were preserved. `git diff --check` passes; line-ending warnings only.

## Remaining external or unexercised acceptance

- A signed release against the intended hosted backend, migrations/RLS/service credentials there, actual push delivery, email verification/password recovery and payment-provider/webhook end-to-end behavior. No real charges or external load were attempted.
- A controlled sustained soak and production-like concurrent writes, reconnect storms, background delivery/battery behavior, backup restoration and production observability. The 26-second capped local read run is not a substitute.
- Real physical-network disconnect/reconnect: removing ADB reverse did not break an existing connection. Browser offline/retry did pass, but native radio-loss recovery remains unproven. Native Google Photos opened/cancelled; completing native media upload with a permitted photo remains unproven.
- Broader device/OS/browser coverage, TalkBack/screen-reader acceptance, and every profile/registration/recovery path. This is a broad local audit of the changed app and its principal contracts, not exhaustive feature/security certification.

## Recommended next work, not implemented

Fix the confirmed empty-array typing adapter and reproduce the session-hydration incident; repair the obsolete regression gate; triage dependencies and repeat latency/soak checks on a controlled setup. Complete or scope out prototype account workflows. Then configure Firebase, production backend and signing and execute hosted/device/provider acceptance before reconsidering the NO-GO verdict.
