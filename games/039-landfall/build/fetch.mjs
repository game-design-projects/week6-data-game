// Downloads HURDAT2 (Atlantic + NE/N Pacific) into build/raw/ (cached).
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
mkdirSync('raw', { recursive: true });
const files = {
  'raw/hurdat2-atl.txt': 'https://www.nhc.noaa.gov/data/hurdat/hurdat2-1851-2025-02272026.txt',
  'raw/hurdat2-nepac.txt': 'https://www.nhc.noaa.gov/data/hurdat/hurdat2-nepac-1949-2025-02272026.txt',
};
for (const [f, url] of Object.entries(files)) {
  if (existsSync(f)) continue;
  const r = await fetch(url, { headers: { 'User-Agent': 'daily-data-games class project' } });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  writeFileSync(f, await r.text());
  await new Promise((r) => setTimeout(r, 1500));
}
console.log('ok');
