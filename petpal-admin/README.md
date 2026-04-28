# PetPal Admin

Internal web console for PetPal verification, approval, reports, suspensions, and audit review.

## v1 Responsibilities

- Verify shelters and rescuers.
- Approve or reject Adopt/Foster listings.
- Review reports.
- Suspend users or listings.
- Keep a visible audit trail for admin actions.

## Commands

```bash
pnpm install
pnpm dev
pnpm run build
pnpm run lint
```

## M9 Status

The M9 console now includes queue cards, selected-case review, moderation actions, and an audit trail. The current UI is local demo state that mirrors the Supabase RPC boundaries:

- `admin_set_organization_verification_status`
- `admin_set_listing_review_status`
- `admin_resolve_report`
- `admin_suspend_profile`

The next admin milestone should wire this screen to Supabase auth and live RPC calls.

## M10 Status

The console is now wired to live Supabase auth and moderation RPCs.

Local setup:

```bash
cp .env.example .env.local
pnpm install
pnpm run build
pnpm run smoke:live
```

Seeded admin login:

- Email: `rescue@petpal.local`
- Password: `petpal-demo-password`

The local-only `VITE_ENABLE_DEMO_LOGIN=true` flag allows browser evidence capture with `?demo=1`. Do not enable that flag outside local development.

## M11 Status

The console now enforces an admin role guard before loading moderation data and includes the production-readiness queues/actions:

- current admin role read from `admin_profile_view`
- access-denied state for signed-in non-admin users
- document review queue
- document approve/reject actions with audit notes
- active suspension closure
- confirmation modal before live mutations
- internal moderation note input for audit history

The live smoke now proves the seeded `SUPER_ADMIN` sees five queues while the seeded non-admin sees no moderation or document-review rows.

## Boundary

This is not a public app. Public v1 users should interact with `petpal-mobile`; moderation and safety work belongs here.
