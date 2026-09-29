# M6 Gated Chat Proof

Date: 2026-04-27

## Scope

M6 adds gated chat after accepted applications.

The rule is:

- Applying does not open chat.
- Only an accepted Adopt/Foster application opens a conversation.
- Only conversation participants can read/send messages.
- Blocks stop messaging and hide messages from the blocked conversation view.
- Message reports create moderation records.
- Notification events are queued for application acceptance, conversation open, and received messages.

## Acceptance Criteria

- Accepted applications create exactly one conversation.
- Applicant and organization participant are added to the conversation.
- Participants can send/read messages through RPC/view boundaries.
- Direct message insert policy checks participant status and block status.
- Blocking a shared conversation participant prevents later messaging.
- Message reporting creates a `reports` record with reporter/reported participants.
- Notification events are queued for applicant and message recipient.
- Mobile app exposes the M6 flow with Supabase-backed demo actions.

## Implementation Notes

- New migration: `petpal-supabase/supabase/migrations/0006_m6_gated_chat_notifications.sql`.
- New pgTAP test: `petpal-supabase/supabase/tests/m6_gated_chat_notifications.test.sql`.
- Mobile API additions: `petpal-mobile/src/api/petpalApi.ts`.
- Mobile type additions: `petpal-mobile/src/types/petpal.ts`.
- Mobile UI additions: `petpal-mobile/App.tsx`.

## Database Checks

Command:

```powershell
pnpm run db:reset
```

Result:

- Applied migrations `0001` through `0006`.
- Seeded demo Auth users, organization, animals, and active listings.
- Finished successfully.

Command:

```powershell
pnpm run db:test
```

Result:

```text
Files=6, Tests=89
Result: PASS
```

The first `db:test` immediately after one reset timed out connecting to Postgres. Rerun after a short Docker settle delay passed cleanly.

## REST Smoke

Direct local API smoke covered:

```text
APPLICATION_ID=petpal-trustcare
CONVERSATION_ID=petpal-trustcare
CONVERSATION_COUNT=1
MESSAGE_ID=petpal-trustcare
MESSAGES_BEFORE_BLOCK=1
REPORT_ID=petpal-trustcare
BLOCK_CREATED=true
BLOCKED_SEND_REJECTED=true
BLOCKED_SEND_ERROR={"code":"P0001","message":"Messaging is blocked for this conversation"}
MESSAGES_AFTER_BLOCK=0
```

After the REST smoke, the database was reset again so the local demo starts fresh.

## Mobile Checks

Command:

```powershell
pnpm exec tsc --noEmit
```

Result: pass.

Command:

```powershell
pnpm exec expo export --platform web
```

Result:

```text
env: load .env.local
env: export EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY
Exported: dist
```

Static smoke:

```powershell
python -m http.server 8086 --bind 127.0.0.1 --directory dist
```

Result:

```text
STATIC_HTTP_STATUS=200
```

## Shared/Admin Checks

Shared:

```powershell
pnpm run typecheck
pnpm run build
```

Result: pass.

Admin:

```powershell
pnpm run lint
pnpm run build
```

Result: pass.

## Secret Scan

Command:

```powershell
Select-String -Pattern 'sb_secret|service_role|SUPABASE_SERVICE|JWT_SECRET|eyJ[a-zA-Z0-9_-]{20,}'
```

Result:

- No source-code service-role/JWT secret hit.
- Hits were the scan pattern inside `M5_REAL_DATA_PROOF.md` and lockfile integrity hashes.

## Demo Flow

Fresh local flow:

1. Open the mobile app.
2. Refresh listings.
3. Submit a real Supabase application for Luna.
4. Use `Accept latest and open chat`.
5. Send a gated message.
6. Report latest message.
7. Block rescue demo to verify the block safety path.

Demo accounts:

- Rescue: `rescue@petpal.local`
- Adopter: `adopter@petpal.local`
- Password: `petpal-demo-password`

## Status

M6 is complete for local development proof.

Next milestone: M7 admin and moderation workflows.
