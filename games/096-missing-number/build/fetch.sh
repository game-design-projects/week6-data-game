#!/bin/bash
# Downloads World Bank indicators and USGS daily earthquake catalogue into build/raw/ (cached).
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p raw
UA="daily-data-games/1.0 (class project)"
for i in SP.POP.TOTL NY.GDP.PCAP.CD SP.DYN.LE00.IN SP.URB.TOTL.IN.ZS IT.NET.USER.ZS SL.UEM.TOTL.ZS; do
  [ -s raw/$i.json ] || { curl -s -A "$UA" "https://api.worldbank.org/v2/country/all/indicator/$i?format=json&per_page=20000&date=2010:2023" -o raw/$i.json; sleep 1; }
done
[ -s raw/countries.json ] || curl -s -A "$UA" "https://api.worldbank.org/v2/country?format=json&per_page=400" -o raw/countries.json
# USGS FDSN event API, M2.5+, two chunks (the API caps a response at 20000 events)
for range in "2026-04-15 2026-07-01" "2026-07-01 2026-10-15"; do
  read -r s e <<<"$range"
  [ -s "raw/usgs-$s.csv" ] || { curl -s -A "$UA" "https://earthquake.usgs.gov/fdsnws/event/1/query?format=csv&starttime=$s&endtime=$e&minmagnitude=2.5&orderby=time-asc&limit=20000" -o "raw/usgs-$s.csv"; sleep 2; }
done
