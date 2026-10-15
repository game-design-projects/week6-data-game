// Fetch ERA5 hourly weather (Open-Meteo archive) for ~40 cities, build puzzle pool.
import fs from 'node:fs';
import path from 'node:path';
import { selectCities } from '../game.js';
const ZH = {"Reykjavik": "雷克雅未克", "Oslo": "奥斯陆", "London": "伦敦", "Moscow": "莫斯科", "Madrid": "马德里", "Cairo": "开罗", "Dubai": "迪拜", "Riyadh": "利雅得", "Mumbai": "孟买", "Delhi": "德里", "Bangkok": "曼谷", "Singapore": "新加坡", "Beijing": "北京", "Shanghai": "上海", "Tokyo": "东京", "Seoul": "首尔", "Sydney": "悉尼", "Perth": "珀斯", "Auckland": "奥克兰", "Ulaanbaatar": "乌兰巴托", "Nairobi": "内罗毕", "Lagos": "拉各斯", "Cape Town": "开普敦", "Johannesburg": "约翰内斯堡", "New York": "纽约", "Chicago": "芝加哥", "Miami": "迈阿密", "Los Angeles": "洛杉矶", "Anchorage": "安克雷奇", "Mexico City": "墨西哥城", "Lima": "利马", "São Paulo": "圣保罗", "Buenos Aires": "布宜诺斯艾利斯", "Santiago": "圣地亚哥", "Manaus": "马瑙斯", "Vancouver": "温哥华", "Yakutsk": "雅库茨克", "Istanbul": "伊斯坦布尔", "Hong Kong": "香港", "La Paz": "拉巴斯", "Tehran": "德黑兰"};
const dir = path.dirname(new URL(import.meta.url).pathname);
const raw = path.join(dir, 'raw');
fs.mkdirSync(raw, { recursive: true });
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
  cities.push({ name, zh: ZH[name], country, lat, lng, j: JSON.parse(fs.readFileSync(f, 'utf8')) });
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
  return { name: c.name, zh: c.zh, country: c.country, lat: c.lat, t: T.map((x) => round(x, 1)), cloud: Math.round(sum(cl) / 24), wind: Math.round(Math.max(...w)), rain: round(sum(p), 1),
    rise: rise == null ? null : round(rise, 2), set: set == null ? null : round(set, 2) };
}
// daily mean temperature per city (climatology for deterministic live city selection)
const meta = cities.map((c) => ({ name: c.name, zh: c.zh, country: c.country, lat: c.lat, lng: c.lng,
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
