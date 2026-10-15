#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
curl -sf -A "daily-data-games class project" -o fixture.json "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=json"
