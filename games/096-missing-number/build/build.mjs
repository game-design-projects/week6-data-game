// raw World Bank JSON + USGS CSV -> data.json. Run: bash build/fetch.sh && node build/build.mjs
import fs from 'node:fs';
import { dayStats, QUAKE_RANGE } from '../quake.js';
const R = (f) => JSON.parse(fs.readFileSync(new URL(`./raw/${f}.json`, import.meta.url)));
const ind = { pop: 'SP.POP.TOTL', gdp: 'NY.GDP.PCAP.CD', life: 'SP.DYN.LE00.IN', urban: 'SP.URB.TOTL.IN.ZS', net: 'IT.NET.USER.ZS', unemp: 'SL.UEM.TOTL.ZS' };
const countries = new Map(R('countries')[1].filter((c) => c.region.id !== 'NA').map((c) => [c.id, c]));
const by = {};
for (const [k, id] of Object.entries(ind)) for (const r of R(id)[1]) if (r.value != null) (by[r.countryiso3code] ??= {})[`${k}${r.date}`] = r.value;
const out = [];
for (const [iso3, v] of Object.entries(by)) {
  const c = countries.get(iso3);
  if (!c) continue;
  const Y = 2022;
  const need = ['pop', 'gdp', 'life', 'urban', 'net', 'unemp'].map((k) => v[`${k}${Y}`]);
  if (need.some((x) => x == null) || v.pop2012 == null || v[`pop${Y}`] < 3e6) continue;
  const g = (v.pop2022 / v.pop2012 - 1) * 100;
  if (v.life2022 < 45 || g < -20 || g > 80 || v.unemp2022 > 35 || v.gdp2022 < 200 || v.gdp2022 > 150000) continue; // outside slider range / implausible
  out.push({ cc: c.iso2Code, name: c.name, year: Y,
    pop: v.pop2022, growth: +g.toFixed(1), gdp: Math.round(v.gdp2022),
    life: +v.life2022.toFixed(1), urban: +v.urban2022.toFixed(1), net: +v.net2022.toFixed(1), unemp: +v.unemp2022.toFixed(1) });
}
out.sort((a, b) => a.cc.localeCompare(b.cc));

// USGS: group M2.5+ events by UTC day -> daily brief. Last 3 days are excluded (catalogue still being reviewed).
const days = {};
for (const f of fs.readdirSync(new URL('./raw/', import.meta.url)).filter((f) => f.startsWith('usgs-'))) {
  const lines = fs.readFileSync(new URL(`./raw/${f}`, import.meta.url), 'utf8').trim().split('\n').slice(1);
  for (const l of lines) {
    const f13 = l.split(',');
    const idx = l.lastIndexOf(',earthquake,');
    if (idx < 0) continue;
    const place = f13.slice(13).join(',').split(',earthquake,')[0].replace(/^"|"$/g, '');
    const m = [null, f13[0], f13[3], f13[4], place];
    (days[m[1].slice(0, 10)] ??= []).push({ mag: +m[3], depth: +m[2], place: m[4] });
  }
}
const LAST = '2026-10-12';
const quakes = [];
for (const d of Object.keys(days).sort()) {
  if (d > LAST || d === '2026-04-15') continue;
  const s = dayStats(days[d].map((e) => ({ properties: { mag: e.mag, place: e.place }, geometry: { coordinates: [0, 0, e.depth] } })), d);
  if (s) quakes.push(s);
}
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ year: 2022, countries: out, quakes }));
console.log(out.length, 'countries', quakes.length, 'quake days', JSON.stringify(QUAKE_RANGE));
