// raw World Bank JSON -> data.json (pool of country "news stories"). Run: node build/fetch.sh && node build/build.mjs
import fs from 'node:fs';
const R = (f) => JSON.parse(fs.readFileSync(new URL(`./raw/${f}.json`, import.meta.url)));
const ind = { pop: 'SP.POP.TOTL', gdp: 'NY.GDP.PCAP.CD', life: 'SP.DYN.LE00.IN', urban: 'SP.URB.TOTL.IN.ZS', net: 'IT.NET.USER.ZS', unemp: 'SL.UEM.TOTL.ZS' };
const countries = new Map(R('countries')[1].filter((c) => c.region.id !== 'NA').map((c) => [c.id, c]));
const by = {};
for (const [k, id] of Object.entries(ind)) for (const r of R(id)[1]) if (r.value != null) (by[r.countryiso3code] ??= {})[`${k}${r.date}`] = r.value;
const out = [];
for (const [iso3, v] of Object.entries(by)) {
  const c = [...countries.values()].find((x) => x.id === iso3);
  if (!c) continue;
  const Y = 2022;
  const need = ['pop', 'gdp', 'life', 'urban', 'net', 'unemp'].map((k) => v[`${k}${Y}`]);
  if (need.some((x) => x == null) || v.pop2012 == null || v[`pop${Y}`] < 3e6) continue;
  const g = (v.pop2022 / v.pop2012 - 1) * 100;
  if (v.life2022 < 45 || g < -20 || g > 80 || v.unemp2022 > 35 || v.gdp2022 < 200 || v.gdp2022 > 150000) continue; // outside slider range / implausible
  out.push({ cc: c.iso2Code, name: c.name, year: Y,
    pop: v.pop2022, growth: +(((v.pop2022 / v.pop2012) - 1) * 100).toFixed(1), gdp: Math.round(v.gdp2022),
    life: +v.life2022.toFixed(1), urban: +v.urban2022.toFixed(1), net: +v.net2022.toFixed(1), unemp: +v.unemp2022.toFixed(1) });
}
out.sort((a, b) => a.cc.localeCompare(b.cc));
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ year: 2022, countries: out }));
console.log(out.length, 'countries');
