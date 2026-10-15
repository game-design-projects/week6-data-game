// raw 1828 CSV + frequency list -> data.json (options list + puzzle pool)
import fs from 'node:fs';
import { parseEntry, leakTokens } from '../parse.js';

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
const BAD_START = /^(See|Same as|Obsolete|Obs\.|Ibid)\b/i;
const words = new Set();
// every plain headword in the whole dictionary can be guessed
for (const line of csv.split('\n')) {
  const m = line.match(/^"([A-Za-z]+)",/);
  if (m) words.add(m[1].toLowerCase());
}
const cands = [];
let dropped = 0;
for (const [w, html] of entries) {
  const e = parseEntry(html, w);
  if (!e) continue;
  if (!(w.length >= 4 && rank.get(w) >= 500 && rank.get(w) < 7000 && e.senses.length >= 3 && e.senses.every((s) => s.length < 260) && e.senses[0].length > 25)) continue;
  if (!e.pos || (!e.senses[3] && !e.ety)) continue; // clue slots must be distinct
  if (e.senses.slice(0, 6).some((s) => BAD_START.test(s) || s.length < 12)) continue;
  const sn = e.senses.slice(0, 6);
  if (sn.some((s) => leakTokens(s, w).length) || /[^\x20-\x7e]/.test(sn.join(' ') + (e.ety || ''))) { dropped++; continue; }
  cands.push({ w, e, r: rank.get(w) });
}
const WANT = 150;
cands.sort((a, b) => a.r - b.r);
const step = Math.max(1, Math.floor(cands.length / WANT));
const pool = [];
for (let i = 0; i < cands.length && pool.length < WANT; i += step) {
  const { w, e } = cands[i];
  pool.push({ w, pos: e.pos, ety: e.ety, senses: e.senses.slice(0, 6) });
}
const sorted = [...words].sort();
const out = { words: sorted.join(' '), pool };
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out));
console.log('words', sorted.length, 'candidates', cands.length, 'leak-dropped', dropped, 'pool', pool.length);
