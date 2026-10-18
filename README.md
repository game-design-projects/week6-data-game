# Week 6 · Data Game

![](./docs/screenshot.png)

NYU Game Design, Lecture 6: a daily game built from public data. We're building my teammate's idea; the design is still being worked out, so `web/` holds a placeholder for now.

The earlier **Daily Data** prototype (100 small daily games, a shared engine and a Cloudflare Worker) lives on the [`archive/daily-data`](../../tree/archive/daily-data) branch. Its live site at <https://daily-data.lishuyustevenli.workers.dev/> is unaffected.

## Play

<https://stevenli-phoenix-work.itch.io/week6-data-game>

## Layout

```
web/                      the game. Shipped to itch.io as-is: index.html at the root, relative paths only
scripts/check-html5.mjs   itch.io HTML5 bundle validator (file count/size limits, relative paths, no symlinks)
.github/workflows/itch.yml   CI: validate on every PR and push, publish to itch.io on main
```

## Run locally

```bash
python3 -m http.server -d web 8000   # → http://localhost:8000/
```

## Publishing

Every push to `main` publishes `web/` to `stevenli-phoenix-work/week6-data-game:html5` with [butler](https://itch.io/docs/butler/). The build's user version is the commit SHA, so `butler status` shows exactly which commit is live. Pull requests only run the checks and never see the `BUTLER_API_KEY` secret.

Before pushing, run the same checks CI runs:

```bash
node --test scripts/check-html5.test.mjs
node scripts/check-html5.mjs web
```

If the game ends up needing a build step (Vite, Phaser bundling…), add it to the `check` job in `itch.yml` and make it write to `web/` (set Vite's `base` to `./`).
