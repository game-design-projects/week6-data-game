// Downloads daily top-1000 lists (all days in range) into raw/top-YYYY-MM-DD.json (cached).
import fs from 'node:fs'; import path from 'node:path';
const RAW = path.join(import.meta.dirname, 'raw');
const UA = 'daily-data-games/1.0 (NYU class project; lishuyustevenli@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function cached(file, url) {
  const f = path.join(RAW, file);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.status === 404) { fs.writeFileSync(f, 'null'); return null; }
    if (r.ok) { const t = await r.text(); fs.writeFileSync(f, t); await sleep(150); return JSON.parse(t); }
    await sleep(1500 * (i + 1));
  }
  throw new Error('failed ' + url);
}
export const iso = (t) => new Date(t).toISOString().slice(0, 10);
if (process.argv[1] === import.meta.filename) {
  const start = Date.parse('2026-06-28T00:00:00Z'), end = Date.parse('2026-10-12T00:00:00Z');
  for (let t = start; t <= end; t += 86400000) {
    const [y, m, d] = iso(t).split('-');
    await cached(`top-${iso(t)}.json`, `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${y}/${m}/${d}`);
  }
  console.log('done');
}
