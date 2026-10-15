#!/bin/sh
set -eu
# 1) GeoNames cities15000 (coordinates, population)  2) Wikidata zh labels for every GeoNames id with pop >= 1M
mkdir -p "$(dirname "$0")/raw"; cd "$(dirname "$0")/raw"
UA="daily-data-games class project"
[ -f cities15000.txt ] || { curl -sSL -A "$UA" -o cities15000.zip https://download.geonames.org/export/dump/cities15000.zip; unzip -o -q cities15000.zip; }
if [ ! -f wd-zh.json ]; then
  ids=$(awk -F'\t' '$15>=1000000{printf "\"%s\" ", $1}' cities15000.txt)
  q="SELECT ?g ?l ?c ?z WHERE { VALUES ?g { $ids } ?i wdt:P1566 ?g . OPTIONAL { ?i rdfs:label ?l FILTER(LANG(?l)=\"zh-hans\") } OPTIONAL { ?i rdfs:label ?c FILTER(LANG(?c)=\"zh-cn\") } OPTIONAL { ?i rdfs:label ?z FILTER(LANG(?z)=\"zh\") } }"
  printf '%s' "$q" > q.rq
  curl -sS -A "$UA" -H 'Accept: application/sparql-results+json' --data-urlencode query@q.rq https://query.wikidata.org/sparql -o wd-zh.json
fi
