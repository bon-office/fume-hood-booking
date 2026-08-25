#!/usr/bin/env bash
#
# Point the app at a Supabase project and check the connection.
#
#   ./scripts/connect-supabase.sh <project-url> <anon-key>
#
# Run this after creating the project and running supabase/schema.sql in the
# Supabase SQL editor. It writes both values into config.js, then verifies the
# bookings table is readable and writable with that key.

set -euo pipefail

if [ $# -ne 2 ]; then
  sed -n '3,9p' "$0" | sed 's/^# \{0,1\}//'
  exit 64
fi

URL="${1%/}"
KEY="$2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ Checking $URL …"

read_status=$(curl -s -o /tmp/fh-read.json -w '%{http_code}' \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  "$URL/rest/v1/bookings?select=id&limit=1")

if [ "$read_status" != "200" ]; then
  echo "✗ Could not read the bookings table (HTTP $read_status):"
  cat /tmp/fh-read.json; echo
  echo "  If this says the relation does not exist, run supabase/schema.sql"
  echo "  in the Supabase SQL editor first."
  exit 1
fi
echo "✓ Table readable"

# Write a throwaway row far in the past, then delete it, to prove insert and
# delete policies are in place. 1970 can never collide with a real booking.
probe='[{"date":"1970-01-01","hour":0,"name":"connection test"}]'
write_status=$(curl -s -o /tmp/fh-write.json -w '%{http_code}' -X POST \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "$probe" "$URL/rest/v1/bookings")

if [ "$write_status" != "201" ]; then
  echo "✗ Could not write a test booking (HTTP $write_status):"
  cat /tmp/fh-write.json; echo
  echo "  Check the insert policy in supabase/schema.sql."
  exit 1
fi
echo "✓ Table writable"

del_status=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  "$URL/rest/v1/bookings?date=eq.1970-01-01")

if [ "$del_status" != "204" ]; then
  echo "✗ Could not delete the test booking (HTTP $del_status)."
  echo "  Check the delete policy, and remove the 1970-01-01 row by hand."
  exit 1
fi
echo "✓ Table deletable, test row cleaned up"

python3 - "$ROOT/config.js" "$URL" "$KEY" <<'PY'
import pathlib, re, sys
path, url, key = sys.argv[1], sys.argv[2], sys.argv[3]
p = pathlib.Path(path)
s = p.read_text()
s = re.sub(r"(\n    url: )'[^']*'", lambda m: m.group(1) + repr(url).replace('"', "'"), s, count=1)
s = re.sub(r"(\n    anonKey: )'[^']*'", lambda m: m.group(1) + repr(key).replace('"', "'"), s, count=1)
p.write_text(s)
print("✓ config.js updated")
PY

echo
echo "Shared mode is on. Commit and push to publish it:"
echo "  git add config.js && git commit -m 'Point at Supabase project' && git push"
