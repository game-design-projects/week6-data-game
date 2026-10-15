// one-off: real Historical Forecast response for one crossing, trimmed to the 5 frame hours -> fixture.json
import { readFileSync, writeFileSync } from 'node:fs';
import { gridUrl, HOURS } from '../game.js';
const data = JSON.parse(readFileSync('../data.json', 'utf8'));
const sIdx = data.straits.findIndex((s) => s.id === 'cook'), date = '2026-10-14';
const raw = await (await fetch(gridUrl(data.straits[sIdx], 9, date), { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } })).json();
const keep = HOURS.map((h) => `${date}T${String(h).padStart(2, '0')}:00`);
const trim = raw.map((l) => { const idx = keep.map((k) => l.hourly.time.indexOf(k)); return { latitude: l.latitude, longitude: l.longitude, hourly: { time: idx.map((i) => l.hourly.time[i]), wind_speed_10m: idx.map((i) => l.hourly.wind_speed_10m[i]), wind_direction_10m: idx.map((i) => l.hourly.wind_direction_10m[i]) } }; });
writeFileSync('fixture.json', JSON.stringify({ sIdx, date, raw: trim }));
console.log(trim.length, JSON.stringify(trim).length);
