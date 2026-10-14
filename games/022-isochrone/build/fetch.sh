#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p raw/x
[ -f raw/gtfs.zip ] || curl -sL -A "daily-data-games class project" -o raw/gtfs.zip http://web.mta.info/developers/data/nyct/subway/google_transit.zip
[ -f raw/x/stop_times.txt ] || unzip -oq raw/gtfs.zip -d raw/x
