# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Placeholder page in `web/` while the new game (my teammate's idea) is being designed.
- GitHub Actions workflow `itch.yml`: validates the HTML5 bundle on every PR and push, and publishes `web/` to itch.io (`stevenli-phoenix-work/week6-data-game:html5`) on every push to `main`, with the commit SHA as the build version. `BUTLER_API_KEY` is a repo-level secret, since org secrets don't reach private repos on the free plan.
- `scripts/check-html5.mjs` and its tests: checks itch.io HTML5 limits before upload.

### Removed

- The Daily Data prototype (engine, 100 games, Cloudflare Worker, tests). It is kept intact on the `archive/daily-data` branch, at commit `c0221e4`.
