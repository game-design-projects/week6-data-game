#!/bin/sh
set -eu
cd "$(dirname "$0")"; mkdir -p raw/x
[ -f raw/subway.zip ] || curl -sL -A "daily-data-games class project" -o raw/subway.zip https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip
unzip -oq raw/subway.zip -d raw/x
node build.mjs
