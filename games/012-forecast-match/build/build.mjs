// Fetch ERA5 hourly weather (Open-Meteo archive) for ~40 cities, build puzzle pool.
import fs from 'node:fs';
import path from 'node:path';
import { selectCities } from '../game.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const raw = path.join(dir, 'raw');
fs.mkdirSync(raw, { recursive: true });
const START = '2025-10-01', END = '2026-10-05';
const C = [
 ['Reykjavik','Iceland',64.15,-21.94],['Oslo','Norway',59.91,10.75],['London','United Kingdom',51.51,-0.13],['Moscow','Russia',55.76,37.62],
 ['Madrid','Spain',40.42,-3.7],['Cairo','Egypt',30.04,31.24],['Dubai','United Arab Emirates',25.2,55.27],['Riyadh','Saudi Arabia',24.71,46.68],
 ['Mumbai','India',19.08,72.88],['Delhi','India',28.61,77.21],['Bangkok','Thailand',13.76,100.5],['Singapore','Singapore',1.35,103.82],
 ['Beijing','China',39.9,116.4],['Shanghai','China',31.23,121.47],['Tokyo','Japan',35.68,139.69],['Seoul','South Korea',37.57,126.98],
 ['Sydney','Australia',-33.87,151.21],['Perth','Australia',-31.95,115.86],['Auckland','New Zealand',-36.85,174.76],['Ulaanbaatar','Mongolia',47.89,106.91],
 ['Nairobi','Kenya',-1.29,36.82],['Lagos','Nigeria',6.52,3.38],['Cape Town','South Africa',-33.92,18.42],['Johannesburg','South Africa',-26.2,28.05],
 ['Reykjavik2',null],['New York','United States',40.71,-74.01],['Chicago','United States',41.88,-87.63],['Miami','United States',25.76,-80.19],
 ['Los Angeles','United States',34.05,-118.24],['Anchorage','United States',61.22,-149.9],['Mexico City','Mexico',19.43,-99.13],['Lima','Peru',-12.05,-77.04],
 ['São Paulo','Brazil',-23.55,-46.63],['Buenos Aires','Argentina',-34.6,-58.38],['Santiago','Chile',-33.45,-70.67],['Manaus','Brazil',-3.12,-60.02],
 ['Vancouver','Canada',49.28,-123.12],['Yakutsk','Russia',62.03,129.73],['Istanbul','Turkey',41.01,28.98],['Hong Kong','Hong Kong',22.32,114.17],
 ['La Paz','Bolivia',-16.5,-68.15],['Tehran','Iran',35.69,51.39],
].filter((c) => c[2] != null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cities = [];
for (const [name, country, lat, lng] of C) {
  const f = path.join(raw, name.replace(/\W/g, '_') + '.json');
  if (!fs.existsSync(f)) {
    const u = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${START}&end_date=${END}&hourly=temperature_2m,cloud_cover,wind_speed_10m,precipitation&daily=sunrise,sunset&timezone=auto`;
    for (let a = 0; a < 6; a++) {
      const r = await fetch(u, { headers: { 'User-Agent': 'daily-data-games class project' } });
      const t = await r.text();
      if (r.ok) { fs.writeFileSync(f, t); break; }
      console.error(name, r.status, t.slice(0, 80)); await sleep(15000 * (a + 1));
    }
    await sleep(3000);
  }
  cities.push({ name, country, lat, lng, j: JSON.parse(fs.readFileSync(f, 'utf8')) });
  console.log('ok', name);
}
const days = []; for (let t = Date.parse(START); t <= Date.parse(END); t += 864e5) days.push(new Date(t).toISOString().slice(0, 10));
const hm = (iso) => (iso ? +iso.slice(11, 13) + +iso.slice(14, 16) / 60 : null);
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
function card(c, date) {
  const di = days.indexOf(date), h = c.j.hourly;
  const sl = (k) => h[k].slice(di * 24, di * 24 + 24);
  const T = sl('temperature_2m'), cl = sl('cloud_cover'), w = sl('wind_speed_10m'), p = sl('precipitation');
  if ([T, cl, w, p].some((a) => a.length < 24 || a.some((x) => x == null))) return null;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const rise = hm(c.j.daily.sunrise[di]), set = hm(c.j.daily.sunset[di]);
  return { name: c.name, country: c.country, lat: c.lat, t: T.map((x) => round(x, 1)), cloud: Math.round(sum(cl) / 24), wind: Math.round(Math.max(...w)), rain: round(sum(p), 1),
    rise: rise == null ? null : round(rise, 2), set: set == null ? null : round(set, 2) };
}
// daily mean temperature per city (climatology for deterministic live city selection)
const meta = cities.map((c) => ({ name: c.name, country: c.country, lat: c.lat, lng: c.lng,
  dm: days.map((_, di) => { const a = c.j.hourly.temperature_2m.slice(di * 24, di * 24 + 24); return a.some((x) => x == null) ? null : round(a.reduce((x, y) => x + y, 0) / 24, 1); }) }));
const byName = new Map(cities.map((c) => [c.name, c]));
// evenly spaced dates across the range so every season/hemisphere mix appears
const N = 84, puzzles = [];
for (let k = 0; k < N; k++) {
  const date = days[Math.floor((k * 7919) % days.length)]; // 7919 prime: scattered, distinct while N <= days.length
  if (puzzles.some((p) => p.date === date)) continue;
  const chosen = selectCities(meta, [START, END], date);
  if (chosen.length < 5) continue;
  const cards = chosen.map((m) => card(byName.get(m.name), date));
  if (cards.some((c) => !c)) continue;
  puzzles.push({ date, cities: cards });
}
fs.writeFileSync(path.join(dir, '../data.json'), JSON.stringify({ range: [START, END], cities: meta, puzzles }));
console.log('puzzles', puzzles.length);
