// raw/ -> ../data.json : per-day weather + daily bike totals for four East River bridges.
import fs from 'node:fs'; import path from 'node:path';
const raw = path.join(import.meta.dirname, 'raw');
const K = ['brooklyn', 'manhattan', 'williamsburg', 'queensboro'];
const series = Object.fromEntries(K.map((k) => [k, new Map(JSON.parse(fs.readFileSync(path.join(raw, `daily-${k}.json`))).map((r) => [r.d.slice(0, 10), r]))]));
const w = JSON.parse(fs.readFileSync(path.join(raw, 'weather.json'))).daily;
const days = [];
w.time.forEach((date, i) => {
  const rows = K.map((k) => series[k].get(date));
  if (rows.some((r) => !r || +r.k < 96 || +r.n < 50)) return;
  days.push({ date, c: rows.map((r) => +r.n), hi: Math.round(w.temperature_2m_max[i]), lo: Math.round(w.temperature_2m_min[i]),
    rain: +w.precipitation_sum[i].toFixed(2), snow: +w.snowfall_sum[i].toFixed(1), wind: Math.round(w.wind_speed_10m_max[i]), wc: w.weather_code[i] });
});
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const typical = K.map((_, j) => med(days.map((d) => d.c[j])));
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify({ bridges: ['布鲁克林桥', '曼哈顿桥', '威廉斯堡桥', '皇后区桥'], typical, days }));
console.log(days.length, typical);
