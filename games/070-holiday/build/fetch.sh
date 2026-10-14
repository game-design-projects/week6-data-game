#!/usr/bin/env bash
# Downloads raw holiday lists from Nager.Date into build/raw/ (cached; delete a file to refetch).
set -euo pipefail
cd "$(dirname "$0")"
YEAR="${1:-2026}"
mkdir -p raw/holidays
[ -s raw/countries.json ] || curl -sS https://date.nager.at/api/v3/AvailableCountries -o raw/countries.json
for cc in $(/usr/bin/python3 -I -c "import json;print(' '.join(c['countryCode'] for c in json.load(open('raw/countries.json'))))"); do
  f="raw/holidays/${YEAR}-${cc}.json"
  [ -s "$f" ] && continue
  curl -sS --fail "https://date.nager.at/api/v3/PublicHolidays/${YEAR}/${cc}" -o "$f" || { echo "skip $cc" >&2; rm -f "$f"; }
  sleep 0.15
done
ls raw/holidays | wc -l
