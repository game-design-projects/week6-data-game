import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { CITIES } from './cities.mjs';
await mkdir('raw', { recursive: true });
const UA = 'daily-data-games/1.0 (NYU class project; figure-ground)';
const HW = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link';
const ENDPOINTS = ['https://overpass.openstreetmap.fr/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
for (const [name, , lat, lng] of CITIES) {
  const f = `raw/${name.replace(/\W+/g, '_')}.json`;
  if (existsSync(f)) continue;
  const dl = 500 / 111320, dg = 500 / (111320 * Math.cos(lat * Math.PI / 180));
  const q = `[out:json][timeout:60];way["highway"~"^(${HW})$"](${lat - dl},${lng - dg},${lat + dl},${lng + dg});out geom;`;
  let ok = false;
  for (let t = 0; t < 4 && !ok; t++) {
    try {
      const r = await fetch(ENDPOINTS[t % 2], { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(90000) });
      if (!r.ok) throw new Error(r.status);
      const txt = await r.text(); JSON.parse(txt);
      await writeFile(f, txt); ok = true; console.log('ok', name, txt.length);
    } catch (e) { console.log('retry', name, String(e)); await new Promise((r) => setTimeout(r, 8000)); }
  }
  await new Promise((r) => setTimeout(r, 1000));
}
