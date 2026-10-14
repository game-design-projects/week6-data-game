// Fetch public-domain AIC paintings with a style label, then download 200px thumbs. Cached in raw/.
import fs from 'node:fs'; import path from 'node:path';
const raw = path.join(import.meta.dirname, 'raw'); fs.mkdirSync(path.join(raw, 'img'), { recursive: true });
const UA = { 'User-Agent': 'daily-data-games-class/1.0 (NYU assignment)', 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const f = path.join(raw, 'artworks.json');
if (!fs.existsSync(f)) {
  const all = [];
  for (let page = 1; page <= 8; page++) {
    const body = { query: { bool: { must: [{ term: { is_public_domain: true } }, { match: { artwork_type_title: 'Painting' } }, { exists: { field: 'style_title' } }, { exists: { field: 'image_id' } }] } },
      fields: ['id', 'title', 'artist_title', 'date_start', 'date_end', 'style_title', 'image_id', 'place_of_origin'], limit: 100, page };
    const r = await fetch('https://api.artic.edu/api/v1/artworks/search', { method: 'POST', headers: UA, body: JSON.stringify(body) });
    all.push(...(await r.json()).data); console.log('page', page, all.length); await sleep(800);
  }
  fs.writeFileSync(f, JSON.stringify(all));
}
const all = JSON.parse(fs.readFileSync(f));
for (const a of all) {
  const out = path.join(raw, 'img', a.id + '.jpg');
  if (fs.existsSync(out)) continue;
  const r = await fetch(`https://www.artic.edu/iiif/2/${a.image_id}/full/200,/0/default.jpg`, { headers: { 'User-Agent': 'Mozilla/5.0', 'AIC-User-Agent': 'daily-data-games-class (NYU student assignment)' } });
  if (!r.ok) { console.log('skip', a.id, r.status); continue; }
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); await sleep(400);
}
console.log('done');
