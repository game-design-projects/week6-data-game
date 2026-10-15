# Daily Data engine — guide for game authors

Every game is **one folder** `games/NNN-slug/` with a `game.js` that exports a plain object.
The engine supplies the page shell, the look, daily seeding, persistence, sharing,
stats, and eight ready-made game loops ("presets"). A typical game is ~60–150 lines.

**Read these first:** `games/001-daylight/game.js` (pin + chart + computed data),
`games/070-holiday/game.js` (guess + clues + feedback cells + snapshot data),
`games/000-presets-demo/game.js` (every preset in one place).

```
games/NNN-slug/
  game.js          required — export default { meta, puzzle, play, load? }
  data.json        snapshot data the puzzle draws from (≤ 1.5 MB, hard limit 3 MB)
  build/           scripts that (re)generate data.json from the real source
    fetch.sh|.mjs  downloads into build/raw/ (git-ignored, cached)
    build.mjs      raw → data.json
  game.test.mjs    optional node:test file for custom logic (scoring, parsing…)
  *.json / *.svg   optional extra assets, loaded in play() via ctx.asset('x.json')
```

Never edit `engine/`, `scripts/`, other games, `games/index.json`, or anything in git.
If the engine is missing something, work around it inside your folder and report it.

## The module

```js
import { haversineKm, fmtKm } from '../../engine/core.js'; // pure helpers only (optional)

export default {
  meta: {
    num: 47,                         // idea number = folder prefix
    slug: 'spike',                   // = folder name without the number
    title: 'Spike',                  // English title from the idea list
    tagline: 'One English sentence that says what you play.',
    category: 'words',               // geo|nyc|money|science|words|culture|society|tech|transit|levels|literacy|model
    data: 'snapshot',                // live|snapshot|computed|synthetic  (badge on the page)
    howTo: ['Step one…', 'Step two…', 'How it scores…'],   // ≥ 2 short English steps
    scoring: 'One sentence on the scoring formula.',   // optional
    sources: [{ name: 'Wikimedia Pageviews API', url: 'https://…', note: 'optional note' }],
    dataNote: 'Optional: data limits or substitute sources',  // shown in the ⓘ dialog
    wide: false,                     // true → 1080px column for big charts/maps
  },

  // PURE + DETERMINISTIC. Runs in Node tests and the browser. No DOM, no fetch,
  // no Date.now/Math.random. Same inputs → same output. Return JSON-serializable.
  puzzle({ data, day, date, slug, rng, pick }) {
    const item = pick(data.items);   // pick(): today's item — a seeded permutation over DAYS (no repeats across days until
                                     // the pool is used up). Calling it twice in one puzzle() returns the same item;
                                     // use rng.sample()/rng.shuffle() to draw several distinct items.
    return { item, decoys: rng.sample(data.items.filter((x) => x !== item), 3) };
  },

  // Optional, browser only: fetch live data (must be CORS-enabled). Return the
  // same shape as data.json, or throw → the engine falls back to data.json.
  async load(ctx) { … },

  // UI. Render into ctx.stage, await presets, return a result.
  async play(ctx, puzzle) {
    ctx.stage.append(ctx.ui.panel({ kicker: 'Clue', title: "Today's curve" }, await ctx.ui.plot(…)));
    const r = await ctx.guess({ … });
    r.detail = ctx.ui.kv([['Answer', …], ['Why', …]]);   // shown in the result card: teach something
    return r;
  },

  // autoplay: false,   // only if play() cannot support ?autoplay=1 (see Testing)
};
```

**Result object** (what `play` returns): `{ score, max, emoji?, summary?, detail?, win? }`.
Presets return this shape already. Compose stages with `ctx.combine([r1, r2])` — it **sums raw** `score`/`max`
(rounds have max = #questions, most others 100), so rescale stages first if you want equal weights.
`emoji` is the shareable grid (may contain `\n`), `summary` a short line like `1,234 km`,
`detail` a node/string explaining the answer (the "Learnable" part — always include it).

## ctx

| field | what |
|---|---|
| `ctx.date` / `ctx.day` / `ctx.today` | `'2026-10-14'`, puzzle number (2026-10-01 = №1), today's date |
| `ctx.data` | parsed `data.json` (or `load()`'s result) |
| `ctx.rng` | seeded RNG for UI shuffles (`int(a,b)`, `float`, `pick`, `shuffle`, `sample`, `chance`, `normal`) |
| `ctx.pick(arr)` | same daily pick as in `puzzle()` |
| `ctx.stage` | the `<main>` column — append panels here |
| `ctx.asset(path)` | URL of a file in your folder |
| `ctx.fetchJSON(url, {timeout})` / `ctx.fetchText` | fetch with timeout (+ session cache for JSON) |
| `ctx.log(…)`, `ctx.log.warn`, `ctx.log.error`, `ctx.log.scope('x')` | logging (visible with `?debug=1`, collected by checks). Log key steps. |
| `ctx.autoplay` / `ctx.practice` / `ctx.smoke` | test & practice flags |
| `ctx.sleep(ms)` | promise delay |
| `ctx.core` | everything in `engine/core.js` |
| `ctx.ui` | components below |
| `ctx.guess / estimate / pin / rounds / order / match / groups / canvas` | presets below |

## Presets

All accept `title`, `prompt` (string or node shown under the title) and `container`
(defaults to `ctx.stage`). All support `?autoplay=1` automatically.

### `ctx.guess({...})` — name the thing (Worldle / Wordle-style rows)
```js
await ctx.guess({
  options: [{ id, label, hint?, aliases?: [] }],  // the autocomplete list (player must pick from it)
  answer: id,
  maxGuesses: 6,
  clues: [node|string|fn, …],      // clue 1 shown at start; one more unlocks per wrong guess
  cluesTitle: 'Clues',
  columns: ['Distance', 'Direction'],        // headers for feedback cells
  feedback: (guessOpt, answerOpt) => [{ text, state: 'hit'|'near'|'miss'|'bad'|undefined, num: true }],
  near: (guessOpt, answerOpt) => bool,   // marks the guess tile yellow
  onGuess: (opt, { correct, n }) => {},  // hook, e.g. reveal extra info
  scoring: (n, won) => number,           // default: won ? 100·(max−n+1)/max : 0
})  // → { score, max: 100, win, emoji, summary, answer }
```

### `ctx.estimate({...})` — guess a number (slider + typed input)
```js
await ctx.estimate({
  answer: 3.21, min: 0.1, max: 100, log: true,   // log: true for values spanning orders of magnitude
  step: 0.01, initial, unit: '$', format: (v) => ctx.core.fmtMoney(v),   // unit is appended unless format() already ends with it
  attempts: 1,                    // > 1 adds ↑/↓ hints after each try (−10% per extra try)
  scoring: 'pct' | 'log' | 'abs' | ((guess, answer) => 0..1),
  scale,                          // pct: 0.35 → 35% off ≈ 37 pts; log: 0.3 → 2× off ≈ 37 pts; abs: units
  tolerance,                      // counts as "hit" (ends multi-attempt early)
})  // → { score, max: 100, emoji, summary, guess }
```
For several numbers (fare *and* duration) call it twice and `ctx.combine` the results.

### `ctx.pin({...})` — drop a pin on a map, scored by km
```js
await ctx.pin({
  answer: { lat, lng, label },
  view: { center: [40.73, -73.95], zoom: 11 } | { bounds: [[s, w], [n, e]] },
  basemap: 'gray' | 'imagery' | 'topo' | 'hillshade',   // label-free 'gray' by default
  scale: 1500,                   // km: 0 → 100 pts, scale → 37 pts. NYC-scale games use ~2–3
  attempts: 1, hint: (km, bearing) => '…',            // multi-attempt hot/cold: −15% per extra try (floor 40%), ends early within scale×2%
  setup: async ({ map, L, pin }) => {},              // draw clue overlays before guessing (tracks, polygons…)
  reveal: async ({ map, L, pin }, guess) => {},      // extra drawing after the answer is shown
})  // → { score, max: 100, km, guess, map, emoji, summary }
```

### `ctx.rounds({...})` — multiple choice / higher-lower / pick the real one
```js
await ctx.rounds({
  rounds: [{ prompt, body?, options: [{ label, sub?, body? }], correct: 1 | [0, 2], explain? }],
  multi: false,        // true → select several then submit (Jaccard partial credit)
  minWidth: 150,       // option card min width
})  // → { score: #correct, max: rounds.length, emoji, summary }
```

### `ctx.order({...})` — rank items by a hidden value (drag or ↑↓)
```js
await ctx.order({ items: [{ id, label, sub?, value }], direction: 'desc', attempts: 3, format })
```

### `ctx.match({...})` — pair each item (often a mini chart) with a label
```js
await ctx.match({ left: [{ id, body: node, label? }], right: [{ id, label }], answer: { leftId: rightId }, attempts: 3 })
```

### `ctx.groups({...})` — Connections-style 4×4
```js
await ctx.groups({ groups: [{ label, items: [a, b, c, d] }, …×4], mistakes: 4 })
```

### `ctx.canvas({...})` — action games / custom interaction
```js
const s = ctx.canvas({
  aspect: 16 / 9,
  onFrame(dt, g, s) { /* g = 2D context in CSS px; s.w, s.h, s.t, s.colors, s.hud (overlay div) */ },
  onPointer(type /* down|move|up */, { x, y }, s) {},
  onKey(type /* down|up */, event, s) {},
});
s.start(); /* … */ s.stop();
```
Wrap it in a `new Promise(resolve => …)` that resolves with a result when the run ends.
With `ctx.autoplay`, resolve within a second (e.g. simulate a bot run or return a fixed score).

## ctx.ui components

`h(tag, props, ...children)` (hyperscript: `class`, `style` object incl. `--vars`, `onClick`…) ·
`panel({ kicker, title, aside, plain, flush }, ...children)` · `row(...children)` · `stack(...children)` (no props arg — use `h('div', {class: 'ds-row'})`) · `grid(minPx, ...)` ·
`stat({ label, value, sub, big })` · `kv([[k, v], …])` · `table({ columns: [{ key, label, num, fmt: (v, row) => … }], rows })` ·
`chips(items, { onClick, active })` · `badge(text, tone)` · `button(label, { variant: 'accent'|'ghost', small, onClick })` ·
`tile(text, { state, num, lead })` · `pips(total, used)` · `quote(text)` · `code(text)` · `callout(text, 'good'|'warn'|'bad')` ·
`redact(text)` (black bar) · `toast(msg)` · `modal({ title, body })` · `shake(el)` · `colors()` (theme colors for charts/canvas:
`ink, ink2, muted, rule, paper, paper2, card, accent, hit, near, miss, bad, series[]`).

**Charts** — `await ctx.ui.plot((Plot, c) => ({ marks: [...], x: {...}, y: {...} }), { height: 280, width?, axis: true })`
uses [Observable Plot](https://observablehq.com/plot/) (lazy-loaded) with theme defaults. Use `c.accent`, `c.ink`,
`c.series[i]` for colors. `axis: false` hides axes (for "unlabeled chart" puzzles). Pass `width` for charts inside
small cards. Line/area/bar/cell(heatmap)/dot/rule/text/tip marks cover almost everything.

**Maps** — fractional zoom (`zoomSnap: 0.25`), so `fitBounds` fills tall phone frames. `await ctx.ui.createMap({ center, zoom, bounds, basemap, height })` → `{ el, map, L, pin, setLabels }`
(Leaflet; append `el` right away). `await ctx.ui.geo('countries' | 'countries50' | 'land' | 'states' | 'counties')`
returns GeoJSON (world-atlas / us-atlas) for drawing shapes with Plot (`Plot.geo`) or Leaflet.

**Other libraries** — `await ctx.ui.lib('d3' | 'plot' | 'topojson' | 'leaflet')`. For anything else, dynamic
`import('https://cdn.jsdelivr.net/npm/<pkg>@<ver>/+esm')` inside `play()` (never at module top level — the
module must import cleanly in Node).

## Look & copy

- No stylesheets per game. Use panels, presets and `ds-*` classes; inline `style` only with tokens
  (`var(--accent)`, `var(--muted)`, `var(--font-mono)`…). The category sets the accent color.
- UI copy in **English** (US spelling), short and friendly. No Chinese anywhere in shipped files —
  `node --test tests/english.test.mjs` checks every page, engine file and game file outside `build/`.
  Names that are the puzzle itself in another script (a holiday's local name, a word in its own language)
  are the only exception; they go in the test's `ALLOW` list with a reason.
- Numbers: `ctx.core.fmtNum`, `fmtCompact`, `fmtMoney`, `fmtPct`, `fmtKm` (monospaced by `.mono`/`.num`).
- Always teach in `detail`: what the answer was and which pattern in the data gave it away.
- Mobile first: everything must work at 390 px wide, by touch.

## Data rules

1. **Real data, honestly labelled.** Fetch it from the named source (or another public source of the same
   facts, e.g. a GitHub CSV mirror, Wikipedia/Wikidata, a government open-data portal). Record exact URLs in
   `meta.sources`. Never invent numbers and present them as real.
2. Save raw downloads to `build/raw/` **before** parsing (cached; re-runs parse from disk). Commit the scripts,
   not the raw files.
3. `data.json` holds a **pool of puzzles** (aim for ≥ 60; minimum 14 distinct days) or the material to generate
   them. Keep it small: pre-aggregate, round numbers, drop unused fields.
4. If a source needs an API key or blocks scripted access, use an alternative public source. Only if nothing
   real is reachable, generate data with a documented model, set `meta.data: 'synthetic'` and explain in `dataNote`.
5. `meta.data: 'live'` only if `load()` really fetches today's data from a CORS-enabled endpoint, anchored to
   the date (e.g. yesterday's values) so every player gets the same puzzle. Keep a snapshot fallback in data.json.
   Check CORS first: `curl -sI -H 'Origin: http://localhost' '<url>' | grep -i access-control-allow-origin`.
   Pick a lag at which the source is final for everyone all day (USGS: yesterday UTC; Wikimedia pageviews:
   2 days; HN: yesterday). A forecast that changes during the day is acceptable only if the *choice* of
   puzzle (cities, items) stays deterministic. Recipe:
   ```js
   meta: { data: 'live', … },
   async load(ctx) {                                   // ctx.data is the snapshot here
     const day = ctx.core.addDays(ctx.date, -1);      // anchor to the puzzle date, not "now"
     const raw = await ctx.fetchJSON(`https://…&date=${day}`, { timeout: 8000 });
     return { ...ctx.data, live: toPuzzle(raw, day) }; // throw / return null → snapshot is used
   },
   puzzle({ data, pick }) { return data.live ?? pick(data.puzzles); },
   ```
   Export `toPuzzle` and test it in `game.test.mjs` against a small committed fixture (e.g. `build/fixture.json`).
6. Games that "need an LLM" have no runtime model: generate the text/descriptions/groupings **offline at build
   time** (you are the model — write them into data.json from the real data) or use templates/question menus.
   Explain the substitution in `dataNote`.

## Testing (definition of done)

```bash
node scripts/check.mjs NNN-slug --shot
```
checks meta, data size, that `puzzle()` is deterministic and gives ≥ 7 distinct puzzles over 14 days, runs
`game.test.mjs`, then loads the page in headless Chrome twice: `?smoke=1` (must reach `playing`) and
`?autoplay=1` (presets auto-answer; must reach `done` — custom loops must honour `ctx.autoplay`). It writes
screenshots to `.shots/NNN-slug-{start,done,start-mobile,done-mobile}.png` — **open and look at them** and fix layout problems.
`--date=YYYY-MM-DD` checks another past puzzle day (future dates fall back to today) (shots tagged `@date`), `--dark` takes the screenshots in the dark
theme (tagged `-dark`; `?theme=dark` works on any page). Play it yourself by serving `node scripts/serve.mjs 8787` and opening `http://localhost:8787/play.html?g=NNN-slug`
(`&date=YYYY-MM-DD` for other days, `&practice=1` to replay, `&debug=1` for logs).
