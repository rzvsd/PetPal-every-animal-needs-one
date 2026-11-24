# Deploying database changes

New files in `petpal-supabase/supabase/migrations/` reach the hosted Supabase
project automatically. When a PR merges, CI runs on `main` (fresh database,
all migrations, database tests). If it passes, the **Deploy database**
workflow (`.github/workflows/deploy-db.yml`) applies every migration the
hosted database has not recorded yet.

- Each file runs in one transaction together with its row in
  `supabase_migrations.schema_migrations`. A failing file changes nothing and
  the workflow goes red; later files are not tried.
- A migration counts as applied when its number appears in a recorded name.
  The early hosted rows cover ranges such as `0002_to_0005_...`.
- Migration numbers must stay unique and only grow. Never edit a migration
  that has been applied; add a new one.
- Edge Functions are not deployed by this workflow.

## One-time setup

Add a repository secret named `SUPABASE_DB_URL`:

1. Supabase dashboard → project `petpal` → **Connect** (top bar).
2. Under **Session pooler**, copy the URI. It looks like
   `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`.
   Use the session pooler, not the direct connection: GitHub runners have no IPv6.
3. Replace `[YOUR-PASSWORD]` with the database password. If you don't know it,
   reset it under **Project Settings → Database → Reset database password**.
4. GitHub → repository **Settings → Secrets and variables → Actions → New
   repository secret**. Name `SUPABASE_DB_URL`, value the full URI.

## Manual run

Actions → **Deploy database** → **Run workflow**. With "Only list pending
migrations" ticked it changes nothing and prints what would be applied.

Locally: `SUPABASE_DB_URL=... petpal-supabase/scripts/deploy-migrations.sh --dry-run`.
