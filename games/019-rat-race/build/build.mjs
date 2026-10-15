// raw monthly counts -> ../data.json. Run from build/: node build.mjs
import fs from 'node:fs';
const rd = (f) => JSON.parse(fs.readFileSync(`raw/${f}.json`, 'utf8'));
const fail = rd('fail_m'), all = rd('all_m'), boro = rd('boro');
const MIN_INSP = 60;     // a zip-month needs this many conclusive inspections
const MIN_ZIPS = 30;     // a month needs this many such zips to be playable
const LAST = '2026-09';  // later months are still being filled in
const bshort = { Manhattan: 'Manhattan', Brooklyn: 'Brooklyn', Queens: 'Queens', Bronx: 'Bronx', 'Staten Island': 'Staten Island' };
const best = {};
for (const r of boro) if (/^1\d{4}$/.test(r.zip_code) && bshort[r.borough] && (!best[r.zip_code] || +r.n > best[r.zip_code].n)) best[r.zip_code] = { b: bshort[r.borough], n: +r.n };
const tot = {};
for (const r of all) tot[`${r.zip_code}|${r.m.slice(0, 7)}`] = +r.n;
const months = {};
for (const r of fail) {
  const m = r.m.slice(0, 7), t = tot[`${r.zip_code}|${m}`];
  if (m > LAST || !best[r.zip_code] || !t || t < MIN_INSP) continue;
  (months[m] ||= []).push([r.zip_code, +r.n, t]);
}
const usedZips = new Set();
for (const m of Object.keys(months)) {
  if (months[m].length < MIN_ZIPS) { delete months[m]; continue; }
  months[m].sort((a, b) => a[0].localeCompare(b[0]));
  months[m].forEach((r) => usedZips.add(r[0]));
}
const boros = {};
for (const z of [...usedZips].sort()) boros[z] = best[z].b;
fs.writeFileSync('../data.json', JSON.stringify({ months, boros }));
console.log(Object.keys(months).length, 'months,', usedZips.size, 'zips,', fs.statSync('../data.json').size, 'bytes');
