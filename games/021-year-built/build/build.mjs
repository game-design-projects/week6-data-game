// raw/wd.json (Wikidata SPARQL, see q.rq) -> data.json ; licence info from Commons API (cached raw/commons.json)
import fs from 'node:fs';
const UA = 'daily-data-games/1.0 (class project)';
const rows = JSON.parse(fs.readFileSync('raw/wd.json')).results.bindings;
const m = new Map();
for (const x of rows) {
  const id = x.b.value.split('/').pop();
  const y = +x.inc.value.slice(0, 4);
  const file = decodeURIComponent(x.img.value.split('FilePath/').pop());
  if (!m.has(id)) m.set(id, { id, n: x.bLabel.value, y, file, lat: +(+x.lat.value).toFixed(4), lng: +(+x.lon.value).toFixed(4) });
}
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const buckets = [[1700,1849],[1850,1899],[1900,1919],[1920,1939],[1940,1959],[1960,1979],[1980,1999],[2000,2025]];
let cand = [...m.values()].filter((b) => /\.jpe?g$/i.test(b.file) && b.y >= 1700 && b.y <= 2025 && !/\d{4}/.test(b.n) && !/^Q\d+$/.test(b.n)
  && !/(map|plan|view of|panorama|skyline|aerial)/i.test(b.file) && !/(alma mater|boardwalk|street$|statue|station|bridge|park|cemetery|subway|tunnel)/i.test(b.n));
cand.sort((a, b) => hash(a.id) - hash(b.id));
let pool = [];
for (const [lo, hi] of buckets) pool.push(...cand.filter((b) => b.y >= lo && b.y <= hi).slice(0, 22));
// Commons metadata
const cache = 'raw/commons.json';
let meta = fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache)) : null;
if (!meta) {
  meta = {};
  for (let i = 0; i < pool.length; i += 40) {
    const titles = pool.slice(i, i + 40).map((b) => 'File:' + b.file).join('|');
    const u = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'extmetadata|size', titles });
    const j = await (await fetch(u, { headers: { 'User-Agent': UA } })).json();
    for (const p of Object.values(j.query.pages)) meta[p.title.replace(/^File:/, '').replace(/ /g, '_')] = p.imageinfo?.[0];
    await new Promise((r) => setTimeout(r, 1000));
  }
  fs.writeFileSync(cache, JSON.stringify(meta));
}
const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim().slice(0, 60);
const items = [];
for (const b of pool) {
  const mi = meta[b.file.replace(/ /g, '_')];
  if (!mi || mi.width < 640 || mi.height / mi.width > 1.6) continue;
  const e = mi.extmetadata || {};
  const lic = e.LicenseShortName?.value;
  if (!lic) continue;
  items.push({ id: b.id, name: b.n, year: b.y, lat: b.lat, lng: b.lng, file: b.file, author: strip(e.Artist?.value) || 'Wikimedia Commons', lic });
}
items.sort((a, b) => a.year - b.year);
fs.writeFileSync('../data.json', JSON.stringify({ items }));
console.log(items.length, 'items');
