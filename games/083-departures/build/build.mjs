// raw OpenFlights -> data.json. Raw files fetched by: build/fetch.sh
import { readFileSync, writeFileSync } from 'node:fs';

const csv = (l) => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const R = (f) => readFileSync(new URL('./raw/' + f, import.meta.url), 'utf8').split('\n').filter(Boolean).map(csv);

const air = new Map(); // by iata
for (const r of R('airports.dat')) if (/^[A-Z]{3}$/.test(r[4])) air.set(r[4], { c: r[4], n: r[1], city: r[2], co: r[3], lat: +(+r[6]).toFixed(3), lng: +(+r[7]).toFixed(3) });
// OpenFlights leaves a few cities empty
const CITY_FIX = { DWD: 'Dawadmi' };
for (const a of air.values()) { if (!a.city) a.city = CITY_FIX[a.c] ?? a.n.replace(/ (International |Domestic )?Airport$/, ''); }

// airlines: by numeric id (exact), and by IATA code restricted to active airlines (fallback)
const alById = new Map(); const alByCode = new Map();
for (const r of R('airlines.dat')) {
  alById.set(r[0], r[1]);
  if (r[7] === 'Y' && r[3] && r[3] !== '-' && !alByCode.has(r[3])) alByCode.set(r[3], r[1]);
}
const airlineName = (id, code) => alById.get(id) ?? alByCode.get(code) ?? null;

const out = new Map(); // src -> Map(dest -> Set(airline name))
for (const r of R('routes.dat')) {
  const [code, id, s, , d, , codeshare, stops] = r;
  if (!air.has(s) || !air.has(d) || s === d || stops !== '0') continue;
  if (!out.has(s)) out.set(s, new Map());
  const m = out.get(s); if (!m.has(d)) m.set(d, new Set());
  if (codeshare !== 'Y') { const nm = airlineName(id, code); if (nm) m.get(d).add(nm); }
}
const deg = (c) => out.get(c)?.size ?? 0;

// guessable airports = at least 3 recorded direct destinations (so "shared destinations" feedback means something)
const optionCodes = [...air.values()].filter((a) => deg(a.c) >= 3).map((a) => a.c);
// puzzle pool: 22..230 destinations, max 4 per country, largest first
const cand = [...air.values()].filter((a) => deg(a.c) >= 22 && deg(a.c) <= 230).sort((a, b) => deg(b.c) - deg(a.c));
const cnt = {}; const pool = [];
for (const a of cand) { cnt[a.co] = (cnt[a.co] ?? 0) + 1; if (cnt[a.co] > 4) continue; pool.push(a); if (pool.length >= 100) break; }
const puzzles = pool.map((a) => {
  const al = {};
  for (const s of out.get(a.c).values()) for (const x of s) al[x] = (al[x] ?? 0) + 1;
  return { a: a.c, al: Object.entries(al).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).slice(0, 5) };
});
// outbound lists for every guessable airport (space-joined IATA codes)
const routes = {};
for (const c of optionCodes) routes[c] = [...out.get(c).keys()].sort().join(' ');
const used = new Set(optionCodes); for (const c of optionCodes) for (const d of out.get(c).keys()) used.add(d);
const airports = [...air.values()].filter((a) => used.has(a.c));
writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ airports, puzzles, optionCodes, routes }));
console.log(airports.length, optionCodes.length, puzzles.length);
