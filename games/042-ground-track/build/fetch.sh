#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p raw
for g in stations gps-ops glo-ops galileo beidou starlink geo weather resource science; do
  [ -s raw/$g.json ] || { curl -sf -A "daily-data-games class project" -o raw/$g.json "https://celestrak.org/NORAD/elements/gp.php?GROUP=$g&FORMAT=json"; sleep 2; }
done
[ -s raw/molniya.json ] || curl -sf -A "daily-data-games class project" -o raw/molniya.json "https://celestrak.org/NORAD/elements/gp.php?NAME=MOLNIYA&FORMAT=json"
