// Step 3: raw hourly lines -> data.json. Per-article hourly counts are too small to be smooth, so each
// puzzle sums a seeded random "basket" of ~half of the 73 game articles per language edition.
import fs from 'node:fs';
const DAY = process.argv[2] || '20260915';
const LANGS = ['en', 'ru', 'ja', 'es', 'fr', 'zh', 'de', 'pt', 'it']; // editions with enough traffic
const SEP = 1.5; // min circular distance (h) between smoothed peaks in one puzzle
const raw = {}; // game -> lang -> [24]
for (let h = 0; h < 24; h++) {
  for (const line of fs.readFileSync(`raw/h-${DAY}-${String(h).padStart(2, '0')}.tsv`, 'utf8').split('\n')) {
    if (!line) continue;
    const [k, v] = line.split('\t');
    const [g, l] = k.split('|');
    if (!LANGS.includes(l)) continue;
    ((raw[g] ??= {})[l] ??= new Array(24).fill(0))[h] += Number(v);
  }
}
const games = Object.keys(raw).sort();
const circ = (a, b) => { const d = Math.abs(a - b) % 24; return Math.min(d, 24 - d); };
const peak = (c) => { let best = 0, bi = 0; for (let i = 0; i < 24; i++) { const s = c[(i + 23) % 24] + c[i] + c[(i + 1) % 24]; if (s > best) { best = s; bi = i; } } return bi + 0.5; };
let seed = 30;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuf = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const puzzles = [], seen = new Set();
for (let tries = 0; tries < 4000 && puzzles.length < 90; tries++) {
  const basket = shuf(games).slice(0, 36).sort();
  const sums = {};
  for (const l of LANGS) { const c = new Array(24).fill(0); for (const g of basket) raw[g][l]?.forEach((v, h) => (c[h] += v)); sums[l] = c; }
  const langs = shuf(LANGS).slice(0, 5);
  const pk = Object.fromEntries(langs.map((l) => [l, peak(sums[l])]));
  if (langs.some((a, i) => langs.some((b, j) => j > i && circ(pk[a], pk[b]) < SEP))) continue;
  const key = langs.slice().sort().join() + basket.slice(0, 3).join();
  if (seen.has(key)) continue;
  seen.add(key);
  puzzles.push({
    games: basket,
    curves: Object.fromEntries(langs.map((l) => {
      const c = sums[l], tot = c.reduce((a, b) => a + b, 0);
      return [l, { total: tot, peak: pk[l], share: c.map((x) => +(x / tot * 100).toFixed(2)) }];
    })),
  });
}
fs.writeFileSync('../data.json', JSON.stringify({ day: `${DAY.slice(0, 4)}-${DAY.slice(4, 6)}-${DAY.slice(6)}`, puzzles }));
console.log('games', games.length, 'puzzles', puzzles.length, 'bytes', fs.statSync('../data.json').size);
