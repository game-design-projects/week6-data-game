// Download FRED series (public fredgraph CSV, no key) into build/raw/. Cached.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const raw = join(dirname(fileURLToPath(import.meta.url)), 'raw');
mkdirSync(raw, { recursive: true });
export const SERIES = ['SP500', 'VIXCLS', 'DGS10', 'DCOILWTICO', 'DEXUSEU', 'DEXJPUS', 'DGS2', 'GOLDPMGBD228NLBM'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const id of SERIES) {
  const f = join(raw, `${id}.csv`);
  if (existsSync(f)) continue;
  for (let a = 1; a <= 5; a++) {
    try {
      const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=1997-01-01&coed=2026-09-30`, { headers: { 'User-Agent': 'daily-data-games class project' }, signal: AbortSignal.timeout(60000) });
      const t = await r.text();
      if (r.ok && t.startsWith('observation_date') || t.startsWith('DATE')) { writeFileSync(f, t); console.log(id, t.split('\n').length, 'rows'); break; }
      console.log(id, 'bad', r.status, t.slice(0, 80));
    } catch (e) { console.log(id, 'attempt', a, e.message); }
    await sleep(3000);
  }
  await sleep(1500);
}
