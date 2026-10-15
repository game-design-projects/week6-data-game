// Downloads ERA5 reanalysis (Open-Meteo archive API) for the 9x9 wind grid of each crossing -> raw/<id>.json (cached),
// plus the Natural Earth land polygons used for the land mask. Usage: node fetch.mjs
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STRAITS, gridPoints } from './straits.mjs';
import { ensureLandRaw } from './land.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(HERE, 'raw'), { recursive: true });
const DAYS = 10;
const base = Date.UTC(2026, 5, 1); // 2026-06-01, staggered per crossing so the pool covers many weather situations
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await ensureLandRaw();
for (let k = 0; k < STRAITS.length; k++) {
  const s = STRAITS[k], f = join(HERE, `raw/${s.id}.json`);
  if (existsSync(f)) continue;
  const start = new Date(base + k * 7 * 86400000), end = new Date(+start + (DAYS - 1) * 86400000);
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
