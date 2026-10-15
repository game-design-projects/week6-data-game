# Daily Data

![](./docs/gallery.png)

Small games that make a new puzzle every day from public data (NYU Lecture 6 · daily data game assignment). The idea list is the Claude Docs document "Daily data games: 100 ideas".

- The front page `index.html` lists every game; each game is `play.html?g=<folder>`.
- No build step, plain ES modules. Run locally:

```bash
node scripts/serve.mjs 8787      # → http://localhost:8787/
```

Live at <https://daily-data.lishuyustevenli.workers.dev/> (Cloudflare Workers static assets). Deploy:

```bash
scripts/dist.sh && npx wrangler deploy   # dist/ is built from committed files, without build/, tests or docs
```

## Layout

```
engine/           shared engine and design system (author guide: engine/README.md)
  ds.css          design tokens and component styles
  core.js         pure functions: dates, seeded randomness, scoring, formatting (runs in Node)
  dom.js          hyperscript and components
  presets.js      eight game loops: guess / estimate / pin / rounds / order / match / groups / canvas
  libs.js         lazily loaded Observable Plot, Leaflet, d3 and map boundaries
  shell.js        game page shell: loading, daily seed, saved results, sharing, stats
  gallery.js      front page
games/NNN-slug/   one folder per game: game.js, data.json, build/ data scripts, optional game.test.mjs
scripts/          serve.mjs, check.mjs (validation + headless browser smoke test + screenshots), registry.mjs (writes games/index.json)
tests/            engine tests (core unit tests, preset tests in headless Chrome, English-only check)
```

## Tests

```bash
node --test tests/*.test.mjs            # engine, plus "no Chinese text in any shipped file"
node scripts/check.mjs --all            # every game: meta, data, puzzle() determinism, its own tests, browser smoke test
node scripts/check.mjs 001-daylight --shot   # one game, screenshots in .shots/ (start and result, desktop and phone)
node scripts/check.mjs 001-daylight --shot --dark --date=2026-10-04   # dark theme, a past day
node scripts/registry.mjs               # refresh the front-page list
```

`puzzle()` builds each day's puzzle deterministically from the date: everyone gets the same puzzle on the same day, and each pool runs through a seeded permutation before anything repeats. 2026-10-01 is puzzle №1.

13 games fetch live data in the browser (earthquakes, weather, air quality, tides, satellite orbits, Wikipedia pageviews, Hacker News, certificate logs, radar…). The data is anchored to yesterday, or to an earlier day when the source needs time to settle, so everyone sees the same data all day; when an API is unreachable the game falls back to its `data.json` snapshot. The other games use real data snapshots fetched at build time; the fetch and processing scripts live in each game's `build/` folder.
