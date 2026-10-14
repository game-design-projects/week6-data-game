// raw UN WPP 2024 abridged life table -> data.json (country x sex, year 2023)
import { createReadStream, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
const YEAR = '2023';
const rl = createInterface({ input: createReadStream(new URL('./raw/abr.csv.gz', import.meta.url)).pipe(createGunzip()) });
let head; const acc = {};
for await (const line of rl) {
  const f = line.replace(/^﻿/, '').split(',');
  if (!head) { head = f; continue; }
  const o = Object.fromEntries(head.map((h, i) => [h, f[i]]));
  if (o.Time !== YEAR || o.LocTypeName !== 'Country/Area' || o.Variant !== 'Medium') continue;
  const a = (acc[o.ISO3_code] ??= { cc: o.ISO3_code, iso2: o.ISO2_code, name: o.Location, l: {} });
  const s = o.Sex;
  (a.l[s] ??= {});
  if (o.AgeGrp === '0') a.l[s].e0 = +o.ex;
  if (o.AgeGrp === '40-44' || o.AgeGrp === '40') { a.l[s].l40 = +o.lx; a.l[s].e40 = +o.ex; }
  if (o.AgeGrp === '80-84' || o.AgeGrp === '80') a.l[s].l80 = +o.lx;
}
const countries = [], puzzles = [];
for (const c of Object.values(acc)) {
  const r = {};
  for (const [s, v] of Object.entries(c.l)) if (v.l40 && v.l80) r[s] = { p: +(v.l80 / v.l40 * 100).toFixed(1), e0: v.e0, e40: v.e40 };
  if (!r.Female || !r.Male) continue;
  countries.push({ cc: c.cc, iso2: c.iso2, name: c.name, F: r.Female, M: r.Male });
}
console.log(countries.length, 'countries');
writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ year: +YEAR, countries }));
