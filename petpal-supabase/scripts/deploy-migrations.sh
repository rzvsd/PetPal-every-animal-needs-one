#!/usr/bin/env bash
# Applies migrations from supabase/migrations that the hosted database does not
# have yet. Each file runs in its own transaction together with its row in
# supabase_migrations.schema_migrations, so a failing file changes nothing.
#
# A migration counts as applied when its number appears in a recorded name.
# Early hosted rows cover ranges ("0002_to_0005_..."), which are expanded.
#
# Usage: SUPABASE_DB_URL=postgresql://... deploy-migrations.sh [--dry-run]
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the database connection string}"
dir="$(cd "$(dirname "$0")/../supabase/migrations" && pwd)"
dry_run=false
[[ "${1:-}" == "--dry-run" ]] && dry_run=true

psql_db() { psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

# Read first, so a failed connection stops the script instead of looking empty.
recorded="$(psql_db -At -c "select name from supabase_migrations.schema_migrations")"
declare -A applied=()
while IFS= read -r name; do
  if [[ "$name" =~ ^([0-9]{4})_to_([0-9]{4})_ ]]; then
    for ((n = 10#${BASH_REMATCH[1]}; n <= 10#${BASH_REMATCH[2]}; n++)); do applied[$n]=1; done
  elif [[ "$name" =~ ^([0-9]{4})_ ]]; then
    applied[$((10#${BASH_REMATCH[1]}))]=1
  fi
done <<< "$recorded"

pending=()
for file in "$dir"/[0-9][0-9][0-9][0-9]_*.sql; do
  base="$(basename "$file" .sql)"
  number=$((10#${base:0:4}))
  [[ -z "${applied[$number]:-}" ]] && pending+=("$file")
done

if ((${#pending[@]} == 0)); then
  echo "Hosted database is up to date."
  exit 0
fi

echo "Pending migrations:"
for file in "${pending[@]}"; do echo "  $(basename "$file")"; done
$dry_run && exit 0

for file in "${pending[@]}"; do
  base="$(basename "$file" .sql)"
  version="$(date -u +%Y%m%d%H%M%S)"
  echo "Applying $base as version $version"
  [[ "$base" =~ ^[0-9a-z_]+$ ]] || { echo "Unexpected file name: $base" >&2; exit 1; }
  psql_db --single-transaction -f "$file" \
    -c "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$base')"
  sleep 1 # keeps versions unique when several files apply in one run
done
echo "Done."
