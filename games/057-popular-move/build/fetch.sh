#!/bin/bash
# Downloads the raw dumps into build/raw/ (cached) and counts next-move frequencies per position and rating band.
# Run from build/.  Needs zstd + unzip.  Elite DB: Dec 2021 and Jan 2022 (2500+ vs 2300+ games, no bullet).
set -euo pipefail
mkdir -p raw; cd raw
UA="week6-057-popular-move (class project)"
get() { [ -s "$(basename "$1")" ] || { curl -sf -A "$UA" -O "$1"; sleep 2; }; }
get https://database.lichess.org/standard/lichess_db_standard_rated_2014-01.pgn.zst
get https://database.nikonoel.fr/lichess_elite_2021-12.zip
get https://database.nikonoel.fr/lichess_elite_2022-01.zip
for f in a b c d e; do [ -s $f.tsv ] || { curl -sf -A "$UA" -O https://raw.githubusercontent.com/lichess-org/chess-openings/master/$f.tsv; }; done
cd ..
# a move counts for the player who made it: 1500 band = mover 1400-1600 (opponent 1250-1750); 2500 band = mover >= 2500
[ -s raw/057-low.json ] || zstd -dc raw/lichess_db_standard_rated_2014-01.pgn.zst | node count.mjs 1400 1600 1250 1750 raw/057-low.json 2> raw/057-low.log
[ -s raw/057-high.json ] || ( unzip -p raw/lichess_elite_2021-12.zip; unzip -p raw/lichess_elite_2022-01.zip ) | node count.mjs 2500 4000 2300 4000 raw/057-high.json 2> raw/057-high.log
node build.mjs
