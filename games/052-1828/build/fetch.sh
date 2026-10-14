#!/bin/sh
set -eu
cd "$(dirname "$0")"; mkdir -p raw
[ -f raw/webster1828.csv ] || curl -sL -A "daily-data-games/1.0" -o raw/webster1828.csv https://raw.githubusercontent.com/akaitsurugi/webster1828/master/webster1828.csv
[ -f raw/freq.txt ] || curl -sL -A "daily-data-games/1.0" -o raw/freq.txt https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt
