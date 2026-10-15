#!/bin/sh
# download UN WPP 2024 abridged life table (both sexes+each sex, 1950-2100), cached in build/raw/
set -eu
cd "$(dirname "$0")"
mkdir -p raw
[ -s raw/abr.csv.gz ] || curl -fsSL -A 'daily-data-games/069 (class project)' -o raw/abr.csv.gz \
  'https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_Life_Table_Abridged_Medium_1950-2023.csv.gz'
ls -l raw/abr.csv.gz
