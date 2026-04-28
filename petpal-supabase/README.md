# PetPal Supabase

Supabase backend repository for PetPal.

## Contents

- `supabase/migrations`: database schema, RLS policies, and public-safe views.
- `supabase/policies`: policy design notes.
- `supabase/functions`: Edge Functions for admin-only transitions and notifications.
- `supabase/seed`: pilot demo data.
- `supabase/tests`: RLS and integration tests.

## Commands

```bash
pnpm install
pnpm run db:start
pnpm run db:reset
pnpm run db:test
```

## M9 Admin Moderation

Migration `0007_m9_admin_moderation_workflows.sql` adds:

- `admin_moderation_queue`
- `admin_set_organization_verification_status`
- `admin_resolve_report`
- `admin_suspend_profile`

The M9 pgTAP test proves admin-only access, report resolution, organization verification, user suspension, and audit/moderation action creation.

## M10 Live Admin Seed

The local seed now creates repeatable live admin records:

- `rescue@petpal.local` as `SUPER_ADMIN`
- one pending organization verification request
- one pending listing review
- one open report
- one active suspension

This lets `petpal-admin` prove live queue reads and moderation RPC calls after `pnpm run db:reset`.

The local Supabase runtime requires Docker Desktop with the Linux engine running.

## M11 Admin Security

Migration `0008_m11_admin_security_document_review.sql` adds:

- `has_admin_role`
- `admin_profile_view`
- `admin_document_queue`
- `admin_review_verification_document`
- `admin_close_suspension`

The M11 pgTAP test proves non-admin denial, document-review role access, document approval audit writes, suspension closure, and double-close protection.

## v1 Backend Rules

- RLS must be enabled on every app table.
- Public discovery must use safe views, not raw sensitive tables.
- Documents and exact locations must remain private.
- Service-role access belongs only in Edge Functions.
- Admin actions must be audited.

## Milestone Proof

- M1 runtime proof: see `M1_RUNTIME_PROOF.md`.
