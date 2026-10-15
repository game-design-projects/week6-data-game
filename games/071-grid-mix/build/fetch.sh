#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p raw
for f in 2025_Jul_Dec 2026_Jan_Jun 2026_Jul_Dec; do
  [ -s raw/EIA930_BALANCE_$f.csv ] || { curl -fsS -A "Mozilla/5.0 daily-data-games" -o raw/EIA930_BALANCE_$f.csv "https://www.eia.gov/electricity/gridmonitor/sixMonthFiles/EIA930_BALANCE_$f.csv"; sleep 2; }
done
