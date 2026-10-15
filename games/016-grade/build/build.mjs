// raw/inspections.json (fetch.mjs) → ../data.json
//   items: three-violation inspections, stratified by score (so every score band appears)
//   pts:   "code|C" or "code|G" → [min, median, max, n] total score of inspections that cited ONLY that violation
import fs from 'node:fs';
import { PLAIN } from './plain.mjs';
const rows = JSON.parse(fs.readFileSync(new URL('./raw/inspections.json', import.meta.url), 'utf8'));
const clean = (s) => s.replace(/\s+/g, ' ').replace(/ /g, ' ').trim();
const g = new Map();
for (const r of rows) {
  const k = r.camis + '|' + r.inspection_date;
  if (!g.has(k)) g.set(k, []);
  g.get(k).push(r);
}
const flag = (x) => (x.critical_flag === 'Critical' ? 'C' : 'G');
// points table from single-violation inspections
const single = {};
for (const v of g.values()) {
  if (v.length !== 1) continue;
  const s = Number(v[0].score);
  if (!Number.isFinite(s)) continue;
  (single[v[0].violation_code + '|' + flag(v[0])] ??= []).push(s);
}
const pts = {};
for (const [k, a] of Object.entries(single)) {
  if (a.length < 3) continue;
  a.sort((x, y) => x - y);
  pts[k] = [a[0], a[a.length >> 1], a[a.length - 1], a.length];
}
const cands = [];
for (const [k, v] of g) {
  if (v.length !== 3) continue;
  const grade = v[0].grade, score = Number(v[0].score);
  if (!Number.isFinite(score) || score > 60 || !/^(Manhattan|Brooklyn|Queens|Bronx|Staten Island)$/.test(v[0].boro)) continue;
  if (!v[0].dba || !v[0].cuisine_description) continue;
  if ((grade === 'A') !== (score <= 13) || (grade === 'C') !== (score >= 28)) continue;
  if (new Set(v.map((x) => x.violation_code)).size !== 3 || v.some((x) => !PLAIN[x.violation_code] || !pts[x.violation_code + '|' + flag(x)])) continue;
  cands.push({ name: clean(v[0].dba), boro: v[0].boro, cuisine: clean(v[0].cuisine_description), date: v[0].inspection_date.slice(0, 10), score, grade,
    v: v.map((x) => ({ code: x.violation_code, text: clean(x.violation_description), crit: x.critical_flag === 'Critical' })) });
}
let seed = 16; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const shuf = (a) => a.map((x) => [rnd(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
const CAP = { default: 7, 12: 6, 13: 6, 11: 6 };
const perScore = {}, seen = new Set(), items = [];
for (const c of shuf(cands)) {
  if (seen.has(c.name.toLowerCase())) continue;
  const cap = CAP[c.score] ?? CAP.default;
  if ((perScore[c.score] || 0) >= cap) continue;
  perScore[c.score] = (perScore[c.score] || 0) + 1; seen.add(c.name.toLowerCase()); items.push(c);
}
items.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
const used = new Set(items.flatMap((i) => i.v.map((x) => x.code)));
const plain = Object.fromEntries([...used].sort().map((c) => [c, PLAIN[c]]));
const usedPts = Object.fromEntries(Object.entries(pts).filter(([k]) => used.has(k.split('|')[0])));
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ items, plain, pts: usedPts }));
const gc = { A: 0, B: 0, C: 0 }; for (const i of items) gc[i.grade]++;
console.log(items.length, gc, JSON.stringify(perScore), fs.statSync(new URL('../data.json', import.meta.url)).size);
