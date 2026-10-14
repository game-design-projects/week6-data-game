// Fetch top stories per UTC day from the HN Algolia API into build/raw/ (cached).
import fs from 'node:fs';
const DAYS = 80, RAW = new URL('./raw/', import.meta.url).pathname;
const end = Math.floor(Date.now() / 86400000) * 86400; // today 00:00 UTC
for (let i = 1; i <= DAYS; i++) {
  const t1 = end - (i - 1) * 86400, t0 = t1 - 86400;
  const day = new Date(t0 * 1000).toISOString().slice(0, 10);
  const f = `${RAW}${day}.json`;
  if (fs.existsSync(f)) continue;
  const q = encodeURIComponent(`created_at_i>=${t0},created_at_i<${t1},points>=15`);
  const url = `https://hn.algolia.com/api/v1/search?tags=story&numericFilters=${q}&hitsPerPage=1000`;
  const r = await fetch(url, { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
  fs.writeFileSync(f, await r.text());
  console.log(day, r.status);
  await new Promise((r) => setTimeout(r, 400));
}
