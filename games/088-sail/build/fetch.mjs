import { writeFileSync, existsSync } from 'node:fs';
import { STRAITS, gridPoints } from './straits.mjs';
const DAYS = 9;
const base = Date.UTC(2025, 9, 1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let k = 0; k < STRAITS.length; k++) {
  const s = STRAITS[k], f = `raw/${s.id}.json`;
  if (existsSync(f)) continue;
  const start = new Date(base + k * 23 * 86400000), end = new Date(+start + (DAYS - 1) * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  const pts = gridPoints(s);
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${pts.map((p) => p[0]).join(',')}&longitude=${pts.map((p) => p[1]).join(',')}&start_date=${iso(start)}&end_date=${iso(end)}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&timezone=UTC`;
  for (let tr = 0; tr < 6; tr++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
    const t = await r.text();
    if (r.ok) { writeFileSync(f, t); console.log('ok', s.id, t.length); break; }
    console.log('fail', s.id, r.status, t.slice(0, 100)); await sleep(60000);
  }
  await sleep(8000);
}
