// Download market series into build/raw/ (cached; delete a file to refetch).
//  - FRED public fredgraph.csv (no key): VIX, yields, WTI, FX
//  - Yahoo Finance chart API (no key): S&P 500, Nasdaq Composite, gold futures (FRED only keeps ~10y of equity indices)
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const raw = join(dirname(fileURLToPath(import.meta.url)), 'raw');
mkdirSync(raw, { recursive: true });
export const FRED = ['VIXCLS', 'DGS10', 'DGS2', 'DGS3MO', 'DCOILWTICO', 'DEXUSEU', 'DEXJPUS', 'DEXUSUK', 'DEXSZUS', 'DEXCHUS'];
export const YAHOO = { SPX: '^GSPC', IXIC: '^IXIC', GOLD: 'GC=F' };
const UA = 'Mozilla/5.0 (daily-data-games class project)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, file, ok) {
  if (existsSync(file)) return;
  for (let a = 1; a <= 5; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      const t = await r.text();
      if (r.ok && ok(t)) { writeFileSync(file, t); console.log(file.split('/').pop(), t.length, 'bytes'); return; }
      console.log('bad', url, r.status, t.slice(0, 80));
    } catch (e) { console.log('attempt', a, url, e.message); }
    await sleep(3000);
  }
}
for (const id of FRED) {
  await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=1997-01-01&coed=2026-09-30`, join(raw, `${id}.csv`), (t) => /^(observation_date|DATE)/.test(t));
  await sleep(1500);
}
for (const [k, sym] of Object.entries(YAHOO)) {
  await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=852076800&period2=1790000000&interval=1d`, join(raw, `${k}.json`), (t) => t.includes('"timestamp"'));
  await sleep(1500);
}
