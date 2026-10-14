import { writeFileSync, existsSync } from 'node:fs';
const f = 'raw/hurdat2-atl.txt';
if (!existsSync(f)) {
  const r = await fetch('https://www.nhc.noaa.gov/data/hurdat/hurdat2-1851-2025-02272026.txt', { headers: { 'User-Agent': 'daily-data-games class project' } });
  if (!r.ok) throw new Error(r.status);
  writeFileSync(f, await r.text());
}
console.log('ok');
