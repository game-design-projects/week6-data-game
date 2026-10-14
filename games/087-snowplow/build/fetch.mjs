// Downloads NOAA GHCN-Daily snowfall (NCEI Access Data Service) and OSM roads (Overpass) into build/raw/.
import { mkdir, writeFile, access } from 'node:fs/promises';
import { CITIES } from './cities.mjs';
const UA = 'daily-data-games-class-project (NYU)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);
await mkdir(new URL('./raw/', import.meta.url), { recursive: true });
const R = 0.0042; // ~ half-box in degrees lat (≈ 470 m)
const [W, NW] = (process.argv[2] || '0/1').split('/').map(Number);
for (const [ci, c] of CITIES.entries()) {
  if (ci % NW !== W) continue;
  const sf = new URL(`./raw/snow-${c.id}.json`, import.meta.url);
  if (!(await exists(sf))) {
    const u = `https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries&stations=${c.st}&startDate=2000-01-01&endDate=2026-04-30&dataTypes=SNOW,SNWD&format=json&units=standard`;
    const t = await (await fetch(u, { headers: { 'User-Agent': UA } })).text();
    await writeFile(sf, t); console.log('snow', c.id, t.length); await sleep(1500);
  }
  for (let i = 0; i < c.pts.length; i++) {
    const rf = new URL(`./raw/osm-${c.id}-${i}.json`, import.meta.url);
    if (await exists(rf)) continue;
    const [la, ln] = c.pts[i];
    const dl = R, dn = R / Math.cos(la * Math.PI / 180);
    const bb = `${la - dl},${ln - dn},${la + dl},${ln + dn}`;
    const q = `[out:json][timeout:60];way["highway"~"^(primary|secondary|tertiary|residential|unclassified|primary_link|secondary_link|tertiary_link)$"](${bb});out body;>;out skel qt;`;
    for (let k = 0; k < 4; k++) {
      const EP = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter','https://overpass-api.de/api/interpreter'];
      const res = await fetch(EP[k % EP.length], { method: 'POST', headers: { 'User-Agent': UA, 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
      const t = await res.text();
      if (res.ok && t.startsWith('{')) { await writeFile(rf, t); console.log('osm', c.id, i, t.length); break; }
      console.log('retry', c.id, i, res.status); await sleep(4000);
    }
    await sleep(2500);
  }
}
