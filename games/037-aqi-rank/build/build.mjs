// Fetch hourly PM2.5 (CAMS via Open-Meteo) for 50 cities, build daily means + puzzle pool + a tiny live fixture.
// Run from the game folder: node build/build.mjs   (raw responses cached in build/raw/)
import fs from 'node:fs';
import { CITIES } from './cities.mjs';
import { dailyMeans, validSet } from '../shape.js';

const START = '2026-07-06', END = '2026-10-14'; // 101 days; last day final
const raw = 'build/raw';
fs.mkdirSync(raw, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BATCH = 10;
const responses = [];
for (let i = 0; i < CITIES.length; i += BATCH) {
  const part = CITIES.slice(i, i + BATCH);
  const f = `${raw}/batch${i / BATCH}_${START}_${END}.json`;
  if (!fs.existsSync(f)) {
    const u = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${part.map((c) => c[2]).join(',')}&longitude=${part.map((c) => c[3]).join(',')}&hourly=pm2_5&start_date=${START}&end_date=${END}&timezone=UTC`;
    const r = await fetch(u, { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
    const txt = await r.text();
    if (!r.ok) throw new Error(`batch ${i} ${r.status} ${txt.slice(0, 100)}`);
    fs.writeFileSync(f, txt);
    await sleep(1500);
  }
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  responses.push(...(Array.isArray(j) ? j : [j]));
}
if (responses.length !== CITIES.length) throw new Error('response count mismatch');
const cityDays = responses.map((j) => dailyMeans(j));          // [{date: mean|null}]
const dates = []; for (let d = START; d <= END; d = new Date(Date.parse(d + 'T00:00Z') + 864e5).toISOString().slice(0, 10)) dates.push(d);
const pm = cityDays.map((m) => dates.map((d) => (m[d] ?? null)));

// deterministic LCG for puzzle generation
let s = 37; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const puzzles = []; let tries = 0;
while (puzzles.length < 90 && tries++ < 50000) {
  const t = 14 + Math.floor(rnd() * (dates.length - 14));
  const idx = []; while (idx.length < 5) { const c = Math.floor(rnd() * CITIES.length); if (!idx.includes(c)) idx.push(c); }
  if (!validSet(idx.map((c) => ({ prev: pm[c].slice(t - 14, t), val: pm[c][t] })))) continue;
  if (puzzles.some((p) => p.t === t && p.c.some((c) => idx.includes(c)))) continue;
  puzzles.push({ t, c: idx });
}
fs.writeFileSync('data.json', JSON.stringify({
  source: 'Open-Meteo Air Quality API (Copernicus CAMS global reanalysis/forecast)', dates,
  cities: CITIES.map(([en, zh, lat, lng]) => ({ en, zh, lat, lng })), pm, puzzles }));
console.log(dates.length, puzzles.length, fs.statSync('data.json').size);

// live fixture: Beijing, Delhi, Chicago, 15 days up to 2026-10-14 (hourly, as the API returns it)
const fx = [0, 1, 30].map((i) => { const j = responses[i]; const keep = j.hourly.time.map((t, k) => (t.slice(0, 10) >= '2026-09-30' ? k : -1)).filter((k) => k >= 0);
  return { latitude: j.latitude, longitude: j.longitude, hourly: { time: keep.map((k) => j.hourly.time[k]), pm2_5: keep.map((k) => j.hourly.pm2_5[k]) } }; });
fs.writeFileSync('build/fixture.json', JSON.stringify({ day: '2026-10-14', idx: [0, 1, 30], raw: fx }));
