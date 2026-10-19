# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] - 2026-10-19

### Added

- Everyone's results: after a round you see where you placed among everyone who finished that painting, plus a strip of every player's best color, closest first.
- Leaderboard (trophy button, or the button on the result card): today's top 10 and all-time totals, with your own rank, and an optional display name.
- `worker/`: the score server, a Cloudflare Worker with a D1 table. It re-scores every round from the tested colors using the game's own levels and rules, keeps the first round per player per day, and never sends device ids back. If it can't be reached, the game still plays without these features.

### Changed

- Bigger color picker: the wheel is 250 px instead of 196 px on desktop and larger on phones, with a thinner ring and a bigger saturation/brightness square.

## [1.0.0] - 2026-10-19

The game is now **Restoration**. The previous game (Paint by Words) is kept on the `archive/paint-by-words` branch.

### Added

- Each day is a public-domain painting from the Art Institute of Chicago with one region's color taken out. The player repaints it with the color picker and sees the result live in the painting. After the round you can switch between your version and the original.
- `scripts/build_paintings.py`: automated levels. It fetches the museum's highlighted public-domain paintings and segments each one (SLIC superpixels merged by color, weighting hue over lightness). It then picks a region that stands out from its surroundings, takes the region's mean OKLab color as the answer, and stores the region as neutral gray plus per-pixel offsets so the game can repaint it while keeping the shading. It also writes a contact sheet for review.
- `web/painting.js`: decodes and repaints the region.
- The result shows the painting's credit and a link to it on the museum's site, plus the answer's xkcd survey name.

### Changed

- Score is the best match minus 3 for each extra test. There are no clues.
- `color.js` does the OKLab math itself, the same way the builder does.
- Saves use a new storage key, so stats from Paint by Words don't mix with the new game.

### Removed

- AI-written clues, the LLM level builder and the clue experiment, and `spectral.js` paint mixing.

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
