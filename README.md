# Paint by Words

![Paint by Words: the clue card, the color picker, and two tests](./docs/screenshot.png)

**One color a day. An AI describes it. You find it on the color wheel.**

A daily data game for NYU Game Design (Fall 2026), Week 6. Each day's secret color is a vivid color from the [xkcd Color Survey](https://xkcd.com/color/rgb/), where 222,500 people named 3.4 million random colors. A language model wrote three clues about it without naming it. You read the clue, pick a color on a hue ring and saturation/brightness square, and test it against the hidden color.

## Play

<https://stevenli-phoenix-work.itch.io/week6-data-game>

1. **Read the clue.** "Late afternoon light on a beach towel left out to dry."
2. **Pick a color.** Drag the ring for hue, the square for saturation (left–right) and brightness (up–down). Arrow keys nudge the focused handle, Shift for bigger steps.
3. **Test.** You get a match % and three arrows: lighter/darker, redder/greener, yellower/bluer. The picker stays free, so move it and test again; a color you already tested can't be tested twice.
4. **Lock in.** Score = best match − 3 for each test after the first − 5 for each extra clue. Six tests at most.

At the end you see your best pick next to the real color, the name the survey crowd gave it, and both colors in RGB with how far off each channel was. Past days are in the archive; stats, streak and a Wordle-style share grid are kept in the browser.

## How it meets the brief

| Criterion (Lecture 6) | How |
|---|---|
| **Objective**, one right answer and a score | The answer is a single sRGB color from the survey. Match % is a fixed function of OKLab distance (Gaussian, σ = 0.15: 0.05 → 89%, 0.10 → 64%), so two players with the same pick get the same number. |
| **Reasonable** for an average player | The picker reaches every sRGB color, and nothing carries over between tests, so one bad guess never locks you out. Clues ship only if a second AI, reading them cold, lands close (86% on average). |
| **Competitive** | One number per day, shareable as `🟨🟧🟩 3 tests · 1 clue · 86 pts`. Fewer tests and clues score higher, so skill shows. |
| **Learnable** | The feedback axes are the opponent-color axes your eyes use, so players learn how the hints map onto the wheel ("redder" pulls the hue toward magenta or orange, "lighter" is up in the square). Each result shows the RGB miss per channel. |
| **Replayable** | A fresh color every day, and every past day stays playable in the archive. 164 survey colors pass the vivid + reachable filter, about five months without a repeat; widening the palette or the survey adds more. |
| **Skill expression** | Easy: drag, press Test. Hard: picturing the color from words, turning three arrows into the right move on the wheel, and deciding when another test (−3) or clue (−5) is worth it. |
| **External data** | Colors and their crowd names come from the xkcd Color Survey (CC0), shipped in `data/xkcd-rgb.txt`. |
| **At least 7 days of levels** | `web/levels.js` holds 90 days, 2026-10-17 to 2027-01-14. CI fails if it drops below 7. |
| **Novel** | The daily color games we found (Hexcodle, Colordle, Hued, Colorfle) are about matching or homing in on a color through numeric feedback. We found none where the target exists only as words, written by an AI and checked by a second one. |
| **Bonus: automated levels** | `scripts/build-levels.mjs` generates every level end to end (below). |
| **Bonus: AI** | An LLM writes the clues; a second LLM tries to decode them and rejects the ones that mislead. The experiment below measures how well that works. |

## How levels are made

```
xkcd survey (949 named colors)
  → vivid only (OKLCH chroma ≥ 0.15), minus the survey's bathroom-humor names
  → reachable by the original five-paint pot (some mix of ≤ 30 drops matches ≥ 96%); kept so the level set stays the same
  → seeded shuffle, interleaved across the hue wheel: no two days in a row share a hue family,
    and no two colors in any week are near-twins (OKLab distance < 0.1)
  → LLM writes a clue ladder: a scene (free clue), an object, a plain description
  → rule checks: ≤ 18 words, no color words in the first two clues, no word from the survey name, no numbers
  → a second LLM reads the three clues cold and guesses a hex; under 45% match → rewrite (up to 5 tries)
  → web/levels.js
```

Nothing about the answer comes from a model: the colors are computed. Every LLM reply is written to `data/llm-cache/` (local, git-ignored) before it is parsed, so re-running the builder with the same settings makes no new calls.

```bash
# local model in LM Studio
node scripts/build-levels.mjs --gen local:<model> --qa local:<model> --days 90
# OpenCode Go models (the key is injected by go.sh, never stored here)
~/.claude/skills/opencode-go/scripts/go.sh exec -- node scripts/build-levels.mjs --gen go:<model> --qa go:<model>
```

## Experiment: can an LLM describe a color well enough to play from?

Four models (Claude Haiku 5.5, DeepSeek V4.1 Flash, Kimi K3, and Qwen 3.6 running locally) each wrote clue ladders for 36 vivid colors. GPT-6 Luna then read each clue cold and named the hex it pictured, scored with the game's own match %:

| | match % |
|---|---:|
| no clue | 16 |
| the crowd's name for the color ("pinkish orange") | 66 |
| AI scene clue alone ("a calm lagoon at midday") | 49–62 |
| AI object clue alone | 50–81 |
| all three AI clues | 74–85 |

So the AI's description carries more of the color than the color's own name does. The scene → object → plain ladder climbs in the right order, which is why the scene clue is free and each further clue costs 5. Words pin down hue (within ~7°) much better than lightness, which is why every test reports lighter/darker first. Haiku won on reliability: it never broke the JSON format, and it describes a color as well from a bare hex as it does with the name. Full method, tables and caveats: [`experiments/llm-hints/`](experiments/llm-hints/), [`RESULTS.md`](experiments/llm-hints/RESULTS.md).

## Layout

```
web/                     the game, shipped to itch.io as-is (plain ES modules, no build step)
  color.js               HSV ↔ hex, OKLab distance, match %, per-axis hint; paint mixing for the builder
  state.js               game rules as pure functions (pick, tests, clues, points)
  game.js                DOM, color picker, sound, storage, dialogs
  levels.js              generated: 90 days of colors and clues
  vendor/spectral.js     Kubelka–Munk paint mixing (MIT), used by the level filter
scripts/
  build-levels.mjs       level generator (above)
  colors.mjs             survey loading, vivid/reachable filter, daily order
  hints.mjs              clue prompts and rule checks, shared with the experiment
  llm.mjs                tiny LLM client (LM Studio or OpenCode Go), raw replies cached to disk
  check-html5.mjs        itch.io HTML5 bundle validator
experiments/llm-hints/   the clue experiment and its results
data/xkcd-rgb.txt        the survey (CC0)
tests/                   color math, rules, level file
```

## Run locally

```bash
python3 -m http.server -d web 8000   # → http://localhost:8000/   (#day=12 opens a given day)
node --test tests/*.test.mjs scripts/*.test.mjs
node scripts/check-html5.mjs web
```

## Publishing

Every push to `main` runs the tests and publishes `web/` to `stevenli-phoenix-work/week6-data-game:html5` with [butler](https://itch.io/docs/butler/). The build's user version is the commit SHA, so `butler status` shows exactly which commit is live. Pull requests only run the checks and never see the `BUTLER_API_KEY` secret, which comes from the `game-design-projects` org (org secrets reach public repos only on GitHub's free plan, so this repo stays public).

## Credits

Colors and names: xkcd Color Survey by Randall Munroe (CC0). Paint mixing: [spectral.js](https://github.com/rvanwijnen/spectral.js) by Ronald van Wijnen (MIT). Fraunces typeface by Undercase Type (OFL). The earlier Daily Data prototype lives on the [`archive/daily-data`](../../tree/archive/daily-data) branch.
