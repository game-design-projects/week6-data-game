#!/bin/sh
# One row per restaurant (CAMIS) from DOHMH Restaurant Inspection Results (Socrata 43nn-pn8j)
set -eu
cd "$(dirname "$0")"; mkdir -p raw
[ -s raw/camis.json ] || curl -sG -A "daily-data-games class project" 'https://data.cityofnewyork.us/resource/43nn-pn8j.json' \
 --data-urlencode '$select=camis,max(zipcode) as zip,max(cuisine_description) as cuisine,max(latitude) as lat,max(longitude) as lng,max(boro) as boro' \
 --data-urlencode '$group=camis' --data-urlencode '$limit=50000' -o raw/camis.json
