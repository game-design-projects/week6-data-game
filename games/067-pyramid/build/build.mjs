// Fetch World Bank (UN WPP-derived) age/sex population + country metadata, emit ../data.json
import fs from 'node:fs'; import path from 'node:path';
const raw = path.join(import.meta.dirname, 'raw'); fs.mkdirSync(raw, { recursive: true });
const YEAR = 2024, UA = 'daily-data-games class project';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(name, url) {
  const f = path.join(raw, name);
  if (!fs.existsSync(f)) { const t = await (await fetch(url, { headers: { 'User-Agent': UA } })).text(); fs.writeFileSync(f, t); await sleep(300); }
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
const AGES = [...Array(16).keys()].map((i) => String(i * 5).padStart(2, '0') + String(i * 5 + 4).padStart(2, '0')).concat('80UP');
const meta = (await get('countries.json', 'https://api.worldbank.org/v2/country?format=json&per_page=400'))[1];
const C = new Map();
for (const c of meta) if (c.region.value !== 'Aggregates' && c.latitude) C.set(c.id, { name: c.name, iso2: c.iso2Code, region: c.region.value.trim(), income: c.incomeLevel.id, lat: +c.latitude, lng: +c.longitude, f: [], m: [] });
for (const sex of ['FE', 'MA']) for (const a of AGES) {
  const j = await get(`${YEAR}.${a}.${sex}.json`, `https://api.worldbank.org/v2/country/all/indicator/SP.POP.${a}.${sex}?date=${YEAR}&format=json&per_page=400`);
  for (const r of j[1]) { const c = C.get(r.countryiso3code); if (c) (sex === 'FE' ? c.f : c.m).push(r.value); }
}
const REG = { 'East Asia & Pacific': '东亚与太平洋', 'Europe & Central Asia': '欧洲与中亚', 'Latin America & Caribbean': '拉美与加勒比', 'Middle East & North Africa': '中东北非', 'Middle East, North Africa, Afghanistan & Pakistan': '中东北非（含阿巴）', 'North America': '北美', 'South Asia': '南亚', 'Sub-Saharan Africa': '撒哈拉以南非洲' };
const INC = { LIC: '低收入', LMC: '中等偏下收入', UMC: '中等偏上收入', HIC: '高收入' };
const out = [];
const EN = new Intl.DisplayNames(['en'], { type: 'region' }), ZH = new Intl.DisplayNames(['zh-Hans'], { type: 'region' });
for (const [id, c] of C) {
  if (c.f.length !== 17 || c.m.length !== 17 || [...c.f, ...c.m].some((v) => !v)) continue;
  const tot = [...c.f, ...c.m].reduce((a, b) => a + b, 0);
  if (tot < 1e6 || !REG[c.region] || !INC[c.income]) continue;
  // median age by linear interpolation over 5-yr bands (80+ treated as 80-90)
  const both = c.f.map((v, i) => v + c.m[i]); let acc = 0, med = 0;
  for (let i = 0; i < 17; i++) { if (acc + both[i] >= tot / 2) { med = i * 5 + ((tot / 2 - acc) / both[i]) * (i === 16 ? 10 : 5); break; } acc += both[i]; }
  const p = (v) => +((v / tot) * 100).toFixed(2);
  const under15 = both.slice(0, 3).reduce((a, b) => a + b, 0), over65 = both.slice(13).reduce((a, b) => a + b, 0);
  out.push({ id, cc: c.iso2, name: EN.of(c.iso2) ?? c.name, zh: ZH.of(c.iso2) ?? c.name, region: REG[c.region], income: INC[c.income], lat: c.lat, lng: c.lng, pop: Math.round(tot), med: +med.toFixed(1), u15: +((under15 / tot) * 100).toFixed(1), o65: +((over65 / tot) * 100).toFixed(1), fshare: +((c.f.reduce((a, b) => a + b, 0) / tot) * 100).toFixed(1), f: c.f.map(p), m: c.m.map(p) });
}
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify({ year: YEAR, ages: AGES, countries: out }));
console.log(out.length, 'countries');
