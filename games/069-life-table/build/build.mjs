// raw UN WPP 2024 abridged life table -> data.json (country x sex x year)
// run: sh build/fetch.sh && node build/build.mjs
import { createReadStream, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';

export const YEARS = [1970, 1990, 2010, 2023];
// non-sovereign territories / micro-areas that are not UN members or observers: dropped
const SKIP = new Set('MYT REU ESH SHN FRO GGY IMN JEY GIB VAT XKX AIA ABW VGB CYM CUW GLP MTQ MSR BLM MAF SXM TCA VIR FLK GUF BMU GRL SPM NCL GUM MNP ASM COK PYF NIU TKL WLF'.split(' '));
// civil-war years in the UN estimate (male e0 22-26): not a fair puzzle
const DROP = new Set(['SSD|1970', 'SSD|1990']);
const rl = createInterface({ input: createReadStream(new URL('./raw/abr.csv.gz', import.meta.url)).pipe(createGunzip()) });
let head; const acc = {};
for await (const line of rl) {
  const f = line.replace(/^﻿/, '').split(',');
  if (!head) { head = f; continue; }
  if (f[7] !== 'Country/Area' || SKIP.has(f[3])) continue;
  const o = Object.fromEntries(head.map((h, i) => [h, f[i]]));
  if (o.Variant !== 'Medium' || !YEARS.includes(+o.Time) || !['Female', 'Male'].includes(o.Sex)) continue;
  if (DROP.has(`${o.ISO3_code}|${o.Time}`)) continue;
  const key = `${o.ISO3_code}|${o.Sex[0]}|${o.Time}`;
  const a = (acc[key] ??= { cc: o.ISO3_code, iso2: o.ISO2_code, name: o.Location, s: o.Sex[0], y: +o.Time });
  const lx = +o.lx;
  if (o.AgeGrp === '0') a.e0 = +o.ex;
  if (o.AgeGrp === '5-9') a.l5 = lx;
  if (o.AgeGrp === '40-44') { a.l40 = lx; a.e40 = +o.ex; }
  if (o.AgeGrp === '80-84') a.l80 = lx;
}
const L0 = 100000, names = {};
const rows = [];
for (const a of Object.values(acc)) {
  if (![a.e0, a.l5, a.l40, a.e40, a.l80].every(Number.isFinite)) continue;
  names[a.cc] = { iso2: a.iso2, name: a.name };
  rows.push({
    cc: a.cc, s: a.s, y: a.y,
    p: +((a.l80 / a.l40) * 100).toFixed(1),   // survival from exact age 40 to exact age 80
    e0: +a.e0.toFixed(1), e40: +a.e40.toFixed(1),
    u5: +(((L0 - a.l5) / L0) * 1000).toFixed(1), // deaths before age 5, per 1000 births
    s40: +((a.l40 / L0) * 100).toFixed(1),       // % of newborns reaching 40
  });
}
rows.sort((x, y) => x.cc.localeCompare(y.cc) || x.y - y.y || x.s.localeCompare(y.s));
console.log(Object.keys(names).length, 'countries,', rows.length, 'puzzles');
writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ years: YEARS, countries: names, rows }));
