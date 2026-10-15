// BLS American Time Use Survey flat files (pub/time.series/tu) -> data.json
// groups: year x sex x age. v[actcode] = [mean min/day over everyone, % who did it that day, mean min among those who did it]
// Run: sh fetch.sh && node build.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACT, SLEEP } from '../acts.js';
const here = dirname(fileURLToPath(import.meta.url));
const raw = join(here, 'raw', 'bls');
if (!existsSync(join(raw, 'tu.data.0.Current'))) throw new Error('run build/fetch.sh first');
const rd = (f) => readFileSync(join(raw, f), 'latin1').split(/\r?\n/).filter(Boolean);

const SEX = new Set(['0', '1', '2']);
const AGE = new Set(['000', '103', '031', '038', '042', '049', '065']); // non-overlapping bands + all 15+
const STAT = { 10101: 0, 30105: 1, 20101: 2 }; // avg hrs (everyone), % engaged, avg hrs (participants)
const wanted = new Set([...Object.keys(ACT), SLEEP]);

const L = rd('tu.series');
const H = L[0].split('\t').map((s) => s.trim());
const zero = H.filter((h) => /_code$/.test(h) && !['stattype_code', 'datays_code', 'sex_code', 'age_code', 'actcode_code', 'pertype_code'].includes(h));
const meta = new Map();
for (const l of L.slice(1)) {
  const c = l.split('\t'); const r = Object.fromEntries(H.map((h, i) => [h, (c[i] ?? '').trim()]));
  if (!(r.stattype_code in STAT) || r.datays_code !== '01' || r.pertype_code !== '00') continue;
  if (!SEX.has(r.sex_code) || !AGE.has(r.age_code) || !wanted.has(r.actcode_code)) continue;
  if (!zero.every((k) => /^0+$/.test(r[k]))) continue;
  meta.set(r.series_id, { st: STAT[r.stattype_code], s: r.sex_code, a: r.age_code, ac: r.actcode_code });
}
console.log('series', meta.size);

const G = new Map();
for (const l of rd('tu.data.0.Current')) {
  const c = l.split('\t'); const m = meta.get(c[0].trim());
  if (!m || c[2].trim() !== 'A01') continue;
  const x = +c[3]; if (!Number.isFinite(x)) continue; // 'S' suppressed, '-' missing
  const k = `${c[1]}|${m.s}|${m.a}`;
  const g = G.get(k) ?? { y: +c[1], s: +m.s, a: m.a, v: {} };
  const cell = (g.v[m.ac] ??= [null, null, null]);
  cell[m.st] = m.st === 1 ? Math.round(x * 10) / 10 : Math.round(x * 60);
  G.set(k, g);
}
const groups = [...G.values()].map((g) => {
  for (const k of Object.keys(g.v)) if (g.v[k].some((x) => x == null)) delete g.v[k];
  return g;
}).filter((g) => g.v[SLEEP] && Object.keys(g.v).filter((k) => ACT[k] && g.v[k][0] >= 5).length >= 8);
groups.sort((a, b) => a.y - b.y || a.s - b.s || a.a.localeCompare(b.a));
writeFileSync(join(here, '..', 'data.json'), JSON.stringify({ groups }));
console.log('groups', groups.length, 'years', groups[0].y, '-', groups.at(-1).y);
