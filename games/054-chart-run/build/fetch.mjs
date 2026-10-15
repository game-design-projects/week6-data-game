// Downloads the raw Billboard Hot 100 CSVs into build/raw/ (cached). Run: node build/fetch.mjs [--force]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const base = 'https://raw.githubusercontent.com/utdata/rwd-billboard-data/main/data-out/';
const files = { 'hot100_archive.csv': 'hot100_archive_1958_2021.csv', 'cur.csv': 'hot-100-current.csv' };
const dir = fileURLToPath(new URL('./raw/', import.meta.url));
fs.mkdirSync(dir, { recursive: true });
for (const [local, remote] of Object.entries(files)) {
  const f = dir + local;
  if (fs.existsSync(f) && !process.argv.includes('--force')) { console.log('cached', local); continue; }
  const r = await fetch(base + remote, { headers: { 'User-Agent': 'daily-data-054-chart-run/1.0 (class project)' } });
  if (!r.ok) throw new Error(remote + ' ' + r.status);
  fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  console.log('saved', local);
  await new Promise((res) => setTimeout(res, 1500));
}
