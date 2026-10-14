import fs from 'node:fs';
const J = (f) => JSON.parse(fs.readFileSync(`raw/${f}.json`, 'utf8'));
const IND = { gdp:'NY.GDP.PCAP.CD', pop:'SP.POP.TOTL', life:'SP.DYN.LE00.IN', urban:'SP.URB.TOTL.IN.ZS', area:'AG.LND.TOTL.K2', fert:'SP.DYN.TFRT.IN', net:'IT.NET.USER.ZS', forest:'AG.LND.FRST.ZS', co2:'EN.GHG.CO2.PC.CE.AR5', health:'SH.XPD.CHEX.GD.ZS' };
const vals = {}, years = {};
for (const [k, code] of Object.entries(IND)) {
  vals[k] = {};
  for (const r of J(code)[1]) if (r.value != null && +r.date >= 2015) { vals[k][r.countryiso3code] = r.value; years[k] = Math.max(years[k] || 0, +r.date); }
}
const out = [];
for (const c of J('countries')[1]) {
  if (c.region.value === 'Aggregates' || !c.capitalCity) continue;
  const v = {};
  for (const k of Object.keys(IND)) v[k] = vals[k][c.id];
  if (Object.values(v).some((x) => x == null) || v.pop < 1.5e6) continue;
  const r = (x) => +x.toPrecision(4);
  out.push({ cc: c.iso2Code, name: c.name, region: c.region.value.trim(), income: c.incomeLevel.value, capital: c.capitalCity, lat: +c.latitude, lng: +c.longitude, v: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, r(x)])) });
}
fs.writeFileSync('../data.json', JSON.stringify({ countries: out, years }));
console.log(out.length, years);
