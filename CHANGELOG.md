# Changelog

This project follows the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

## [Unreleased]

### Added
- Live-data proxy: the Worker's `/api/fetch?url=…` (`worker/proxy.js`) fetches an allowed upstream through Cloudflare's cache once per UTC day (the subrequest cache via `cf.cacheEverything`, since the Cache API does nothing on workers.dev) and tells the browser to reuse it for the time left in that day. It checks every body (PNG, complete non-empty JSON, or plain text; never HTML or `[]`/`{}`), forces a safe content type with `nosniff`, follows redirects only to allowed hosts, and keeps the upstream fetch alive past a client that gives up. `GET` and `HEAD` only.
- `engine/upstream.js`: the allowlist (host → path prefixes) shared by the browser, the Worker and the dev server. `engine/livefetch.js`: the browser tries the proxy first and falls back to the upstream when the Worker is missing or failing. `ctx.fetchBuffer` for binary data.
- `tests/proxy.test.mjs`: allowlist, body checks, the handler (methods, caching headers, redirects, waitUntil), the browser fallback, a browser-to-handler round trip, and a check that every live game's URLs are on the allowlist.
- Shared engine: design system `engine/ds.css` (paper-and-ink look, an accent color per category, light and dark themes), pure core `core.js`, components `dom.js`, game shell `shell.js`, front page `gallery.js`.
- Eight game-loop presets: guess an entity (guess), estimate a number (estimate), drop a map pin (pin), multiple choice (rounds), ordering (order), matching (match), grouping (groups), canvas (canvas).
- Lazily loaded charts (Observable Plot) and maps (Leaflet + label-free Esri basemaps).
- Daily seeded puzzles, saved results, streak stats, share text, practice mode, browsing past days.
- Tool scripts: `scripts/serve.mjs`, `scripts/check.mjs` (validation + headless Chrome smoke test + screenshots), `scripts/registry.mjs`.
- Reference games: #1 Daylight, #70 Holiday, and the hidden preset demo #0.
- The other 97 games (#2–#102, except #4, #8 and #44, which already exist elsewhere), one folder each with a real data snapshot, data build scripts and unit tests; 99 games on the front page.
- `scripts/mobile.html`: phone-width screenshots through a 390 px iframe (a headless Chrome window can't be narrower than about 500 px).
- 13 games fetch live data in the browser, anchored to yesterday (or an earlier day when the source needs time to settle), with a snapshot fallback: #11 Aftershock, #12 Forecast Match, #18 Bridge Count, #37 AQI Rank, #38 Tide, #42 Ground Track, #47 Spike, #79 Front Page, #80 Subdomain, #88 Sail, #91 Quake Defense, #92 Storm Run, #96 Missing Number.
- #41 Gravity Assist computes the day's real planet positions in the browser from JPL approximate orbital elements.
- Each game's `game.test.mjs` checks every puzzle over 120 days (answer is selectable, distractors are distinct, no empty values, plausible numbers) and scans the whole pool for answer leaks.
- `check.mjs --date=YYYY-MM-DD` (check a past day) and `--dark` (dark-theme screenshots); a phone-width result screenshot; pages accept `?theme=dark|light`.
- `tests/presets.test.mjs`: tests the groups, estimate and canvas presets in headless Chrome.
- Deployment as Cloudflare Workers static assets: `scripts/dist.sh` builds `dist/` from committed files (without build scripts, raw data, tests and docs) and `wrangler.jsonc` serves it on workers.dev. Live at https://daily-data.lishuyustevenli.workers.dev/.
- `tests/english.test.mjs`: fails if any shipped file (pages, engine, games outside `build/`) contains Chinese text or full-width punctuation. Six data files are allowed on purpose: local-script street names in #13 Intersection, local holiday names in #70 Holiday, and exact CC BY-SA photographer credits in #21, #98, #101 and #102.

### Changed
- Live games (#11, #12, #18, #37, #38, #42, #47, #79, #80, #88, #91, #92, #96) fetch through the Worker's per-day cache. #92 Storm Run's radar PNGs now use `ctx.fetchBuffer` instead of a raw `fetch()`.
- `scripts/serve.mjs` runs the same `/api/fetch` handler as the Worker (without caching). `scripts/dist.sh` no longer ships `worker/`, and the English-only test also scans it.
- The whole site is in English: engine, page shell, gallery, preset widgets, dates ("Thu, Oct 15, 2026"), and every game's copy and data labels (one commit per game). Pages declare `lang="en"`.
- Basemaps: zoom 8 and below use the label-free Esri shaded relief, zoom 9 and above the gray street canvas; Esri's gray canvas paints country and sea names at zooms 3–8.
- Smoke tests and autoplay turn off animations, so screenshots show the final state.
- All 99 games re-audited against the original ideas and revised (one commit per game, the body says what changed and which deviations remain and why): restored simplified mechanics (e.g. #2 draws the whole line, #25 types the indicator name, #63/#95 free-form questions, #68 three sliders on one screen), larger pools where they were small, and result cards that explain the day's puzzle.
- Maps support fractional zoom, so `fitBounds` fills narrow screens; map animations are off in smoke mode.
- The groups preset keeps each cell's original casing instead of uppercasing it.
- The result verdict follows the score band; 1/100 no longer says "Close."

### Fixed
- Guess feedback columns size to their content (shared across rows via subgrid), so values like "11,056 km" no longer break mid-word on phones.
- `estimate` no longer prints the unit twice when a custom `format()` already includes it (including prefix units like `$`).
- A map created before it is attached to the page zooms to its bounds once it has a real size.
- Submitting the same wrong group twice in the groups preset no longer costs a second mistake.
- Canvas preset: captures the pointer while dragging, treats `pointercancel` as a release, and redraws once after a resize when stopped instead of going blank.
- The `hidden` attribute is no longer overridden by layout classes such as `ds-row`.
- Answer leaks: #39 hides place names while guessing, #70 redacts the country's name in every language, #53/#82 redact whole words including aliases, #98 shows the whole world map on phones.
- #61 Funded filters adult-content crowdfunding projects out of its pool.
