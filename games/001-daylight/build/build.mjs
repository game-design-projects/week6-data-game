#!/usr/bin/env node
// Builds data.json for Daylight from GeoNames (downloads into build/raw/ when missing).
//   node build/build.mjs
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { haversineKm } from '../../../engine/core.js';

const here = new URL('.', import.meta.url);
const rawPath = (f) => new URL(`raw/${f}`, here);
const exists = (u) => access(u).then(() => true, () => false);
const UA = { 'user-agent': 'week6-daily-data-build/1.0 (class project)' };

async function ensure(file, url) {
  if (await exists(rawPath(file))) return;
  console.log('daylight: downloading', url);
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  await writeFile(rawPath(file), Buffer.from(await res.arrayBuffer()));
}
await mkdir(rawPath(''), { recursive: true });
await ensure('countryInfo.txt', 'https://download.geonames.org/export/dump/countryInfo.txt');
if (!(await exists(rawPath('cities15000.txt')))) {
  await ensure('cities15000.zip', 'https://download.geonames.org/export/dump/cities15000.zip');
  execFileSync('unzip', ['-o', new URL('raw/cities15000.zip', here).pathname, '-d', new URL('raw/', here).pathname]);
}
const raw = (f) => readFile(rawPath(f), 'utf8');

const countries = new Map();
for (const line of (await raw('countryInfo.txt')).split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const c = line.split('\t');
  countries.set(c[0], c[4]);
}

const validTz = (tz) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };

const rows = (await raw('cities15000.txt')).split('\n').filter(Boolean).map((l) => l.split('\t'));
const picked = rows
  .map((c) => ({ name: c[2], country: countries.get(c[8]) ?? c[8], cc: c[8], lat: +c[4], lng: +c[5], tz: c[17], pop: +c[14], code: c[7] }))
  .filter((c) => c.tz && validTz(c.tz) && Number.isFinite(c.lat) && Number.isFinite(c.lng) && (c.pop >= 1_000_000 || (c.code === 'PPLC' && c.pop >= 100_000)))
  .sort((a, b) => b.pop - a.pop);

// drop cities within 150 km of a bigger one: their curves would be near-identical
const cities = [];
for (const c of picked) if (!cities.some((k) => haversineKm(k, c) < 150)) cities.push(c);

const out = cities.map(({ name, country, cc, lat, lng, tz, pop }) => ({ name, country, cc, lat: +lat.toFixed(4), lng: +lng.toFixed(4), tz, pop }));
await writeFile(new URL('../data.json', here), JSON.stringify({ source: 'GeoNames cities15000 + countryInfo', built: new Date().toISOString().slice(0, 10), cities: out }));
console.log(`daylight: ${out.length} cities (from ${picked.length} candidates)`);
