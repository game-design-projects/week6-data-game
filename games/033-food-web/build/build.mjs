import { ECO } from './species.mjs';
import fs from 'node:fs';
const norm = (n) => n.split(' ').slice(0, 2).join(' ');
const dir = (n, t) => { const f = `raw/${n.replace(' ', '_')}.${t}.json`; return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; };
// count[a][b] = number of GloBI records a eats b
const cnt = {};
for (const n of new Set(Object.values(ECO).flat().map((s) => s[0]))) for (const t of ['eats', 'preysOn']) for (const r of dir(n, t)) {
  const a = norm(r.source_taxon_name || r.source?.name || ''), b = norm(r.target_taxon_name || r.target?.name || '');
  if (a !== n || a === b) continue;
  (cnt[a] ??= {})[b] = (cnt[a][b] || 0) + 1;
}
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ecos = [], puzzles = [], seen = new Set();
for (const [eco, sp] of Object.entries(ECO)) {
  const L = sp.map((s) => s[0]);
  const edge = (a, b) => (cnt[a]?.[b] || 0);
  const edges = [];
  for (const a of L) for (const b of L) if (a !== b && edge(a, b) > 0 && !(edge(b, a) > 0)) edges.push([a, b, edge(a, b)]);
  console.log(eco, 'edges', edges.length);
  ecos.push({ name: eco, species: sp.map(([latin, zh, en]) => ({ latin, zh, en })), edges });
  let tries = 0, got = 0;
  while (got < 14 && tries++ < 4000) {
    const six = shuffle(L).slice(0, 6).sort();
    const E = edges.filter(([a, b]) => six.includes(a) && six.includes(b));
    const key = eco + six.join('|');
    if (E.length < 4 || E.length > 9 || seen.has(key)) continue;
    // every species must touch an edge, and no species is in a pair with both directions recorded
    if (!six.every((s) => E.some((e) => e[0] === s || e[1] === s))) continue;
    // ambiguous pairs: reverse recorded -> skip
    if (six.some((a) => six.some((b) => a !== b && edge(a, b) > 0 && edge(b, a) > 0))) continue;
    seen.add(key); got++;
    puzzles.push({ eco, sp: six, e: E.map(([a, b, n]) => [a, b, n]) });
  }
}
const out = { ecos: ecos.map((e) => ({ name: e.name, species: e.species })), puzzles: shuffle(puzzles), builtAt: new Date().toISOString().slice(0, 10) };
fs.writeFileSync('../data.json', JSON.stringify(out));
console.log('puzzles', puzzles.length, 'size', JSON.stringify(out).length);
