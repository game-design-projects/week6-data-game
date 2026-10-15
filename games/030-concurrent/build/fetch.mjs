// Step 1: download steamcharts hourly "last ~30 days" player series + store name for each candidate app. Cached in raw/.
import fs from 'node:fs';
import { CANDIDATES } from './apps.mjs';
const UA = 'Mozilla/5.0 (daily-data-games class project; lishuyustevenli@gmail.com)';
fs.mkdirSync('raw/steam', { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const id of [...new Set(CANDIDATES)]) {
  const f = `raw/steam/${id}.json`;
  if (fs.existsSync(f)) continue;
  const r = await fetch(`https://steamcharts.com/app/${id}/chart-data.json`, { headers: { 'User-Agent': UA } });
  if (!r.ok) { console.log('skip', id, r.status); fs.writeFileSync(f, '[]'); await sleep(1500); continue; }
  const txt = await r.text();
  fs.writeFileSync(f, txt);
  await sleep(1500);
  const nf = `raw/steam/${id}.name.json`;
  if (!fs.existsSync(nf)) {
    const n = await fetch(`https://store.steampowered.com/api/appdetails?appids=${id}&filters=basic&l=english`, { headers: { 'User-Agent': UA } });
    fs.writeFileSync(nf, await n.text());
    await sleep(1500);
  }
  console.log('ok', id, txt.length);
}
