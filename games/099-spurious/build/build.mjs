// raw World Bank series -> data.json: sets of 6 series where exactly one pair has r > 0.9.
import fs from 'node:fs';
import { IND } from './fetch.mjs';
const YEARS = Array.from({ length: 23 }, (_, i) => 2000 + i);
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const countries = new Map(JSON.parse(fs.readFileSync('raw/countries.json'))[1].filter((c) => c.region.id !== 'NA').map((c) => [c.id, c]));
const byIso3 = new Map([...countries.values()].map((c) => [c.id, c.name]));
const iso2 = new Map([...countries.values()].map((c) => [c.id, c.iso2Code]));
const series = [];
for (const id of Object.keys(IND)) {
  const rows = JSON.parse(fs.readFileSync(`raw/${id}.json`))[1] || [];
  const m = new Map();
  for (const r of rows) { if (!byIso3.has(r.countryiso3code)) continue; (m.get(r.countryiso3code) || m.set(r.countryiso3code, {}).get(r.countryiso3code))[r.date] = r.value; }
  for (const [cc, o] of m) {
    const v = YEARS.map((y) => o[y]);
    if (v.some((x) => x == null)) continue;
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
    if (sd < 1e-9 || sd / (Math.abs(mean) + 1e-9) < 0.02) continue; // flat
    series.push({ ind: id, cc, v });
  }
}
const corr = (a, b) => { const n = a.length, ma = a.reduce((x, y) => x + y) / n, mb = b.reduce((x, y) => x + y) / n; let s = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++) { s += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; } return s / Math.sqrt(sa * sb); };
console.log('series', series.length);
const sets = [], used = new Set();
const ri = (n) => Math.floor(rnd() * n);
let tries = 0;
while (sets.length < 200 && tries++ < 200000) {
  const a = series[ri(series.length)], b = series[ri(series.length)];
  if (a.ind === b.ind || a.cc === b.cc) continue;
  const r = corr(a.v, b.v);
  if (r < 0.9 || r > 0.995) continue;
  const grp = [a, b];
  let guard = 0;
  while (grp.length < 6 && guard++ < 400) {
    const c = series[ri(series.length)];
    if (grp.some((g) => g.ind === c.ind || (g.cc === c.cc && rnd() < 0.8))) continue;
    if (grp.every((g) => Math.abs(corr(g.v, c.v)) < 0.7)) grp.push(c);
  }
  if (grp.length < 6) continue;
  const key = `${a.ind}${a.cc}${b.ind}${b.cc}`;
  if (used.has(key)) continue; used.add(key);
  // shuffle, record target indices
  const order = grp.map((g, i) => [rnd(), i]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const items = order.map((i) => grp[i]);
  sets.push({ s: items.map((g) => `${g.ind}|${g.cc}`), t: [order.indexOf(0), order.indexOf(1)].sort(), r: +r.toFixed(3) });
}
const need = new Set(sets.flatMap((s) => s.s));
const lib = {};
for (const k of need) { const [ind, cc] = k.split('|'); const s = series.find((x) => x.ind === ind && x.cc === cc); lib[k] = s.v.map((x) => +Number(x.toPrecision(4))); }
const ccNames = Object.fromEntries([...need].map((k) => k.split('|')[1]).map((cc) => [cc, { n: byIso3.get(cc), c2: iso2.get(cc) }]));
const out = { years: YEARS, ind: IND, countries: ccNames, lib, sets };
fs.writeFileSync('../data.json', JSON.stringify(out));
console.log('sets', sets.length, 'lib', Object.keys(lib).length, fs.statSync('../data.json').size);
