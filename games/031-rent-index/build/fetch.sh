#!/bin/sh
# HUD blocks plain curl (HTTP 202, empty); a browser User-Agent + referer works.
set -eu
cd "$(dirname "$0")"; mkdir -p raw
[ -s raw/FY26_FMRs_revised.xlsx ] || curl -sL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36" -e https://www.huduser.gov/portal/datasets/fmr.html -o raw/FY26_FMRs_revised.xlsx https://www.huduser.gov/portal/datasets/fmr/fmr2026/FY26_FMRs_revised.xlsx
