#!/bin/sh
set -eu
mkdir -p "$(dirname "$0")/raw"; cd "$(dirname "$0")/raw"
[ -f cities15000.txt ] || { curl -sSL -A "daily-data-games class project" -o cities15000.zip https://download.geonames.org/export/dump/cities15000.zip; unzip -o -q cities15000.zip; }
