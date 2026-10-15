// Downloads raw sources into build/raw/ (cached; delete a file to refetch).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = new URL('./raw/', import.meta.url);
fs.mkdirSync(dir, { recursive: true });
const UA = { 'user-agent': 'week6-daily-data-build/1.0 (student project)' };
const files = [
  ['hyg.csv', 'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv'],
  ['constellations.lines.json', 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json'],
  ['countryInfo.txt', 'https://download.geonames.org/export/dump/countryInfo.txt'],
  ['cities15000.zip', 'https://download.geonames.org/export/dump/cities15000.zip'],
];
for (const [name, url] of files) {
  const p = new URL(name, dir);
  if (fs.existsSync(p) && fs.statSync(p).size > 1000) { console.log('cached', name); continue; }
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  fs.writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  console.log('fetched', name);
  await new Promise((res) => setTimeout(res, 1500));
}
if (!fs.existsSync(new URL('cities15000.txt', dir))) execFileSync('unzip', ['-o', '-d', dir.pathname, new URL('cities15000.zip', dir).pathname]);
