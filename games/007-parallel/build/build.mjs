// raw GeoNames cities15000 -> data.json (pool of puzzles, 3 rounds each)
import fs from 'node:fs';
const raw = fs.readFileSync(new URL('./raw/cities15000.txt', import.meta.url), 'utf8').trim().split('\n').map((l) => l.split('\t'));
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const shuf = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const seen = new Set();
const cities = raw.map((c) => ({ name: c[2] || c[1], cc: c[8], pop: +c[14], lat: +(+c[4]).toFixed(2), lng: +(+c[5]).toFixed(2) }))
  .filter((c) => c.pop >= 1_000_000).sort((a, b) => b.pop - a.pop)
  .filter((c) => !seen.has(c.name) && seen.add(c.name));
console.log('cities', cities.length);
const famous = cities.filter((c) => c.pop >= 2_500_000);
const far = (a, b) => Math.abs(a.lng - b.lng) >= 50;
function round() {
  for (;;) {
    const ref = famous[Math.floor(rnd() * famous.length)];
    if (Math.abs(ref.lat) > 60) continue;
    const near = shuf(cities.filter((c) => c !== ref && Math.abs(c.lat - ref.lat) >= 0.4 && Math.abs(c.lat - ref.lat) <= 6 && far(c, ref)));
    const any = shuf(cities.filter((c) => c !== ref && Math.abs(c.lat - ref.lat) >= 0.4 && Math.abs(c.lat - ref.lat) <= 25));
    if (near.length < 2) continue;
    const set = [...near.slice(0, 2), ...any.filter((c) => !near.slice(0, 2).includes(c)).slice(0, 3)];
    const lats = set.map((c) => c.lat);
    if (new Set(lats).size < 5) continue;
    const n = set.filter((c) => c.lat > ref.lat).length;
    if (n < 1 || n > 4) continue;
    return { ref, cands: shuf(set) };
  }
}
const puzzles = Array.from({ length: 80 }, () => ({ rounds: [round(), round(), round()] }));
const out = { puzzles };
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out));
console.log(fs.statSync(new URL('../data.json', import.meta.url)).size);
