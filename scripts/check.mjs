#!/usr/bin/env node
// Validate games. Usage:
//   node scripts/check.mjs 001-daylight            # one game: meta, data, puzzle, tests, browser smoke
//   node scripts/check.mjs 001-daylight --shot     # + screenshots in .shots/<dir>-{start,done}{,-mobile}.png
//   node scripts/check.mjs --all [--no-browser]    # every game
//   --date=YYYY-MM-DD  smoke/screenshot another past puzzle day (future dates fall back to today; shots get an @date tag)
//   --dark             screenshots in the dark theme (shots get a -dark tag)
// Exit code 1 if any check fails.
import { readdir, readFile, stat, mkdir, rm, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, startServer } from './serve.mjs';
import { makeRng, dailyIndex, isoFromDay, dayNumber, todayISO } from '../engine/core.js';

const CATS = ['geo', 'nyc', 'money', 'science', 'words', 'culture', 'society', 'tech', 'transit', 'levels', 'literacy', 'model'];
const KINDS = ['live', 'snapshot', 'computed', 'synthetic'];
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SMOKE_DATE = opt('date') ?? todayISO();
const THEME = flags.has('--dark') ? '&theme=dark' : '';
const TAG = `${opt('date') ? `@${SMOKE_DATE}` : ''}${THEME ? '-dark' : ''}`;
const names = args.filter((a) => !a.startsWith('--'));
const browser = !flags.has('--no-browser') && existsSync(CHROME);

const gamesDir = path.join(ROOT, 'games');
const dirs = flags.has('--all')
  ? (await readdir(gamesDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort()
  : names.map((n) => n.replace(/^games\//, '').replace(/\/$/, ''));
if (!dirs.length) { console.error('usage: node scripts/check.mjs <dir…> | --all [--shot] [--no-browser]'); process.exit(2); }

let server = null;
const port = async () => (server ??= await startServer(0)).address().port;

function runChrome(url, { shot, width = 1280, height = 1000, budget = 20000 } = {}) {
  return new Promise(async (resolve) => {
    const profile = await mkdtemp(path.join(os.tmpdir(), 'ddg-chrome-'));
    const a = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${profile}`, `--window-size=${width},${height}`, `--virtual-time-budget=${budget}`];
    a.push(shot ? `--screenshot=${shot}` : '--dump-dom', url);
    const p = spawn(CHROME, a, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    const kill = setTimeout(() => p.kill('SIGKILL'), budget + 40000);
    p.on('close', async () => { clearTimeout(kill); await rm(profile, { recursive: true, force: true }).catch(() => {}); resolve(out); });
  });
}

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

async function smoke(dir, mode) {
  const url = `http://127.0.0.1:${await port()}/play.html?g=${dir}&date=${SMOKE_DATE}&${mode}=1`;
  const dom = await runChrome(url);
  const state = dom.match(/<body[^>]*data-state="([^"]+)"/)?.[1] ?? '(no body)';
  const error = dom.match(/<body[^>]*data-error="([^"]*)"/)?.[1];
  const logs = decode(dom.match(/<pre id="ddlog"[^>]*>([\s\S]*?)<\/pre>/)?.[1] ?? '');
  const bad = logs.split('\n').filter((l) => / (ERROR|WARN) /.test(l));
  return { state, error: error && decode(error), bad, logs };
}

async function checkOne(dir) {
  const fails = [];
  const warns = [];
  const info = [];
  const base = path.join(gamesDir, dir);
  const t0 = Date.now();

  // 1. module + meta
  let game;
  try {
    game = (await import(pathToFileURL(path.join(base, 'game.js')).href + `?t=${Date.now()}`)).default;
  } catch (e) {
    fails.push(`import game.js: ${e.message}`);
    return { dir, fails, warns, info };
  }
  const m = game?.meta ?? {};
  if (!Number.isInteger(m.num)) fails.push('meta.num must be an integer');
  if (!/^\d{3}-[a-z0-9-]+$/.test(dir)) fails.push(`folder name must be NNN-slug, got "${dir}"`);
  else if (m.num !== Number(dir.slice(0, 3))) fails.push(`meta.num ${m.num} ≠ folder prefix ${dir.slice(0, 3)}`);
  for (const k of ['title', 'tagline']) if (typeof m[k] !== 'string' || !m[k].trim()) fails.push(`meta.${k} missing`);
  if (!CATS.includes(m.category)) fails.push(`meta.category must be one of ${CATS.join('|')}`);
  if (!KINDS.includes(m.data)) fails.push(`meta.data must be one of ${KINDS.join('|')}`);
  if (!Array.isArray(m.howTo) || m.howTo.length < 2) fails.push('meta.howTo needs ≥ 2 steps');
  if (!Array.isArray(m.sources) || !m.sources.length || m.sources.some((s) => !s?.name)) fails.push('meta.sources needs ≥ 1 {name, url}');
  if (typeof game.play !== 'function') fails.push('export default must have play(ctx, puzzle)');

  // 2. data.json
  let data = null;
  const dataFile = path.join(base, 'data.json');
  if (existsSync(dataFile)) {
    const size = (await stat(dataFile)).size;
    info.push(`data.json ${(size / 1024).toFixed(0)} KB`);
    if (size > 3 * 1024 * 1024) fails.push(`data.json is ${(size / 1048576).toFixed(1)} MB (limit 3 MB)`);
    else if (size > 1.5 * 1024 * 1024) warns.push('data.json > 1.5 MB — consider trimming');
    try { data = JSON.parse(await readFile(dataFile, 'utf8')); } catch (e) { fails.push(`data.json invalid JSON: ${e.message}`); }
  } else if (m.data !== 'computed' && m.data !== 'synthetic') warns.push('no data.json (fine only if load() always succeeds)');

  // 3. puzzle(): pure, deterministic, varies by day
  if (typeof game.puzzle === 'function') {
    const slug = m.slug ?? dir;
    const today = dayNumber(todayISO());
    const days = [...Array(60).keys()].map((i) => today - 13 + i);
    const seen = new Set();
    let firstErr = null;
    for (const day of days) {
      const date = isoFromDay(day);
      const mk = () => game.puzzle({ data, day, date, slug, rng: makeRng(`${slug}:${date}`), pick: (arr) => arr[dailyIndex(slug, day, arr.length)] });
      try {
        const a = JSON.stringify(mk());
        const b = JSON.stringify(mk());
        if (a === undefined) throw new Error('returned undefined');
        if (a !== b) throw new Error('not deterministic (two calls differ)');
        if (days.indexOf(day) < 14) seen.add(a);
      } catch (e) { firstErr ??= `day ${day} (${date}): ${e.message}`; }
    }
    if (firstErr) fails.push(`puzzle(): ${firstErr}`);
    else if (seen.size < 7) fails.push(`puzzle(): only ${seen.size} distinct puzzles across 14 days (need ≥ 7)`);
    else info.push(`puzzle() ok · ${seen.size}/14 distinct`);
  } else warns.push('no puzzle() — daily variation is untested');

  // 4. per-game unit tests
  const testFile = path.join(base, 'game.test.mjs');
  if (existsSync(testFile)) {
    const code = await new Promise((resolve) => {
      const p = spawn(process.execPath, ['--test', testFile], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      p.stdout.on('data', (d) => (out += d));
      p.stderr.on('data', (d) => (out += d));
      p.on('close', (c) => resolve({ c, out }));
    });
    if (code.c !== 0) fails.push(`game.test.mjs failed:\n${code.out.split('\n').filter((l) => /✖|Error|expected|actual|not ok/.test(l)).slice(0, 12).join('\n')}`);
    else info.push('game.test.mjs ok');
  }

  // 5. browser smoke (start state + autoplay to the result card)
  if (browser && !fails.some((f) => f.startsWith('import'))) {
    const start = await smoke(dir, 'smoke');
    if (!['playing', 'done'].includes(start.state)) fails.push(`browser start: state=${start.state}${start.error ? ` error=${start.error}` : ''}`);
    const auto = await smoke(dir, 'autoplay');
    if (auto.state !== 'done') {
      const msg = `browser autoplay: state=${auto.state}${auto.error ? ` error=${auto.error}` : ''}`;
      (game.autoplay === false ? warns : fails).push(msg + (game.autoplay === false ? ' (game opted out of autoplay)' : ''));
    }
    const bad = [...new Set([...start.bad, ...auto.bad])];
    if (bad.length) warns.push(`log errors/warnings:\n    ${bad.slice(0, 8).join('\n    ')}`);
    info.push(`browser ok · start=${start.state} autoplay=${auto.state}`);
    if (flags.has('--shot')) {
      const shots = path.join(ROOT, '.shots');
      await mkdir(shots, { recursive: true });
      const pt = await port();
      const u = (mode) => `http://127.0.0.1:${pt}/play.html?g=${dir}&date=${SMOKE_DATE}${THEME}&${mode}=1`;
      await Promise.all([
        runChrome(u('smoke'), { shot: path.join(shots, `${dir}${TAG}-start.png`), height: 1400 }),
        runChrome(u('autoplay'), { shot: path.join(shots, `${dir}${TAG}-done.png`), height: 2600 }),
        runChrome(`http://127.0.0.1:${pt}/scripts/mobile.html#${encodeURIComponent(u('autoplay'))}`, { shot: path.join(shots, `${dir}${TAG}-done-mobile.png`), width: 390, height: 3200 }),
        runChrome(`http://127.0.0.1:${pt}/scripts/mobile.html#${encodeURIComponent(u('smoke'))}`, { shot: path.join(shots, `${dir}${TAG}-start-mobile.png`), width: 390, height: 1400 }),
      ]);
      info.push(`screenshots → .shots/${dir}${TAG}-{start,done,start-mobile,done-mobile}.png`);
    }
  } else if (!browser) warns.push('browser smoke skipped');

  info.push(`${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { dir, fails, warns, info };
}

let failed = 0;
const queue = dirs.slice();
const results = [];
const workers = Array.from({ length: Math.min(flags.has('--all') ? 6 : 1, queue.length) }, async () => {
  while (queue.length) {
    const d = queue.shift();
    const r = await checkOne(d);
    results.push(r);
    const mark = r.fails.length ? '✖' : r.warns.length ? '△' : '✔';
    console.log(`${mark} ${d}  ${r.info.join(' · ')}`);
    r.fails.forEach((f) => console.log(`   FAIL ${f}`));
    r.warns.forEach((w) => console.log(`   warn ${w}`));
    if (r.fails.length) failed++;
  }
});
await Promise.all(workers);
server?.close();
console.log(`\n${dirs.length - failed}/${dirs.length} passed`);
process.exit(failed ? 1 : 0);
