#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p raw
for y in 2015 2016 2017; do
  [ -s raw/r$y.csv ] || gh api "repos/nispano/Data-Analysis-of-the-Boston-Marathon-Results-2015-2017/contents/marathon_results_$y.csv" -H "Accept: application/vnd.github.raw" > raw/r$y.csv
done
