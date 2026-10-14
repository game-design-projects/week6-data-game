#!/bin/sh
set -eu
cd "$(dirname "$0")"; mkdir -p raw
[ -f raw/tus_00age.tsv ] || curl -sSL -A "daily-data-class student project" -o raw/tus_00age.tsv "https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/tus_00age?format=TSV"
