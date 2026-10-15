#!/bin/sh
# Downloads BLS American Time Use Survey flat files (download.bls.gov wants a contact in the User-Agent).
set -eu
cd "$(dirname "$0")"; mkdir -p raw/bls; cd raw/bls
UA="daily-data-class student project lishuyustevenli@gmail.com"
for f in tu.series tu.actcode tu.sex tu.age tu.stattype tu.data.0.Current; do
  [ -s "$f" ] || { curl -sSL -A "$UA" -o "$f" "https://download.bls.gov/pub/time.series/tu/$f"; sleep 2; }
done
