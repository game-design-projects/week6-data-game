// Fetch front-page OCR (ALTO XML) of random Chronicling America issues, 1840-1963, cached in raw/.
import fs from 'node:fs'; import path from 'node:path';
const RAW = path.join(import.meta.dirname, 'raw'); const UA = 'daily-data-games-class-project/1.0 (student)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, file, json) {
  const f = path.join(RAW, file);
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      if (r.status === 429) { await sleep(20000); continue; }
      if (!r.ok) return null;
      const t = await r.text(); fs.writeFileSync(f, t); await sleep(1200); return t;
    } catch (e) { await sleep(3000); }
  }
  return null;
}
const [Y0, Y1] = [Number(process.argv[2] || 1840), Number(process.argv[3] || 1963)];
let seed = 49 + Y0; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const PER_YEAR = 4;
for (let year = Y0; year <= Y1; year++) {
  const first = await get(`https://www.loc.gov/collections/chronicling-america/?fo=json&c=100&dates=${year}&sp=1&at=results,pagination`, `s-${year}-1.json`);
  if (!first) continue;
  const total = JSON.parse(first).pagination?.total ?? 1;
  const pages = Math.min(total, 40);
  const sp = 1 + Math.floor(rnd() * pages);
  const t = await get(`https://www.loc.gov/collections/chronicling-america/?fo=json&c=100&dates=${year}&sp=${sp}&at=results`, `s-${year}-${sp}.json`);
  if (!t) continue;
  const items = JSON.parse(t).results.filter((r) => r.image_url?.[0] && /^\d{4}-\d{2}-\d{2}$/.test(r.date || ''));
  const seen = new Set(); let n = 0;
  for (const r of items.sort(() => rnd() - 0.5)) {
    if (n >= PER_YEAR) break;
    if (seen.has(r.title)) continue; seen.add(r.title);
    const m = r.image_url[0].match(/service:(.+?)\/full/); if (!m) continue;
    const p = m[1].split(':'); const url = `https://tile.loc.gov/storage-services/service/${p.join('/')}.xml`;
    const id = `${year}-${p.slice(-3).join('_')}`;
    const x = await get(url, `a-${id}.xml`);
    fs.writeFileSync(path.join(RAW, `m-${id}.json`), JSON.stringify({ id, date: r.date, title: r.title, url: r.url, state: r.location_state?.[0], city: r.location_city?.[0], xml: url }));
    if (x) n++;
  }
  console.log(year, total, sp, n);
}
