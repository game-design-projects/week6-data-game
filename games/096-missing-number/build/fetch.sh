#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p raw
UA="daily-data-games/1.0 (class project)"
for i in SP.POP.TOTL NY.GDP.PCAP.CD SP.DYN.LE00.IN SP.URB.TOTL.IN.ZS IT.NET.USER.ZS SL.UEM.TOTL.ZS; do
  [ -s raw/$i.json ] || { curl -s -A "$UA" "https://api.worldbank.org/v2/country/all/indicator/$i?format=json&per_page=20000&date=2010:2023" -o raw/$i.json; sleep 1; }
done
[ -s raw/countries.json ] || curl -s -A "$UA" "https://api.worldbank.org/v2/country?format=json&per_page=400" -o raw/countries.json
