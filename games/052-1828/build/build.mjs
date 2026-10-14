// raw 1828 CSV + frequency list -> data.json (options list + puzzle pool)
import fs from 'node:fs';
import { parseEntry, stem } from '../parse.js';

const dir = new URL('./raw/', import.meta.url);
const csv = fs.readFileSync(new URL('webster1828.csv', dir), 'utf8');
const freq = fs.readFileSync(new URL('freq.txt', dir), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const rank = new Map(freq.map((w, i) => [w, i]));

// minimal CSV: lines are "word","html" with "" escapes; entries are single-line
const entries = new Map();
for (const line of csv.split('\n')) {
  const m = line.match(/^"([^"]+)","(.*)"$/s);
  if (!m) continue;
  const w = m[1].toLowerCase();
  if (!/^[a-z]+$/.test(w) || !rank.has(w) || entries.has(w)) continue;
  entries.set(w, m[2].replace(/""/g, '"'));
}
const options = [];
const cands = [];
for (const [w, html] of entries) {
  const e = parseEntry(html, w);
  if (!e) continue;
  options.push(w);
  if (w.length >= 4 && rank.get(w) >= 500 && rank.get(w) < 7000 && e.senses.length >= 3 && e.senses.every((s) => s.length < 260) && e.senses[0].length > 25 && !/^(See|Same|A |An )?\s*\[?See /.test(e.senses[0])) {
    cands.push({ w, e, r: rank.get(w) });
  }
}
options.sort();
// deterministic spread: take every k-th candidate by rank
cands.sort((a, b) => a.r - b.r);
const step = Math.max(1, Math.floor(cands.length / 110));
const pool = [];
for (let i = 0; i < cands.length && pool.length < 110; i += step) {
  const { w, e } = cands[i];
  pool.push({ w, pos: e.pos, ety: e.ety, senses: e.senses.slice(0, 6) });
}
const out = { options, pool };
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out));
console.log('options', options.length, 'candidates', cands.length, 'pool', pool.length);
