# M11 Admin Security + Production Readiness Proof

Date: 2026-04-28

## Scope

M11 hardens the live admin console from a connected moderation dashboard into a safer production-readiness surface.

Implemented:

- Current-admin role guard through `admin_profile_view`.
- Role-aware document review through `admin_document_queue`.
- Admin RPC for verification document approval/rejection.
- Admin RPC for closing active suspensions.
- Audit and moderation-action writes for document review and suspension closure.
- Admin UI access-denied state for signed-in users without admin roles.
- Local-only demo-login boundary for `?demo=1`.
- Five live admin queues in the console: organization, listing, document, report, suspension.
- Internal moderation-note input before actions.
- Confirmation modal before live admin mutations.

## Backend Changes

Migration:

- `petpal-supabase/supabase/migrations/0008_m11_admin_security_document_review.sql`

Adds:

- `has_admin_role(required_role text)`
- `admin_profile_view`
- `admin_document_queue`
- `admin_review_verification_document(document_id_input, target_status_input, notes_input)`
- `admin_close_suspension(suspension_id_input, notes_input)`

Seed:

- `petpal-supabase/supabase/seed/seed.sql` now creates a pending verification document for the live admin document queue.

Tests:

- `petpal-supabase/supabase/tests/m11_admin_security_document_review.test.sql`

## Admin Console Changes

Updated:

- `petpal-admin/src/api/adminApi.ts`
- `petpal-admin/src/App.tsx`
- `petpal-admin/src/App.css`
- `petpal-admin/scripts/live-admin-smoke.mjs`

The admin app now fetches the current role before loading queues. If Supabase does not return an admin role, the app blocks access and shows an access-denied surface.

## Validation

Evidence folder:

- `evidence/m11-admin-security-2026-04-28`

Commands:

```bash
pnpm run build
pnpm run lint
pnpm run db:reset
pnpm run db:test
pnpm run smoke:live
```

Results:

- Admin build: pass
- Admin lint: pass
- Supabase reset: pass
- Supabase tests: pass
- Test files: 8
- Tests: 131
- Live admin smoke: pass

Live smoke output proved:

- `rescue@petpal.local` resolves as `SUPER_ADMIN`.
- Admin sees 5 live queue items.
- Non-admin sees 0 moderation queue rows.
- Non-admin sees 0 document queue rows.
- Report resolution writes the expected audit signal.
- Document review writes the expected audit signal.
- Suspension closure writes the expected audit signal.

## Screenshot Evidence

- `evidence/m11-admin-security-2026-04-28/08-live-admin-security-console.png`

The screenshot shows:

- Signed-in admin: `rescue@petpal.local`
- Role: `Super admin`
- Loaded live moderation items: 5
- Queue cards:
  - Organization verification: 1
  - Listing approval: 1
  - Document review: 1
  - Report review: 1
  - Suspension review: 1

## Acceptance

M11 is accepted because the admin role boundary, document queue, suspension closure, confirmation UX, audit writes, and non-admin denial path are implemented and verified through static build/lint, pgTAP, live Supabase smoke, and screenshot evidence.
