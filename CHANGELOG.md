# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] - 2026-10-19

### Changed

- The paint pot is now a color picker: a hue ring around a saturation/brightness square, with arrow-key control. Playtesters found it unfair that tested paint stayed in the pot, since one bad mix could leave a round unrecoverable. Now every test starts from wherever you put the picker; a color already tested can't be tested again.
- The result shows your best pick and the answer in RGB with the per-channel miss, instead of the fewest-drops paint recipe.
- Saved games from 0.1.0 still load: their tests carry over and the last one becomes the current pick.

### Removed

- Paint tubes, drops, undo and the W K C M Y keys.

## [0.1.0] - 2026-10-17

### Added

- **Paint by Words**, the Week 6 daily data game: an AI describes a secret vivid color, the player mixes it from five paints (white, black, cyan, magenta, yellow) drop by drop. Up to 6 tests, each giving a match % and which way to go on lightness, red–green and yellow–blue; tested paint can't be taken back; score = best match − 3 per extra test − 5 per extra clue.
- Real pigment mixing (Kubelka–Munk, vendored `spectral.js` 3.0.0 as an ES module); distance and score in OKLab.
- Daily colors from the xkcd Color Survey (`data/xkcd-rgb.txt`, CC0), filtered to vivid colors the paints can reach; every level ships with its par recipe and best possible match.
- `scripts/build-levels.mjs`: automated level generation. Picks colors with a seeded, hue-interleaved order, asks an LLM for a three-step clue ladder, rejects clues that break the rules or that a second model can't decode, writes `web/levels.js`. LLM replies are cached on disk.
- `experiments/llm-hints/`: experiment measuring how well LLM-written descriptions let a reader recover a color, across clue styles and models.
- Archive of past days, stats with streak and score histogram, share text with an emoji grid, synthesized sound, keyboard controls, light and dark themes, layout that fits the 960×600 itch.io embed and phones.
- Unit tests for color math, game rules and the level file; CI runs them before publishing.

### Changed

- CI runs every test file instead of only the bundle checker.

## [Unreleased before 0.1.0]

### Added

- GitHub Actions workflow `itch.yml`: validates the HTML5 bundle on every PR and push, and publishes `web/` to itch.io (`stevenli-phoenix-work/week6-data-game:html5`) on every push to `main`, with the commit SHA as the build version. `BUTLER_API_KEY` comes from the org-level secret.
- `scripts/check-html5.mjs` and its tests: checks itch.io HTML5 limits before upload.

### Changed

- The repository is now public.

### Removed

- The Daily Data prototype (engine, 100 games, Cloudflare Worker, tests). It is kept intact on the `archive/daily-data` branch, at commit `c0221e4`.
