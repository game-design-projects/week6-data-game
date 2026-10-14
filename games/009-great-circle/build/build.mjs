#!/usr/bin/env node
// Builds data.json for Great Circle from GeoNames cities15000.
//   curl -o build/raw/cities15000.zip https://download.geonames.org/export/dump/cities15000.zip && unzip -o build/raw/cities15000.zip -d build/raw
//   curl -o build/raw/countryInfo.txt https://download.geonames.org/export/dump/countryInfo.txt
import { readFile, writeFile } from 'node:fs/promises';
import { haversineKm } from '../../../engine/core.js';

const here = new URL('.', import.meta.url);
const raw = (f) => readFile(new URL(`raw/${f}`, here), 'utf8');
const countries = new Map();
for (const l of (await raw('countryInfo.txt')).split('\n')) { if (!l || l.startsWith('#')) continue; const c = l.split('\t'); countries.set(c[0], c[4]); }
const merc = (lat) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;

const cities = [];
for (const l of (await raw('cities15000.txt')).split('\n').filter(Boolean)) {
  const c = l.split('\t');
  const pop = +c[14];
  if (pop >= 1_500_000 || (c[7] === 'PPLC' && pop >= 300_000)) cities.push({ name: c[2], cc: c[8], country: countries.get(c[8]) ?? c[8], lat: +(+c[4]).toFixed(3), lng: +(+c[5]).toFixed(3), pop });
}
cities.sort((a, b) => b.pop - a.pop);
const top = cities.slice(0, 220);

// mean Mercator gap between rhumb (straight) and great circle, in degrees
function gap(a, b) {
  const la = (a.lat * Math.PI) / 180, lb = (b.lat * Math.PI) / 180, dl = ((b.lng - a.lng) * Math.PI) / 180;
  const d = Math.acos(Math.min(1, Math.sin(la) * Math.sin(lb) + Math.cos(la) * Math.cos(lb) * Math.cos(dl)));
  let s = 0; const N = 60;
  for (let i = 0; i <= N; i++) {
    const f = i / N, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(la) * 1 + B * Math.cos(lb) * Math.cos(dl), y = B * Math.cos(lb) * Math.sin(dl), z = A * Math.sin(la) + B * Math.sin(lb);
    const lat = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI;
    s += Math.abs(merc(lat) - (merc(a.lat) + f * (merc(b.lat) - merc(a.lat))));
  }
  return s / (N + 1);
}

const cand = [];
for (let i = 0; i < top.length; i++) for (let j = 0; j < top.length; j++) {
  const a = top[i], b = top[j];
  if (a.lng >= b.lng || b.lng - a.lng > 170 || a.cc === b.cc) continue; // west->east, no antimeridian crossing
  const km = haversineKm(a, b);
  if (km < 3500 || km > 13000 || Math.abs(a.lat) > 75 || Math.abs(b.lat) > 75) continue;
  // linear x-span must be well-defined: avoid near-meridional routes
  if (b.lng - a.lng < 25) continue;
  const g = gap(a, b);
  if (g < 2.5) continue; // too flat to be interesting
  cand.push({ a, b, km: Math.round(km), gap: +g.toFixed(2) });
}
// deterministic shuffle-ish selection: spread across cities, each city at most 3 times
let seed = 9; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
cand.sort(() => rnd() - 0.5);
const use = new Map(); const pairs = [];
for (const p of cand) {
  const ka = p.a.name + p.a.cc, kb = p.b.name + p.b.cc;
  if ((use.get(ka) ?? 0) >= 3 || (use.get(kb) ?? 0) >= 3) continue;
  use.set(ka, (use.get(ka) ?? 0) + 1); use.set(kb, (use.get(kb) ?? 0) + 1);
  const f = ({ name, country, lat, lng }) => ({ name, country, lat, lng });
  pairs.push({ a: f(p.a), b: f(p.b), km: p.km, gap: p.gap });
  if (pairs.length >= 100) break;
}
await writeFile(new URL('../data.json', here), JSON.stringify({ source: 'GeoNames cities15000 + countryInfo', built: new Date().toISOString().slice(0, 10), pairs }));
console.log(`great-circle: ${pairs.length} pairs from ${cand.length} candidates; gap range`, Math.min(...pairs.map((p) => p.gap)), Math.max(...pairs.map((p) => p.gap)));
