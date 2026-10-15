// raw World Bank series -> data.json.
// Pool = 70 daily puzzles x 3 sets (easy/medium/hard). Each set: 6 series from 6 different countries and
// 6 different indicators, exactly one pair with r in [0.93, 0.995], every other pair r < 0.8, and at least
// two decoys that trend the same way as the target pair (so "pick the two rising lines" does not work).
import fs from 'node:fs';
import { IND } from './fetch.mjs';
const here = (p) => new URL(p, import.meta.url);
const YEARS = Array.from({ length: 23 }, (_, i) => 2000 + i);
let seed = 99099; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const ri = (n) => Math.floor(rnd() * n);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const countries = new Map(JSON.parse(fs.readFileSync(here('raw/countries.json')))[1].filter((c) => c.region.id !== 'NA').map((c) => [c.id, c]));
const enName = (c2, wb) => { try { const n = new Intl.DisplayNames(['en'], { type: 'region' }).of(c2); return n && n !== c2 ? n : wb; } catch { return wb; } };

const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const zscore = (v) => { const m = mean(v), sd = Math.sqrt(mean(v.map((x) => (x - m) ** 2))); return v.map((x) => (x - m) / sd); };
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s / a.length; };

const series = [];
for (const id of Object.keys(IND)) {
  const rows = JSON.parse(fs.readFileSync(here(`raw/${id}.json`)))[1] || [];
  const m = new Map();
  for (const r of rows) { if (!countries.has(r.countryiso3code)) continue; (m.get(r.countryiso3code) || m.set(r.countryiso3code, {}).get(r.countryiso3code))[r.date] = r.value; }
  for (const [cc, o] of m) {
    const v = YEARS.map((y) => o[y]);
    if (v.some((x) => x == null || !Number.isFinite(x))) continue;
    const mu = mean(v), sd = Math.sqrt(mean(v.map((x) => (x - mu) ** 2)));
    if (sd < 1e-9 || sd / (Math.abs(mu) + 1e-9) < 0.02) continue; // flat
    const rounded = v.map((x) => +Number(x.toPrecision(4)));
    if (rounded.slice(1).filter((x, i) => x === rounded[i]).length > 6) continue; // staircase / interpolated
    if (new Set(rounded).size < 12) continue;
    const z = zscore(rounded);
    series.push({ key: `${id}|${cc}`, ind: id, cc, v: rounded, z, rt: dot(z, zscore(YEARS)) });
  }
}
console.log('series', series.length);
const R = (a, b) => dot(a.z, b.z);
const use = new Map(); const asTarget = new Set();
const sets = [];
let tries = 0;
while (sets.length < 216 && tries++ < 400000) {
  const a = series[ri(series.length)];
  if ((use.get(a.key) || 0) >= 2 || asTarget.has(a.key)) continue;
  const b = series[ri(series.length)];
  if (b === a || a.ind === b.ind || a.cc === b.cc || (use.get(b.key) || 0) >= 2 || asTarget.has(b.key)) continue;
  const r = R(a, b);
  if (r < 0.93 || r > 0.995) continue;
  if (Math.abs(a.rt) < 0.5 || Math.abs(b.rt) < 0.5) continue; // both genuinely trending: a "spurious" pair
  const sign = Math.sign(a.rt);
  const grp = [a, b];
  const ok = (c, extra = []) => !grp.some((g) => g.ind === c.ind || g.cc === c.cc) && (use.get(c.key) || 0) < 2 && !asTarget.has(c.key)
    && grp.every((g) => { const x = R(g, c); return x < 0.8 && x > -0.9; });
  const pool = shuffle(series.slice(0, series.length));
  const wantLook = 2 + (rnd() < 0.5 ? 1 : 0);
  for (const c of pool) { if (grp.length >= 2 + wantLook) break; if (Math.sign(c.rt) === sign && Math.abs(c.rt) > 0.6 && ok(c)) grp.push(c); }
  for (const c of pool) { if (grp.length >= 6) break; if (ok(c)) grp.push(c); }
  if (grp.length < 6) continue;
  const look = grp.slice(2).filter((c) => Math.sign(c.rt) === sign && Math.abs(c.rt) > 0.6).length;
  let maxDecoy = -1;
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) if (!(i < 2 && j < 2)) maxDecoy = Math.max(maxDecoy, R(grp[i], grp[j]));
  const difficulty = maxDecoy * 3 + look * 0.4 - (r - 0.93) * 4;
  grp.forEach((g) => use.set(g.key, (use.get(g.key) || 0) + 1)); asTarget.add(a.key); asTarget.add(b.key);
  const order = shuffle([0, 1, 2, 3, 4, 5]);
  sets.push({ s: order.map((i) => grp[i].key), t: [order.indexOf(0), order.indexOf(1)].sort(), r: +r.toFixed(3), d: +difficulty.toFixed(2) });
}
console.log('sets', sets.length, 'tries', tries);
// tertiles by difficulty -> puzzle k = [easy_k, medium_k, hard_k]
sets.sort((x, y) => x.d - y.d);
const n3 = Math.floor(sets.length / 3);
const puzzles = Array.from({ length: n3 }, (_, k) => [k, n3 + k, 2 * n3 + k]);
shuffle(puzzles);
const used = sets.slice(0, n3 * 3);
const need = new Set(used.flatMap((s) => s.s));
const lib = {};
for (const k of need) lib[k] = series.find((x) => x.key === k).v;
const ccs = [...new Set([...need].map((k) => k.split('|')[1]))].sort();
const ccNames = Object.fromEntries(ccs.map((cc) => [cc, { n: enName(countries.get(cc).iso2Code, countries.get(cc).name) }]));
const out = { years: YEARS, ind: IND, countries: ccNames, lib, sets: used, puzzles };
fs.writeFileSync(here('../data.json'), JSON.stringify(out));
console.log('puzzles', puzzles.length, 'lib', Object.keys(lib).length, fs.statSync(here('../data.json')).size, 'bytes');
