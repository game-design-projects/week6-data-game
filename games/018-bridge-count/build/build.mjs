// raw/ -> ../data.json : fair puzzle days (daily bike totals for four East River bridges + weather) and the
// per-month, weekday/weekend median table used as the "typical day" clue. Reuses the game's own shaping code.
import fs from 'node:fs'; import path from 'node:path';
import { shapeDays, isFair, buildTypical, SENSOR_IDS } from '../game.js';
const raw = path.join(import.meta.dirname, 'raw');
const dot = JSON.parse(fs.readFileSync(path.join(raw, 'dot-daily.json')));
const w = JSON.parse(fs.readFileSync(path.join(raw, 'weather.json'))).daily;
const rows = SENSOR_IDS.flatMap((id) => dot[id].map((r) => ({ sensor_id: id, ...r })));
const all = shapeDays(rows, w);
const days = all.filter(isFair);
const typical = buildTypical(all.filter((d) => d.c.every((v) => v >= 100)));
const out = { typical, days };
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify(out));
console.log(`complete ${all.length}, fair ${days.length} (${days[0].date}..${days.at(-1).date}), bytes ${JSON.stringify(out).length}`);
console.log('typical Jun weekday', typical[5][0], 'Jan weekend', typical[0][1]);
const sums = days.map((d) => d.c.reduce((a, b) => a + b, 0)).sort((a, b) => a - b);
console.log('sum min/p5/med/p95/max', sums[0], sums[sums.length * 0.05 | 0], sums[sums.length >> 1], sums[sums.length * 0.95 | 0], sums.at(-1));
