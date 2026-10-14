// raw HTS JSON -> data.json (pool of 3-item puzzles). Fetch: see fetch.sh
import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync(new URL('./raw/hts.json', import.meta.url)));
const stack = [];
const items = [];
const clean = (s) => s.replace(/(\w)- (?=[a-z])/g, '$1').replace(/ \(\d+\)$/, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
for (const r of rows) {
  const ind = +r.indent;
  stack[ind] = clean(r.description || '');
  stack.length = ind + 1;
  const g = (r.general || '').trim();
  if (!r.htsno || r.htsno.length < 12 || !g) continue; // 10-digit lines only
  let rate = null;
  if (g === 'Free') rate = 0;
  else { const m = g.match(/^(\d+(?:\.\d+)?)%$/); if (m) rate = +m[1]; }
  if (rate == null) continue;
  const path = stack.filter(Boolean).map((s) => s.replace(/:$/, ''));
  const full = path.slice(1).join(' › ') || path[0];
  if (full.length < 70 || full.length > 260) continue;
  if (/other|n\.e\.s\.|not elsewhere/i.test(path[path.length - 1] || '') && path.length < 3) continue;
  items.push({ hts: r.htsno, ch: r.htsno.slice(0, 2), d: path.length > 1 ? path.slice(1).join(' › ') : path[0], top: path[0].slice(0, 160), rate });
}
console.log('candidates', items.length);
// seeded shuffle for reproducibility
let s = 29;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
// keep rate distribution varied: bucket and take across buckets
const buckets = { 0: [], low: [], mid: [], high: [] };
for (const it of items) (it.rate === 0 ? buckets[0] : it.rate <= 5 ? buckets.low : it.rate <= 15 ? buckets.mid : buckets.high).push(it);
const take = (arr, n) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } const seenCh = {}; const out = []; for (const x of a) { if ((seenCh[x.ch] = (seenCh[x.ch] || 0) + 1) > 3) continue; out.push(x); if (out.length >= n) break; } return out; };
const pool = [...take(buckets[0], 40), ...take(buckets.low, 55), ...take(buckets.mid, 55), ...take(buckets.high, 30)];
console.log(Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])), 'pool', pool.length);
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), items: pool.map(({ top, ...x }) => x) }));
