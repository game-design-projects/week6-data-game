import fs from 'node:fs'; import path from 'node:path';
import { D } from './describe.mjs';
const dir = path.dirname(new URL(import.meta.url).pathname);
const c = JSON.parse(fs.readFileSync(path.join(dir, 'raw/cands.json')));
const puzzles = Object.entries(D).map(([i, d]) => {
  const x = c[+i];
  return { id: +i, city: x.city, country: d.c, lat: +x.lat.toFixed(4), lng: +x.lng.toFixed(4), desc: d.desc, signs: d.signs ?? null, why: d.why,
    img: x.thumb, page: x.page, title: x.title, artist: x.artist, lic: x.lic };
});
fs.writeFileSync(path.join(dir, '../data.json'), JSON.stringify({ built: '2026-10-14', puzzles }));
console.log(puzzles.length, new Set(puzzles.map((p) => p.city)).size);
