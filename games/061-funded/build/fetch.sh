#!/bin/sh
# Downloads the Webrobots Kickstarter CSV dump (2026-10-12) into build/raw/ and unzips it.
set -eu
cd "$(dirname "$0")"; mkdir -p raw/x
[ -f raw/ks.zip ] || curl -s -A "daily-data-games class project" -o raw/ks.zip "https://s3.amazonaws.com/weruns/forfun/Kickstarter/Kickstarter_2026-10-12T07_08_07_724Z.zip"
unzip -q -o raw/ks.zip -d raw/x
