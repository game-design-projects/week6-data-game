// raw Gapminder CSVs -> data.json (countries with full 1800-2015 income + life expectancy)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const raw = (f) => fs.readFileSync(path.join(dir, 'raw', f), 'utf8').trim().split('\n').map((l) => l.split(','));
const series = (f) => { const m = new Map(); for (const [g, v, t] of raw(f).slice(1)) { if (!m.has(g)) m.set(g, new Map()); m.get(g).set(+t, +v); } return m; };
const lex = series('life_expectancy_years.csv');
const inc = series('income_per_person_gdppercapita_ppp_inflation_adjusted.csv');
const csv = (t) => t.trim().split('\n').map((l) => [...l.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)].slice(0, -1).map((m) => m[2] ?? m[1]));
// Gapminder short names that read badly as labels -> display names (the original stays as `alt` for matching)
const DISPLAY = { US: 'United States', GB: 'United Kingdom', AE: 'United Arab Emirates', CD: 'DR Congo', CG: 'Republic of Congo', KG: 'Kyrgyzstan', LA: 'Laos', FM: 'Micronesia', SK: 'Slovakia', CZ: 'Czechia', LC: 'Saint Lucia', VC: 'Saint Vincent and the Grenadines', CI: 'C\u00f4te d\'Ivoire', ST: 'S\u00e3o Tom\u00e9 and Pr\u00edncipe', CV: 'Cabo Verde', MM: 'Myanmar (Burma)' };
const ent = csv(fs.readFileSync(path.join(dir, 'raw', 'ddf--entities--geo--country.csv'), 'utf8')); const H = ent[0];
const col = (n) => H.indexOf(n);
const out = [];
for (const r of ent.slice(1)) {
  const id = r[col('country')], cc = r[col('iso3166_1_alpha2')];
  const L = lex.get(id), I = inc.get(id);
  if (!L || !I || !cc) continue;
  const pts = [];
  let ok = true;
  const years = []; for (let y = 1800; y <= 2014; y += 2) years.push(y); years.push(2015);
  for (const y of years) {
    if (!L.has(y) || !I.has(y)) { ok = false; break; }
    pts.push([y, Math.round(I.get(y)), Math.round(L.get(y) * 10) / 10]);
  }
  if (!ok) continue;
  const gm = r[col('name')];
  const name = DISPLAY[cc] || gm;
  out.push({ cc, name, ...(name !== gm ? { alt: gm } : {}), region: r[col('world_4region')], pts });
}
fs.writeFileSync(path.join(dir, '..', 'data.json'), JSON.stringify({ years: [1800, 2015], countries: out }));
console.log(out.length, 'countries');
