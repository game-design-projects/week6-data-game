#!/usr/bin/env node
// Builds data.json for Holiday from Nager.Date (run build/fetch.sh first) + GeoNames capitals.
//   ./build/fetch.sh 2026 && node build/build.mjs 2026
import { readFile, writeFile, readdir } from 'node:fs/promises';

const YEAR = process.argv[2] ?? '2026';
const here = new URL('.', import.meta.url);
const raw = (f) => readFile(new URL(`raw/${f}`, here), 'utf8');

const capitals = new Map();
for (const l of (await raw('cities15000.txt')).split('\n')) {
  const c = l.split('\t');
  if (c[7] === 'PPLC' && !capitals.has(c[8])) capitals.set(c[8], { name: c[2], lat: +(+c[4]).toFixed(3), lng: +(+c[5]).toFixed(3) });
}
const names = new Map(JSON.parse(await raw('countries.json')).map((c) => [c.countryCode, c.name]));

const countries = [];
for (const f of (await readdir(new URL('raw/holidays/', here))).filter((f) => f.startsWith(YEAR))) {
  const cc = f.slice(5, 7);
  const list = JSON.parse(await raw(`holidays/${f}`));
  const byDate = new Map();
  for (const x of list) {
    const k = x.date.slice(5);
    if (!byDate.has(k)) byDate.set(k, { d: k, name: x.name, local: x.localName, global: x.global !== false });
    else if (x.global !== false) byDate.get(k).global = true;
  }
  const hol = [...byDate.values()].sort((a, b) => (a.d < b.d ? -1 : 1));
  const cap = capitals.get(cc);
  if (hol.length < 5 || !cap) continue;
  countries.push({ cc, name: names.get(cc) ?? cc, capital: cap, holidays: hol });
}
// how many countries share each (English) holiday name → used to order clues from generic to specific
const freq = new Map();
for (const c of countries) for (const n of new Set(c.holidays.map((h) => h.name.toLowerCase()))) freq.set(n, (freq.get(n) ?? 0) + 1);
for (const c of countries) for (const h of c.holidays) h.common = freq.get(h.name.toLowerCase());

await writeFile(new URL('../data.json', here), JSON.stringify({ year: +YEAR, source: 'Nager.Date v3 + GeoNames', countries }));
console.log(`holiday: ${countries.length} countries`);
