// Fetch ~92 days of hourly PM2.5 (CAMS via Open-Meteo) for 40 cities, build daily means + puzzle pool.
import fs from 'node:fs';
const CITIES = [
['Beijing','北京',39.9,116.4],['Delhi','德里',28.61,77.21],['Lahore','拉合尔',31.55,74.34],['Dhaka','达卡',23.81,90.41],
['Kolkata','加尔各答',22.57,88.36],['Mumbai','孟买',19.08,72.88],['Shanghai','上海',31.23,121.47],['Chengdu','成都',30.57,104.07],
['Bangkok','曼谷',13.76,100.5],['Jakarta','雅加达',-6.2,106.85],['Hanoi','河内',21.03,105.85],['Seoul','首尔',37.57,126.98],
['Tokyo','东京',35.68,139.69],['Singapore','新加坡',1.35,103.82],['Cairo','开罗',30.04,31.24],['Lagos','拉各斯',6.52,3.38],
['Nairobi','内罗毕',-1.29,36.82],['Johannesburg','约翰内斯堡',-26.2,28.05],['Riyadh','利雅得',24.71,46.68],['Tehran','德黑兰',35.69,51.39],
['Istanbul','伊斯坦布尔',41.01,28.98],['Moscow','莫斯科',55.76,37.62],['Warsaw','华沙',52.23,21.01],['Berlin','柏林',52.52,13.4],
['Paris','巴黎',48.86,2.35],['London','伦敦',51.51,-0.13],['Madrid','马德里',40.42,-3.7],['Rome','罗马',41.9,12.5],
['New York','纽约',40.71,-74.0],['Los Angeles','洛杉矶',34.05,-118.24],['Chicago','芝加哥',41.88,-87.63],['Mexico City','墨西哥城',19.43,-99.13],
['Bogota','波哥大',4.71,-74.07],['Lima','利马',-12.05,-77.04],['Santiago','圣地亚哥',-33.45,-70.67],['Sao Paulo','圣保罗',-23.55,-46.63],
['Sydney','悉尼',-33.87,151.21],['Karachi','卡拉奇',24.86,67.0],['Kathmandu','加德满都',27.72,85.32],['Ulaanbaatar','乌兰巴托',47.89,106.91]];
const raw = 'build/raw';
const out = [];
for (const [en, zh, lat, lng] of CITIES) {
  const f = `${raw}/${en.replace(/ /g, '_')}.json`;
  if (!fs.existsSync(f)) {
    const u = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&hourly=pm2_5&past_days=92&forecast_days=0&timezone=UTC`;
    const r = await fetch(u, { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
    if (!r.ok) throw new Error(en + ' ' + r.status);
    fs.writeFileSync(f, await r.text());
    await new Promise((r) => setTimeout(r, 800));
  }
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const by = {};
  j.hourly.time.forEach((t, i) => { const v = j.hourly.pm2_5[i]; if (v != null) (by[t.slice(0, 10)] ||= []).push(v); });
  const days = Object.keys(by).sort().filter((d) => by[d].length >= 20);
  out.push({ en, zh, days, v: days.map((d) => Math.round(by[d].reduce((a, b) => a + b, 0) / by[d].length * 10) / 10) });
}
const dates = [...new Set(out.flatMap((c) => c.days))].sort();
const di = new Map(dates.map((d, i) => [d, i]));
const vals = out.map((c) => { const a = new Array(dates.length).fill(null); c.days.forEach((d, i) => (a[di.get(d)] = c.v[i])); return a; });
// deterministic LCG for puzzle generation
let s = 37; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const puzzles = [];
let tries = 0;
while (puzzles.length < 80 && tries++ < 20000) {
  const t = 14 + Math.floor(rnd() * (dates.length - 14));
  const idx = []; while (idx.length < 5) { const c = Math.floor(rnd() * out.length); if (!idx.includes(c)) idx.push(c); }
  if (idx.some((c) => vals[c][t] == null || vals[c].slice(t - 14, t).filter((x) => x != null).length < 12)) continue;
  const v = idx.map((c) => vals[c][t]).sort((a, b) => a - b);
  if (v[0] < 1 || v.some((x, i) => i && x / v[i - 1] < 1.2)) continue; // distinct enough to be fair
  if (puzzles.some((p) => p.t === t && p.c.some((c) => idx.includes(c)))) continue;
  puzzles.push({ t, c: idx });
}
fs.writeFileSync('data.json', JSON.stringify({
  source: 'Open-Meteo Air Quality API (Copernicus CAMS global reanalysis/forecast)', dates,
  cities: out.map((c, i) => ({ en: c.en, zh: c.zh, lat: CITIES[i][2], lng: CITIES[i][3] })), pm: vals, puzzles }));
console.log(dates.length, puzzles.length, fs.statSync('data.json').size);
