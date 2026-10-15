// raw GeoNames cities15000 + Wikidata zh labels -> data.json (pool of 90 puzzles, 3 rounds each, easy -> hard)
import fs from 'node:fs';
const here = (p) => new URL(p, import.meta.url);
const rows = fs.readFileSync(here('./raw/cities15000.txt'), 'utf8').trim().split('\n').map((l) => l.split('\t'));
const wd = JSON.parse(fs.readFileSync(here('./raw/wd-zh.json'), 'utf8')).results.bindings;
const han = /^[一-鿿·]+$/;
const zhById = new Map();
for (const b of wd) {
  const v = [b.l?.value, b.c?.value, b.z?.value].find((s) => s && han.test(s));
  if (v) zhById.set(b.g.value, v);
}
const regions = new Intl.DisplayNames(['zh-Hans'], { type: 'region' });
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const shuf = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const seen = new Set();
const cities = rows.map((c) => ({ id: c[0], name: zhById.get(c[0]), en: c[2] || c[1], cc: c[8], pop: +c[14], lat: +(+c[4]).toFixed(2), lng: +(+c[5]).toFixed(2) }))
  .filter((c) => c.pop >= 1_500_000 && c.name && c.name.length <= 6).sort((a, b) => b.pop - a.pop)
  .filter((c) => !seen.has(c.name) && seen.add(c.name))
  .map(({ id, ...c }) => ({ ...c, country: regions.of(c.cc) }));
console.log('cities with zh name', cities.length, 'countries', new Set(cities.map((c) => c.cc)).size);
const famous = cities.filter((c) => c.pop >= 3_000_000 && Math.abs(c.lat) < 62);
// level 0 easy (every gap >= 3 deg), 1 medium, 2 hard (two cities within 2.5 deg, gaps >= 0.4)
const LEVELS = [{ minGap: 3, near: [3, 9] }, { minGap: 1.2, near: [1.2, 4] }, { minGap: 0.4, near: [0.4, 2.5] }];
const pub = (c) => ({ name: c.name, en: c.en, cc: c.cc, country: c.country, lat: c.lat, lng: c.lng });
function round(level, used) {
  const L = LEVELS[level];
  for (let t = 0; t < 5000; t++) {
    const ref = famous[Math.floor(rnd() * famous.length)];
    if (used.has(ref.name)) continue;
    const d = (c) => Math.abs(c.lat - ref.lat);
    const ok = cities.filter((c) => c !== ref && c.cc !== ref.cc && !used.has(c.name) && d(c) >= 0.4 && d(c) <= 30);
    const near = shuf(ok.filter((c) => d(c) >= L.near[0] && d(c) <= L.near[1] && Math.abs(c.lng - ref.lng) >= 40));
    if (near.length < 2) continue;
    const second = near.find((c) => c.cc !== near[0].cc);
    if (!second) continue;
    const set = [near[0], second];
    for (const c of shuf(ok.filter((c) => d(c) >= L.minGap))) {
      if (set.length === 5) break;
      if (!set.some((s) => s.cc === c.cc || s === c)) set.push(c);
    }
    if (set.length < 5) continue;
    // all pairwise gaps (incl. ref) >= minGap except the designed near ones keep >= 0.4
    const lats = set.map((c) => c.lat);
    if (new Set(lats).size < 5) continue;
    const n = set.filter((c) => c.lat > ref.lat).length;
    if (n < 1 || n > 4) continue;
    if (level === 0 && set.some((c) => d(c) < 3)) continue;
    [ref, ...set].forEach((c) => used.add(c.name));
    return { ref: pub(ref), cands: shuf(set).map(pub) };
  }
  throw new Error('no round');
}
const puzzles = Array.from({ length: 90 }, () => { const used = new Set(); return { rounds: [0, 1, 2].map((l) => round(l, used)) }; });
fs.writeFileSync(here('../data.json'), JSON.stringify({ puzzles }));
console.log('bytes', fs.statSync(here('../data.json')).size);
