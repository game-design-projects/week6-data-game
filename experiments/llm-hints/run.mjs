// Experiment: can an LLM describe a hidden color well enough to serve as the daily hint?
//
// 1. Sample vivid survey colors, stratified by hue.
// 2. A generator model writes a hint ladder (vague -> object -> plain) for each, given the hex,
//    OKLCH and survey name; plus an "object" hint written from the hex alone.
// 3. A decoder model (fresh context) reads each hint, alone and stacked, and answers a hex code.
// 4. The game's own accuracy() scores the decoded color against the truth. Baselines: no hint,
//    and the survey name on its own.
//
// Usage: node experiments/llm-hints/run.mjs --gen local:hintlab --dec local:hintlab [--n 24] [--tag name]
//        (cloud models: wrap in `~/.claude/skills/opencode-go/scripts/go.sh exec --` and use go:<model>)
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { candidates, rng } from '../../scripts/colors.mjs';
import { makeClient, pool } from '../../scripts/llm.mjs';
import { GEN_SYSTEM, ladderPrompt, hexOnlyPrompt, parseLadder, leaks } from '../../scripts/hints.mjs';
import { accuracy, oklab } from '../../web/color.js';
import { OKLab_to_OKLCh } from '../../web/vendor/spectral.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(s => s.trim().split(/\s+/)).map(([k, ...v]) => [k, v.join(' ')]));
const GEN = (args.gen || 'local:hintlab').split(',');
const DEC = args.dec || 'local:hintlab';
const N = +(args.n || 24);
const CONCURRENCY = +(args.jobs || (DEC.startsWith('local') ? 2 : 6));
const ask = makeClient({ cacheDir: path.join(here, 'raw') });

const DEC_SYSTEM = 'You are playing a paint-mixing game. You read hints about a hidden color and picture the exact shade.';
const decodePrompt = hints => `${hints.length > 1 ? 'Hints, from vague to precise:\n' + hints.map((h, i) => `${i + 1}. ${h}`).join('\n') : 'Hint: ' + hints[0]}
Reply with only your best guess as a hex code, like #4A7FC1.`;
const parseHex = s => s.match(/#[0-9a-f]{6}\b/i)?.[0].toUpperCase() ?? null;

function sample(all, n) {
  const rand = rng(20261017);
  const bins = Array.from({ length: 12 }, () => []);
  for (const c of all) bins[Math.floor(c.h / 30) % 12].push(c);
  const picked = [];
  for (let round = 0; picked.length < n; round++) {
    let added = false;
    for (const bin of bins) {
      if (picked.length >= n || !bin.length) continue;
      picked.push(bin.splice(Math.floor(rand() * bin.length), 1)[0]);
      added = true;
    }
    if (!added) break;
  }
  return picked;
}

function axisError(guess, truth) {
  const [L1, C1, h1] = OKLab_to_OKLCh(oklab(guess)), [L2, C2, h2] = OKLab_to_OKLCh(oklab(truth));
  const dh = Math.abs(((h1 - h2 + 540) % 360) - 180);
  return { dL: L1 - L2, dC: C1 - C2, dh };
}

async function decode(hints, truth) {
  const reply = await ask(DEC, { system: DEC_SYSTEM, user: decodePrompt(hints), temperature: 0 });
  const hex = parseHex(reply);
  return hex ? { hex, acc: accuracy(hex, truth), ...axisError(hex, truth) } : { hex: null, acc: 0, reply };
}

// The experiment ran (and is cached) with the original filter: 0.12 vividness, no name filter.
const colors = sample(candidates({ minChroma: 0.12, clean: false, log: console.error }), N);
console.error(`[exp] ${colors.length} colors; generators ${GEN.join(', ')}; decoder ${DEC}`);

const baseline = { none: [], name: [] };
const noHint = await decode(['(no hint today; it is a vivid color)'], colors[0].hex);
await pool(colors, CONCURRENCY, async c => {
  baseline.none.push({ hex: noHint.hex, acc: noHint.hex ? accuracy(noHint.hex, c.hex) : 0, ...(noHint.hex ? axisError(noHint.hex, c.hex) : {}) });
  baseline.name.push(await decode([`people call this color "${c.name}"`], c.hex));
});

const runs = [];
for (const gen of GEN) {
  const rows = (await pool(colors, CONCURRENCY, async c => {
    try { return await runColor(gen, c); } catch (e) {
      if (/key rejected/.test(e.message)) throw e;
      console.error(`[exp] ${gen} ${c.name}: skipped, ${e.message.slice(0, 160)}`);
      return null;
    }
  })).filter(Boolean);
  runs.push({ gen, rows });
}

async function runColor(gen, c) {
    const ladder = parseLadder(await ask(gen, { system: GEN_SYSTEM, user: ladderPrompt(c) }));
    const hexOnly = (await ask(gen, { system: GEN_SYSTEM, user: hexOnlyPrompt(c) })).replace(/^["']|["']$/g, '');
    const row = { name: c.name, hex: c.hex, L: c.L, C: c.C, h: c.h, ladder, hexOnly, decoded: {}, leaks: {} };
    if (ladder) {
      for (const k of ['vague', 'object', 'plain']) { row.decoded[k] = await decode([ladder[k]], c.hex); row.leaks[k] = leaks(ladder[k], c.name, k === 'plain'); }
      row.decoded['vague+object'] = await decode([ladder.vague, ladder.object], c.hex);
      row.decoded['all three'] = await decode([ladder.vague, ladder.object, ladder.plain], c.hex);
    }
    row.decoded['object, hex only'] = await decode([hexOnly], c.hex);
    row.leaks['object, hex only'] = leaks(hexOnly, c.name, false);
    console.error(`[exp] ${gen} ${c.name} ${c.hex}: ${Object.entries(row.decoded).map(([k, v]) => `${k}=${v.acc}`).join(' ')}`);
    return row;
}

// ---- summarise
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
function stats(list) {
  const accs = list.map(d => d.acc);
  return { n: list.length, mean: +mean(accs).toFixed(1), median: +median(accs).toFixed(1), ge70: Math.round(100 * accs.filter(a => a >= 70).length / accs.length), absL: +mean(list.filter(d => d.hex).map(d => Math.abs(d.dL))).toFixed(3), absC: +mean(list.filter(d => d.hex).map(d => Math.abs(d.dC))).toFixed(3), hueDeg: Math.round(mean(list.filter(d => d.hex).map(d => d.dh))) };
}
const table = [['baseline', 'no hint', stats(baseline.none)], ['baseline', 'survey name only', stats(baseline.name)]];
const leakTable = [];
for (const { gen, rows } of runs) {
  const conds = ['vague', 'object', 'plain', 'vague+object', 'all three', 'object, hex only'];
  for (const k of conds) table.push([gen, k, stats(rows.filter(r => r.decoded[k]).map(r => r.decoded[k]))]);
  for (const k of ['vague', 'object', 'plain', 'object, hex only']) {
    const ls = rows.map(r => r.leaks[k]).filter(Boolean);
    leakTable.push([gen, k, Math.round(100 * ls.filter(l => l.name.length).length / ls.length), Math.round(100 * ls.filter(l => l.color.length).length / ls.length), +mean(ls.map(l => l.words)).toFixed(1)]);
  }
  const bad = rows.filter(r => !r.ladder).length;
  if (bad) console.error(`[exp] ${gen}: ${bad} ladder replies were not valid JSON`);
}
const tag = args.tag || [...GEN, DEC].join('_').replace(/[^a-z0-9.-]+/gi, '-');
await mkdir(path.join(here, 'results'), { recursive: true });
await writeFile(path.join(here, 'results', `${tag}.json`), JSON.stringify({ at: new Date().toISOString(), generators: GEN, decoder: DEC, colors: colors.map(c => ({ name: c.name, hex: c.hex })), baseline, runs, table, leakTable }, null, 1));
const md = [
  `### ${GEN.join(', ')} → decoded by ${DEC} (${colors.length} colors)`, '',
  '| generator | hint | mean acc | median | ≥70 % | \\|ΔL\\| | \\|ΔC\\| | Δhue° |', '|---|---|---:|---:|---:|---:|---:|---:|',
  ...table.map(([g, k, s]) => `| ${g} | ${k} | ${s.mean} | ${s.median} | ${s.ge70}% | ${s.absL} | ${s.absC} | ${s.hueDeg} |`), '',
  '| generator | hint | uses survey-name word | uses a color word | words |', '|---|---|---:|---:|---:|',
  ...leakTable.map(([g, k, n, c, w]) => `| ${g} | ${k} | ${n}% | ${k === 'plain' ? '(allowed)' : c + '%'} | ${w} |`), '',
];
await writeFile(path.join(here, 'results', `${tag}.md`), md.join('\n'));
console.log(md.join('\n'));
