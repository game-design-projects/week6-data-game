// Fetch ERA5 hourly weather (Open-Meteo archive) for ~40 cities, build puzzle pool.
import fs from 'node:fs';
import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const raw = path.join(dir, 'raw');
const START = '2025-10-01', END = '2026-10-05';
const C = [
 ['Reykjavik','冰岛',64.15,-21.94],['Oslo','挪威',59.91,10.75],['London','英国',51.51,-0.13],['Moscow','俄罗斯',55.76,37.62],
 ['Madrid','西班牙',40.42,-3.7],['Cairo','埃及',30.04,31.24],['Dubai','阿联酋',25.2,55.27],['Riyadh','沙特',24.71,46.68],
 ['Mumbai','印度',19.08,72.88],['Delhi','印度',28.61,77.21],['Bangkok','泰国',13.76,100.5],['Singapore','新加坡',1.35,103.82],
 ['Beijing','中国',39.9,116.4],['Shanghai','中国',31.23,121.47],['Tokyo','日本',35.68,139.69],['Seoul','韩国',37.57,126.98],
 ['Sydney','澳大利亚',-33.87,151.21],['Perth','澳大利亚',-31.95,115.86],['Auckland','新西兰',-36.85,174.76],['Ulaanbaatar','蒙古',47.89,106.91],
 ['Nairobi','肯尼亚',-1.29,36.82],['Lagos','尼日利亚',6.52,3.38],['Cape Town','南非',-33.92,18.42],['Johannesburg','南非',-26.2,28.05],
 ['Reykjavik2',null],['New York','美国',40.71,-74.01],['Chicago','美国',41.88,-87.63],['Miami','美国',25.76,-80.19],
 ['Los Angeles','美国',34.05,-118.24],['Anchorage','美国',61.22,-149.9],['Mexico City','墨西哥',19.43,-99.13],['Lima','秘鲁',-12.05,-77.04],
 ['São Paulo','巴西',-23.55,-46.63],['Buenos Aires','阿根廷',-34.6,-58.38],['Santiago','智利',-33.45,-70.67],['Manaus','巴西',-3.12,-60.02],
 ['Vancouver','加拿大',49.28,-123.12],['Yakutsk','俄罗斯',62.03,129.73],['Istanbul','土耳其',41.01,28.98],['Hong Kong','中国香港',22.32,114.17],
 ['La Paz','玻利维亚',-16.5,-68.15],['Tehran','伊朗',35.69,51.39],
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
// seeded rng
let s = 12345; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const days = []; for (let t = Date.parse(START); t <= Date.parse(END); t += 864e5) days.push(new Date(t).toISOString().slice(0, 10));
const hm = (iso) => +iso.slice(11, 13) + +iso.slice(14, 16) / 60;
function card(c, date) {
  const di = days.indexOf(date), h = c.j.hourly;
  const sl = (k) => h[k].slice(di * 24, di * 24 + 24);
  const T = sl('temperature_2m'), cl = sl('cloud_cover'), w = sl('wind_speed_10m'), p = sl('precipitation');
  if ([T, cl, w, p].some((a) => a.length < 24 || a.some((x) => x == null))) return null;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  return { t: T.map((x) => Math.round(x * 10) / 10), cloud: Math.round(sum(cl) / 24), wind: Math.round(Math.max(...w)), rain: Math.round(sum(p) * 10) / 10,
    rise: Math.round(hm(c.j.daily.sunrise[di]) * 100) / 100, set: Math.round(hm(c.j.daily.sunset[di]) * 100) / 100 };
}
const puzzles = [];
const usedDates = new Set();
while (puzzles.length < 70) {
  const date = days[Math.floor(rnd() * days.length)];
  if (usedDates.has(date)) continue;
  // pick 5 cities with distinct countries and mean temps spread >= 2C apart
  const order = cities.map((c) => [rnd(), c]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const chosen = [];
  for (const c of order) {
    const cd = card(c, date); if (!cd) continue;
    const m = cd.t.reduce((a, b) => a + b, 0) / 24;
    if (chosen.some((x) => x.c.country === c.country || Math.abs(x.m - m) < 2.5)) continue;
    chosen.push({ c, cd, m });
    if (chosen.length === 5) break;
  }
  if (chosen.length < 5) continue;
  usedDates.add(date);
  puzzles.push({ date, cities: chosen.map((x) => ({ name: x.c.name, country: x.c.country, lat: x.c.lat, ...x.cd })) });
}
fs.writeFileSync(path.join(dir, '../data.json'), JSON.stringify({ range: [START, END], puzzles }));
console.log('puzzles', puzzles.length);
