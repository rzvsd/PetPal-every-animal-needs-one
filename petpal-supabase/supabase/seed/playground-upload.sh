#!/usr/bin/env bash
# Uploads the playground photos to the local animal-photos bucket, at the
# paths playground.sql expects. Run after `supabase start`, before playground.sql:
#   SUPABASE_SECRET_KEY=<Secret key from `supabase status`> ./playground-upload.sh
set -euo pipefail
cd "$(dirname "$0")/playground-assets"
url="${SUPABASE_URL:-http://127.0.0.1:54321}"
key="${SUPABASE_SECRET_KEY:?Set SUPABASE_SECRET_KEY to the local Secret key from supabase status}"
me=10000000-0000-4000-8000-000000000003
missy=be2cd5da-50f4-47e8-a782-cc72ec448151
owner() { if [ "$1" = 1 ]; then echo "$me"; else printf '09080001-0000-4000-8000-%012d' $(($1 - 1)); fi; }
upload() {
  curl -fsS -o /dev/null -X POST "$url/storage/v1/object/animal-photos/$2" \
    -H "Authorization: Bearer $key" -H "apikey: $key" -H "Content-Type: image/jpeg" -H "x-upsert: true" \
    --data-binary "@$1"
  echo "uploaded $2"
}
pets=(buddy daisy rex nori finn cleo hugo olive theo poppy); pet_owners=(1 2 3 4 5 6 7 8 9 8)
for i in $(seq 1 10); do
  upload "${pets[$((i-1))]}.jpg" "$(owner "${pet_owners[$((i-1))]}")/$(printf '09080002-0000-4000-8000-%012d' "$i")/playground.jpg"
done
home_owners=(1 2 4 3 6 9)
for i in $(seq 1 6); do
  upload "home-$i.jpg" "$(owner "${home_owners[$((i-1))]}")/$(printf '09080003-0000-4000-8000-%012d' "$i")/playground.jpg"
done
upload poppy.jpg "$me/$missy/playground.jpg"
