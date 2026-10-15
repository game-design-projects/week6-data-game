#!/usr/bin/env node
// Builds data.json for Great Circle from GeoNames cities15000 (+ countryInfo).
// Raw downloads are cached in build/raw/ (git-ignored); re-runs parse from disk.
// Pairs may cross the antimeridian: b.lng is stored "unwrapped" (a.lng < b.lng <= a.lng+170, may exceed 180).
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { haversineKm } from '../../../engine/core.js';
import { gcPoints, areaBetween, rhumbPoints, vertex } from '../game.js';

const here = new URL('.', import.meta.url);
const rawDir = new URL('raw/', here);
await mkdir(rawDir, { recursive: true });
const exists = (u) => access(u).then(() => true, () => false);
if (!(await exists(new URL('cities15000.txt', rawDir)))) {
  const p = new URL('cities15000.zip', rawDir).pathname;
  execFileSync('curl', ['-sSfL', '-A', 'daily-data-games/1.0', '-o', p, 'https://download.geonames.org/export/dump/cities15000.zip']);
  execFileSync('unzip', ['-o', p, '-d', new URL(rawDir).pathname]);
}
if (!(await exists(new URL('countryInfo.txt', rawDir)))) {
  execFileSync('curl', ['-sSfL', '-A', 'daily-data-games/1.0', '-o', new URL('countryInfo.txt', rawDir).pathname, 'https://download.geonames.org/export/dump/countryInfo.txt']);
}
const raw = (f) => readFile(new URL(f, rawDir), 'utf8');

const countries = new Map();
for (const l of (await raw('countryInfo.txt')).split('\n')) { if (!l || l.startsWith('#')) continue; const c = l.split('\t'); countries.set(c[0], c[4]); }

const cities = [];
for (const l of (await raw('cities15000.txt')).split('\n').filter(Boolean)) {
  const c = l.split('\t');
  const pop = +c[14];
  if (pop >= 1_500_000 || (c[7] === 'PPLC' && pop >= 300_000)) cities.push({ name: c[2], cc: c[8], country: countries.get(c[8]) ?? c[8], lat: +(+c[4]).toFixed(3), lng: +(+c[5]).toFixed(3), pop });
}
cities.sort((a, b) => b.pop - a.pop || a.name.localeCompare(b.name));
const top = cities.slice(0, 260);

/** mean Mercator gap between the straight map line and the great circle (deg, same measure the game scores with) + vertex */
function geom(a, b) {
  const gc = gcPoints(a, b);
  const { mean } = areaBetween(rhumbPoints(a, b), gc, a.lng, b.lng);
  const v = vertex(gc);
  return { gap: mean, vtx: v[0], vlng: v[1] };
}

const cand = [];
for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) {
  let a = top[i], b = top[j];
  if (a.cc === b.cc) continue;
  let dl = ((b.lng - a.lng + 540) % 360) - 180;       // shortest signed east-west offset
  if (dl < 0) { [a, b] = [b, a]; dl = -dl; }
  if (dl < 25 || dl > 170) continue;                  // not near-meridional, not near-antipodal
  const bu = { ...b, lng: +(a.lng + dl).toFixed(3) };  // unwrapped
  const km = haversineKm(a, bu);
  if (km < 3500 || km > 13500 || Math.abs(a.lat) > 72 || Math.abs(b.lat) > 72) continue;
  const g = geom(a, bu);
  if (g.gap < 3 || g.gap > 30 || Math.abs(g.vtx) > 75) continue;    // flat routes are not interesting; keep the arc on the map
  cand.push({ a, b: bu, km: Math.round(km), gap: +g.gap.toFixed(2), vtx: +g.vtx.toFixed(1), vlng: +g.vlng.toFixed(1) });
}
// deterministic pseudo-random order (LCG), each city at most 2 times
let seed = 9; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
cand.sort((p, q) => (p.a.name + p.b.name).localeCompare(q.a.name + q.b.name));
for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
const use = new Map(); const pairs = [];
const f = ({ name, country, lat, lng }) => ({ name, country, lat, lng });
for (const p of cand) {
  const ka = p.a.name + p.a.cc, kb = p.b.name + p.b.cc;
  if ((use.get(ka) ?? 0) >= 2 || (use.get(kb) ?? 0) >= 2) continue;
  use.set(ka, (use.get(ka) ?? 0) + 1); use.set(kb, (use.get(kb) ?? 0) + 1);
  pairs.push({ a: f(p.a), b: f(p.b), km: p.km, gap: p.gap, vtx: p.vtx, vlng: p.vlng });
  if (pairs.length >= 120) break;
}
await writeFile(new URL('../data.json', here), JSON.stringify({ source: 'GeoNames cities15000 + countryInfo', built: new Date().toISOString().slice(0, 10), pairs }));
console.log(`great-circle: ${pairs.length} pairs from ${cand.length} candidates; gap`, Math.min(...pairs.map((p) => p.gap)), Math.max(...pairs.map((p) => p.gap)), '; antimeridian:', pairs.filter((p) => p.b.lng > 180).length);
