// raw BLS average-price files -> data.json (annual means + pre-verified puzzles)
import fs from 'node:fs';
import path from 'node:path';
import { solveExact } from '../solve.mjs';
const here = path.dirname(new URL(import.meta.url).pathname);
const raw = (f) => fs.readFileSync(path.join(here, 'raw', f), 'utf8').split('\n').slice(1);

const ITEMS = {
  702111: ['白面包', '磅', '🍞'], 708111: ['鸡蛋（大号 A 级）', '打', '🥚'], 706111: ['整鸡', '磅', '🐔'],
  711211: ['香蕉', '磅', '🍌'], 701111: ['面粉', '磅', '🌾'], 701312: ['长粒米', '磅', '🍚'],
  703111: ['牛肩绞肉', '磅', '🥩'], 704111: ['培根', '磅', '🥓'], 704211: ['带骨猪排', '磅', '🍖'],
  715211: ['白砂糖', '磅', '🍬'], 717311: ['研磨咖啡', '磅', '☕'], 712311: ['番茄', '磅', '🍅'],
  713111: ['冷冻橙汁浓缩', '16 盎司', '🧃'], 706212: ['鸡腿', '磅', '🍗'], 718311: ['薯片', '磅', '🍟'],
  710212: ['切达奶酪', '磅', '🧀'],
  709112: ['全脂牛奶', '加仑', '🥛'], 710111: ['黄油', '磅', '🧈'], 712112: ['白土豆', '磅', '🥔'],
  711311: ['脐橙', '磅', '🍊'], 711111: ['红蛇果苹果', '磅', '🍎'], 716141: ['花生酱', '磅', '🥜'], 712211: ['结球生菜', '磅', '🥬'],
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
