#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p raw
[ -s raw/hts.json ] || curl -sL -A "daily-data-games class project" "https://hts.usitc.gov/reststop/exportList?from=0101&to=9999&format=JSON&styles=false" -o raw/hts.json
