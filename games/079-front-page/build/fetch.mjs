// Fetch every >=15-point story per UTC day from the HN Algolia API into build/raw/ (cached).
// Window: the 120 UTC days ending 2 days before today (same lag the live game uses).
import fs from 'node:fs';
import { apiUrl } from '../game.js';
const DAYS = 120, RAW = new URL('./raw/', import.meta.url).pathname;
fs.mkdirSync(RAW, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
for (let i = 2; i < 2 + DAYS; i++) {
  const day = new Date(Date.parse(today + 'T00:00:00Z') - i * 86400000).toISOString().slice(0, 10);
  const f = `${RAW}${day}.json`;
  if (fs.existsSync(f)) continue;
  const r = await fetch(apiUrl(day), { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
  const txt = await r.text();
  if (!r.ok) { console.error(day, r.status); break; }
  fs.writeFileSync(f, txt);
  console.log(day, r.status);
  await new Promise((r) => setTimeout(r, 500));
}
