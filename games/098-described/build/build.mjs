// raw/cands*.json (Wikimedia Commons geosearch) + describe.mjs (hand-written descriptions) -> ../data.json
// Run order: node fetch.mjs && node dl.mjs && node 098-fetch2.mjs && node 098-cands2.mjs  (all cached in raw/), then node build.mjs
import fs from 'node:fs'; import path from 'node:path';
import { E } from './describe.mjs';
const dir = path.dirname(new URL(import.meta.url).pathname);
const load = (f) => JSON.parse(fs.readFileSync(path.join(dir, 'raw', f)));
const pools = { 1: load('cands.json'), 2: load('cands2.json') };
const puzzles = E.map((e) => {
  const x = pools[e.src][e.idx];
  if (!x) throw new Error(`no candidate ${e.src}/${e.idx}`);
  if (e.city && e.city !== x.city) throw new Error(`city mismatch ${e.src}/${e.idx}: ${e.city} vs ${x.city}`);
  const o = { id: e.src * 1000 + e.idx, city: x.city, cityZh: e.cityZh, country: e.c, lat: +x.lat.toFixed(4), lng: +x.lng.toFixed(4),
    desc: e.desc, signs: e.signs ?? null, why: e.why, img: x.thumb, page: x.page, title: x.title, artist: x.artist || '未知作者', lic: x.lic };
  return o;
});
const out = JSON.stringify({ built: '2026-10-15', puzzles });
fs.writeFileSync(path.join(dir, '../data.json'), out);
console.log(puzzles.length, 'puzzles,', new Set(puzzles.map((p) => p.city)).size, 'cities,', out.length, 'bytes');
