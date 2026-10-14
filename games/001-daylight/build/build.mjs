#!/usr/bin/env node
// Builds data.json for Daylight from GeoNames.
//   curl -o build/raw/cities15000.zip https://download.geonames.org/export/dump/cities15000.zip && unzip -o build/raw/cities15000.zip -d build/raw
//   curl -o build/raw/countryInfo.txt https://download.geonames.org/export/dump/countryInfo.txt
//   node build/build.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { haversineKm } from '../../../engine/core.js';

const here = new URL('.', import.meta.url);
const raw = (f) => readFile(new URL(`raw/${f}`, here), 'utf8');

const countries = new Map();
for (const line of (await raw('countryInfo.txt')).split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const c = line.split('\t');
  countries.set(c[0], c[4]);
}

const rows = (await raw('cities15000.txt')).split('\n').filter(Boolean).map((l) => l.split('\t'));
const picked = rows
  .map((c) => ({ name: c[2], country: countries.get(c[8]) ?? c[8], cc: c[8], lat: +c[4], lng: +c[5], tz: c[17], pop: +c[14], code: c[7] }))
  .filter((c) => c.tz && (c.pop >= 1_000_000 || (c.code === 'PPLC' && c.pop >= 100_000)))
  .sort((a, b) => b.pop - a.pop);

// drop cities within 150 km of a bigger one: their curves would be near-identical
const cities = [];
for (const c of picked) if (!cities.some((k) => haversineKm(k, c) < 150)) cities.push(c);

const out = cities.map(({ name, country, cc, lat, lng, tz, pop }) => ({ name, country, cc, lat: +lat.toFixed(4), lng: +lng.toFixed(4), tz, pop }));
await writeFile(new URL('../data.json', here), JSON.stringify({ source: 'GeoNames cities15000 + countryInfo', built: new Date().toISOString().slice(0, 10), cities: out }));
console.log(`daylight: ${out.length} cities (from ${picked.length} candidates)`);
