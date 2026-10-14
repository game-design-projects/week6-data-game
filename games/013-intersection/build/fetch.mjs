import fs from 'node:fs'; import zlib from 'node:zlib'; import cities from './cities.mjs';
const R = 1100, UA = 'daily-data-games/1.0 (NYU class project)';
const EP = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.openstreetmap.fr/api/interpreter'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('raw', { recursive: true });
const todo = cities.filter(([n]) => !fs.existsSync(`raw/${n.replace(/\W/g, '_')}.json.gz`));
async function worker(w) {
  while (todo.length) {
    const [name, , , , , lat, lng] = todo.shift();
    const f = `raw/${name.replace(/\W/g, '_')}.json.gz`;
    const q = `[out:json][timeout:50];way["highway"]["name"](around:${R},${lat},${lng});out geom tags;`;
    let ok = false;
    for (let a = 0; a < 4 && !ok; a++) {
      const ep = EP[(w + a) % 3];
      try {
        const r = await fetch(ep, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(60000) });
        const t = await r.text();
        if (!r.ok || !t.startsWith('{')) throw new Error(`${r.status}`);
        const j = JSON.parse(t);
        const slim = j.elements.map((e) => ({ n: e.tags.name, en: e.tags['name:en'], g: e.geometry?.map((p) => [p.lat, p.lon]) }));
        fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(slim)));
        console.log('ok', name, slim.length); ok = true;
      } catch (e) { console.log('retry', name, ep.slice(8, 20), String(e).slice(0, 60)); await sleep(5000); }
    }
    if (!ok) console.log('GAVE UP', name);
    await sleep(2000);
  }
}
await Promise.all([worker(0), worker(1), worker(2)]);
console.log('done');
