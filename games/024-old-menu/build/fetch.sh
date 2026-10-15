#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/raw"
[ -f data.tgz ] || curl -sL -A "daily-data-game/1.0" -o data.tgz "https://s3.amazonaws.com/menusdata.nypl.org/gzips/2023_03_16_07_02_35_data.tgz"
[ -f Dish.csv ] || tar xzf data.tgz
[ -f cpi.csv ] || curl -sL -A "daily-data-game/1.0" -o cpi.csv "https://raw.githubusercontent.com/datasets/cpi-us/main/data/cpiai.csv"
ls -la
