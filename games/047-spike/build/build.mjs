// raw top lists -> pick spike article per day (+ co-spikers) -> per-article 21-day series -> ../data.json
// The ranking / validation logic is shared with the live loader in ../game.js.
import fs from 'node:fs'; import path from 'node:path';
import { cached, iso } from './fetch.mjs';
import { isBad, topMap, rankSpikes, checkSeries, makePuzzle, seriesUrl } from '../game.js';
const RAW = path.join(import.meta.dirname, 'raw');
const top = {};
for (const f of fs.readdirSync(RAW).filter((f) => f.startsWith('top-'))) {
  const j = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
  if (j) top[f.slice(4, 14)] = topMap(j);
}
const dates = Object.keys(top).sort();
const dayAdd = (d, n) => iso(Date.parse(d + 'T00:00:00Z') + n * 86400000);
const out = [];
for (let i = 3; i < dates.length; i++) {
  const D = dates[i];
  if (![1, 2, 3].every((k) => top[dayAdd(D, -k)])) continue;
  const spikes = rankSpikes([3, 2, 1].map((k) => top[dayAdd(D, -k)]), top[D]);
  for (let c = 0; c < Math.min(4, spikes.length); c++) {
    if (spikes[c].ratio < 3) break;
    const j = await cached(`art-${D}-${spikes[c].a}.json`.replace(/[\/?]/g, '_'), seriesUrl(spikes[c].a, D));
    const series = checkSeries(j, D);
    if (!series) { console.log('skip (series)', D, spikes[c].a); continue; }
    const p = makePuzzle(D, spikes, c, series);
    if (p) out.push(p);
    break;
  }
}
// options: every pool title + co-spiker + any article that sat in the top 300 on ≥ 2 days (so the list is not just the answers)
const pool = new Set();
for (const o of out) { pool.add(o.title); for (const c of o.co) pool.add(c.t); }
const cnt = new Map();
for (const m of Object.values(top)) for (const [a] of [...m].slice(0, 300)) cnt.set(a, (cnt.get(a) ?? 0) + 1);
for (const [a, n] of cnt) if (n >= 2 && !isBad(a)) pool.add(a.replaceAll('_', ' '));
const data = { range: [dates[3], dates.at(-1)], puzzles: out, options: [...pool].sort() };
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify(data));
console.log(out.length, 'puzzles', pool.size, 'options', fs.statSync(path.join(import.meta.dirname, '..', 'data.json')).size, 'bytes');
