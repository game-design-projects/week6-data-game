#!/bin/sh
# Downloads raw CSVs (public GitHub "datasets" mirrors of NOAA / Fed / Shiller / Gold / Brent data) into build/raw/
set -eu
cd "$(dirname "$0")"; mkdir -p raw; B=https://raw.githubusercontent.com/datasets
for f in oil-prices/main/data/brent-monthly.csv oil-prices/main/data/wti-monthly.csv s-and-p-500/main/data/data.csv cpi-us/main/data/cpiai.csv gold-prices/main/data/monthly.csv co2-ppm/main/data/co2-mm-mlo.csv global-temp/main/data/monthly.csv natural-gas/main/data/monthly.csv exchange-rates/main/data/daily.csv bond-yields-us-10y/main/data/monthly.csv; do
  n=$(echo $f | tr '/' '_'); [ -s raw/$n ] || { curl -sS -A "daily-data-games class project" -o raw/$n "$B/$f"; sleep 1; }
done
