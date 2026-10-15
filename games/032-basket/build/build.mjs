// raw BLS average-price files -> data.json (annual means + pre-verified puzzles)
import fs from 'node:fs';
import path from 'node:path';
import { solveExact } from '../solve.mjs';
const here = path.dirname(new URL(import.meta.url).pathname);
const raw = (f) => fs.readFileSync(path.join(here, 'raw', f), 'utf8').split('\n').slice(1);

const ITEMS = {
  702111: ['White bread', 'lb', '🍞'], 708111: ['Eggs, large grade A', 'dozen', '🥚'], 706111: ['Whole chicken', 'lb', '🐔'],
  711211: ['Bananas', 'lb', '🍌'], 701111: ['Flour', 'lb', '🌾'], 701312: ['Long-grain rice', 'lb', '🍚'],
  703111: ['Ground chuck', 'lb', '🥩'], 704111: ['Bacon', 'lb', '🥓'], 704211: ['Bone-in pork chops', 'lb', '🍖'],
  715211: ['White sugar', 'lb', '🍬'], 717311: ['Ground coffee', 'lb', '☕'], 712311: ['Tomatoes', 'lb', '🍅'],
  713111: ['Frozen orange juice concentrate', '16 oz', '🧃'], 706212: ['Chicken legs', 'lb', '🍗'], 718311: ['Potato chips', 'lb', '🍟'],
  710212: ['Cheddar cheese', 'lb', '🧀'],
  709112: ['Whole milk', 'gallon', '🥛'], 710111: ['Butter', 'lb', '🧈'], 712112: ['White potatoes', 'lb', '🥔'],
  711311: ['Navel oranges', 'lb', '🍊'], 711111: ['Red Delicious apples', 'lb', '🍎'], 716141: ['Peanut butter', 'lb', '🥜'], 712211: ['Iceberg lettuce', 'lb', '🥬'],
};
const m = {};
for (const f of ['ap.data.0.Current', 'ap.data.3.Food']) for (const r of raw(f)) {
  const [s, y, p, v] = r.split('\t').map((x) => x.trim());
  if (!s || !s.startsWith('APU0000') || p === 'M13') continue;
  const id = s.slice(7); if (!ITEMS[id]) continue;
  ((m[id] ??= {})[y] ??= {})[p] = +v;
}
const prices = {};
for (const id of Object.keys(ITEMS)) {
  prices[id] = {};
  for (const [y, ms] of Object.entries(m[id] || {})) {
    const v = Object.values(ms);
    if (v.length >= 12 && v.every((x) => x > 0)) prices[id][y] = Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100); // cents
  }
}
const years = [];
for (let y = 1984; y <= 2025; y++) if (Object.keys(ITEMS).filter((id) => prices[id][y]).length >= 12) years.push(y);

// seeded LCG so the build is reproducible
let seed = 32; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const puzzles = [];
for (const y of years) {
  const avail = Object.keys(ITEMS).filter((id) => prices[id][y]);
  let made = 0, tries = 0;
  while (made < 3 && tries++ < 400) {
    const pick = avail.slice().sort(() => rnd() - 0.5).slice(0, 8);
    const cents = pick.map((id) => prices[id][y]);
    const r = solveExact(cents, 2000, 10, 4);
    if (r.count >= 40 && r.count <= 5000 && !puzzles.some((p) => p.year === y && p.items.slice().sort().join() === pick.slice().sort().join())) {
      puzzles.push({ year: y, items: pick, sol: r.example, n: r.count });
      made++;
    }
  }
}
const keep = Object.fromEntries(Object.entries(ITEMS).map(([id, [name, unit, emoji]]) => [id, { name, unit, emoji, p: prices[id] }]));
fs.writeFileSync(path.join(here, '..', 'data.json'), JSON.stringify({ budget: 2000, maxQty: 10, minKinds: 4, items: keep, puzzles }));
console.log('years', years.length, 'puzzles', puzzles.length);
