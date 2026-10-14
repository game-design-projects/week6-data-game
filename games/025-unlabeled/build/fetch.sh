#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/raw"
for id in USREC UNRATE CPIAUCSL FEDFUNDS GS10 INDPRO PAYEMS HOUST UMCSENT M2SL DEXJPUS GDPC1 TOTALSA MORTGAGE30US CIVPART PSAVERT; do
  [ -s $id.csv ] && continue
  curl -sf -m 60 --retry 3 "https://fred.stlouisfed.org/graph/fredgraph.csv?id=$id" -o $id.csv || echo "FAIL $id"
  sleep 1
done
wc -l *.csv
