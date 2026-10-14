// raw OpenFlights -> data.json. Raw files fetched by: build/fetch.sh
import { readFileSync, writeFileSync } from 'node:fs';
const csv = (l) => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const R = (f) => readFileSync(new URL('./raw/' + f, import.meta.url), 'utf8').split('\n').filter(Boolean).map(csv);
const air = new Map(); // by iata
for (const r of R('airports.dat')) if (/^[A-Z]{3}$/.test(r[4])) air.set(r[4], { c: r[4], n: r[1], city: r[2], co: r[3], lat: +(+r[6]).toFixed(3), lng: +(+r[7]).toFixed(3), tz: r[11] });
const airl = new Map(R('airlines.dat').map((r) => [r[1] === '' ? '' : r[3], r[1]]).filter(([k]) => k));
const out = new Map(); // src -> Map(dest -> Set(airline))
for (const r of R('routes.dat')) {
  const [al, , s, , d] = r; if (!air.has(s) || !air.has(d) || s === d) continue;
  if (!out.has(s)) out.set(s, new Map());
  if (!out.get(s).has(d)) out.get(s).set(d, new Set());
  out.get(s).get(d).add(al);
}
const deg = (c) => (out.get(c)?.size ?? 0);
const inb = new Map(); for (const [s, m] of out) for (const d of m.keys()) inb.set(d, (inb.get(d) ?? 0) + 1);
const opts = [...air.values()].filter((a) => deg(a.c) + (inb.get(a.c) ?? 0) >= 4);
// puzzle pool: 22..230 destinations, max 4 per country, ordered by size
const cand = [...air.values()].filter((a) => deg(a.c) >= 22 && deg(a.c) <= 230).sort((a, b) => deg(b.c) - deg(a.c));
const cnt = {}; const pool = [];
for (const a of cand) { cnt[a.co] = (cnt[a.co] ?? 0) + 1; if (cnt[a.co] > 4) continue; pool.push(a); if (pool.length >= 100) break; }
const puzzles = pool.map((a) => {
  const m = out.get(a.c); const al = {};
  for (const s of m.values()) for (const x of s) al[x] = (al[x] ?? 0) + 1;
  const airlines = Object.entries(al).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, n]) => [airl.get(k) || k, n]);
  return { a: a.c, d: [...m.keys()], al: airlines };
});
const used = new Set(opts.map((o) => o.c)); for (const p of puzzles) for (const d of p.d) used.add(d);
const airports = [...air.values()].filter((a) => used.has(a.c)).map(({ tz, ...a }) => a);
writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ airports, puzzles, optionCodes: opts.map((o) => o.c) }));
console.log(airports.length, opts.length, puzzles.length);
