// raw GloBI responses (build/raw, from fetch.mjs) -> ../data.json
import { ECO, KIND } from './species.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const STRONG = 2; // >= 2 GloBI records = counted edge; 1 record = "uncertain" (neutral in scoring)
const norm = (n) => n.split(' ').slice(0, 2).join(' ');
const load = (n, t) => { const f = path.join(here, 'raw', `${n.replace(' ', '_')}.${t}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; };
const cnt = {};
for (const n of new Set(Object.values(ECO).flat().map((s) => s[0]))) for (const t of ['eats', 'preysOn']) for (const r of load(n, t)) {
  const a = norm(r.source_taxon_name || ''), b = norm(r.target_taxon_name || '');
  if (a !== n || a === b) continue;
  (cnt[a] ??= {})[b] = (cnt[a][b] || 0) + 1;
}
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const combos = (arr, k) => { const out = []; const rec = (s, c) => { if (c.length === k) return out.push(c.slice()); for (let i = s; i < arr.length; i++) { c.push(arr[i]); rec(i + 1, c); c.pop(); } }; rec(0, []); return out; };
const n_ = (a, b) => cnt[a]?.[b] || 0;
const ecos = [], puzzles = [];
for (const [eco, sp] of Object.entries(ECO)) {
  const L = sp.map((s) => s[0]);
  ecos.push({ name: eco, species: sp.map(([latin, en]) => ({ latin, en, kind: KIND[latin] })) });
  let got = 0;
  for (const c of shuffle(combos(L, 6))) {
    if (got >= 14) break;
    const six = c.slice().sort();
    // a pair recorded in both directions is ambiguous -> skip the whole set
    if (six.some((a) => six.some((b) => a !== b && n_(a, b) > 0 && n_(b, a) > 0))) continue;
    const e = [], w = [];
    for (const a of six) for (const b of six) { const n = n_(a, b); if (a === b || !n) continue; (n >= STRONG ? e : w).push([a, b, n]); }
    if (e.length < 4 || e.length > 9 || w.length > 2) continue;
    if (!six.every((s) => e.some((x) => x[0] === s || x[1] === s))) continue;
    got++; puzzles.push({ eco, sp: six, e, w });
  }
  console.log(eco, 'puzzles', got);
}
const out = { ecos, puzzles: shuffle(puzzles), builtAt: new Date().toISOString().slice(0, 10) };
fs.writeFileSync(path.join(here, '..', 'data.json'), JSON.stringify(out));
console.log('puzzles', puzzles.length, 'bytes', JSON.stringify(out).length);
