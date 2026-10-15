// Download named roads around each city centre from Overpass into build/raw/ (cached; gitignored).
// Run from build/:  node fetch.mjs
import fs from 'node:fs'; import zlib from 'node:zlib'; import cities from './cities.mjs';
const UA = 'daily-data-games/1.0 (NYU class project; contact via github StevenLi-phoenix)';
const EP = ['https://overpass-api.de/api/interpreter', 'https://overpass.openstreetmap.fr/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const HW = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link';
const RADII = [3000, 2000, 1200];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('raw', { recursive: true });
const file = (name) => `raw/${name.replace(/\W/g, '_')}.r3.json.gz`;
const todo = cities.filter(([n]) => !fs.existsSync(file(n)));
async function worker(w) {
  while (todo.length) {
    const [name, , , , , lat, lng] = todo.shift();
    let ok = false;
    for (let a = 0; a < 6 && !ok; a++) {
      const R = RADII[Math.min(RADII.length - 1, a >> 1)];
      const ep = EP[(w + a) % EP.length];
      const q = `[out:json][timeout:90];way["highway"~"^(${HW})$"]["name"](around:${R},${lat},${lng});out geom tags;`;
      try {
        const r = await fetch(ep, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(100000) });
        const t = await r.text();
        if (!r.ok || !t.startsWith('{')) throw new Error(`${r.status}`);
        const j = JSON.parse(t);
        if (!j.elements?.length) throw new Error('empty');
        const slim = j.elements.map((e) => ({ n: e.tags.name, en: e.tags['name:en'], h: e.tags.highway, g: e.geometry?.map((p) => [p.lat, p.lon]) }));
        fs.writeFileSync(file(name), zlib.gzipSync(JSON.stringify({ R, ways: slim })));
        console.log('ok', name, R, slim.length); ok = true;
      } catch (e) { console.log('retry', name, R, ep.slice(8, 22), String(e).slice(0, 60)); await sleep(8000); }
    }
    if (!ok) console.log('GAVE UP', name);
    await sleep(3000);
  }
}
await Promise.all([worker(0), worker(1)]);
console.log('done');
