// raw iNaturalist histograms -> ../data.json
import fs from 'node:fs'; import path from 'node:path';
const RAW = new URL('./raw/', import.meta.url).pathname;
const OUT = new URL('../data.json', import.meta.url).pathname;
const PLACES = ['US', 'CA', 'GB', 'AU', 'NZ'];
const GROUPS = ['Aves', 'Insecta', 'Plantae', 'Fungi', 'Reptilia', 'Amphibia', 'Mammalia'];
const rd = (f) => JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
const has = (f) => fs.existsSync(path.join(RAW, f));
const wk = (j) => Array.from({ length: 52 }, (_, i) => j.results.week_of_year[String(i + 1)] || 0);
const smooth = (a) => a.map((_, i) => (a[(i + 51) % 52] + 2 * a[i] + a[(i + 1) % 52]) / 4);
const cdist = (a, b) => { const d = Math.abs(a - b) % 52; return Math.min(d, 52 - d); };

// taxon meta
const meta = new Map();
for (const f of fs.readdirSync(RAW).filter((f) => f.startsWith('sp_'))) {
  for (const x of rd(f).results) { const t = x.taxon; if (!meta.has(t.id)) meta.set(t.id, t); }
}
const totals = {};
for (const cc of PLACES) for (const g of GROUPS) if (has(`tot_${cc}_${g}.json`)) totals[`${cc}_${g}`] = smooth(wk(rd(`tot_${cc}_${g}.json`)));

const species = {};
for (const [id, t] of meta) {
  const g = t.iconic_taxon_name;
  const curves = {};
  for (const cc of PLACES) {
    if (!has(`h_${id}_${cc}.json`)) continue;
    const raw = wk(rd(`h_${id}_${cc}.json`));
    const n = raw.reduce((a, b) => a + b, 0);
    const T = totals[`${cc}_${g}`]; if (!T || n < 250) continue;
    const mT = T.reduce((a, b) => a + b, 0) / 52;
    const s = smooth(raw).map((c, i) => c / (T[i] + 0.05 * mT));
    const mean = s.reduce((a, b) => a + b, 0) / 52, max = Math.max(...s);
    if (max / mean < 1.8) continue; // no clear season
    const peak = s.indexOf(max) + 1;
    curves[cc] = { n, peak, c: s.map((v) => Math.round((v / max) * 100)) };
  }
  if (Object.keys(curves).length < 2) continue;
  const p = t.default_photo;
  species[id] = {
    id: +id, sci: t.name, en: t.english_common_name || null, g,
    photo: p ? { id: p.id, by: p.attribution_name || '', lic: p.license_code || '' } : null,
    curves,
  };
}
const ids = Object.keys(species);
const nm = (x) => x.en || x.sci;
const h = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const puzzles = [];
for (const id of ids) {
  const sp = species[id]; const ccs = Object.keys(sp.curves);
  const south = (c) => c === 'AU' || c === 'NZ';
  // Skill: a naive player guesses "same week" (same hemisphere) or "+26 weeks" (across the equator).
  // Prefer pairs where that rule is off by >= 3 weeks so the second stage needs real knowledge.
  const pairs = [];
  for (const a of ccs) for (const b of ccs) if (a !== b) pairs.push({ a, b, err: cdist(south(a) !== south(b) ? sp.curves[a].peak + 26 : sp.curves[a].peak, sp.curves[b].peak) });
  const best = (arr) => { const ok = arr.filter((x) => x.err >= 3); return ok.length ? ok.sort((x, y) => y.err - x.err).slice(0, 2) : []; };
  const cross = best(pairs.filter((p) => south(p.a) !== south(p.b))), same = best(pairs.filter((p) => south(p.a) === south(p.b)));
  const pickP = (arr, k) => arr.length ? arr[h(id + k) % arr.length] : null;
  for (const p of [pickP(cross, 'x'), pickP(same, 's')]) {
    if (!p) continue;
    const pool = ids.filter((o) => o !== id && species[o].g === sp.g && species[o].curves[p.a] && cdist(species[o].curves[p.a].peak, sp.curves[p.a].peak) >= 6 && species[o].en && nm(species[o]) !== nm(sp));
    if (pool.length < 4 || !sp.en) continue;
    const opts = []; let k = 0;
    while (opts.length < 4 && k < 200) { const o = pool[h(id + p.a + p.b + k++) % pool.length]; if (!opts.includes(o) && nm(species[o]) !== nm(sp) && opts.every((q) => nm(species[q]) !== nm(species[o]) && cdist(species[q].curves[p.a].peak, species[o].curves[p.a].peak) >= 3)) opts.push(o); }
    if (opts.length < 4) continue;
    puzzles.push({ s: +id, a: p.a, b: p.b, o: opts.map(Number) });
  }
}
// drop unused species
const used = new Set(puzzles.flatMap((p) => [p.s, ...p.o]));
for (const id of ids) if (!used.has(+id)) delete species[id];
const out = { fetched: new Date().toISOString().slice(0, 10), places: { US: 'United States', CA: 'Canada', GB: 'United Kingdom', AU: 'Australia', NZ: 'New Zealand' }, species, puzzles };
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('species', Object.keys(species).length, 'puzzles', puzzles.length, 'bytes', fs.statSync(OUT).size);
if (process.env.DBG) console.log(Object.keys(species).length, ids.length);
