#!/usr/bin/env bash
# Build dist/ for deployment from the committed tree (git archive HEAD): drops build
# scripts, raw data, tests and docs, which the browser never loads.
# Deploy: scripts/dist.sh && npx wrangler deploy
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir dist
git archive HEAD | tar -x -C dist
cd dist
rm -rf tests scripts docs games/*/build wrangler.jsonc .gitignore
find . -name '*.test.mjs' -delete
find . -maxdepth 1 -name '*.md' -delete
echo "dist: $(find . -type f | wc -l | tr -d ' ') files, $(du -sh . | cut -f1)"
