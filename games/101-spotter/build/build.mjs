// raw/candidates.json -> ../data.json
import { readFileSync, writeFileSync } from 'node:fs';
import { AIRPORTS } from './airports.mjs';
const cands = JSON.parse(readFileSync('raw/candidates.json', 'utf8'));
const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const photos = [];
for (const c of cands) {
  if (!c.thumb || !c.date || !c.w || c.w < 800) continue;
  const m = String(c.date).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m || +m[1] < 1990) continue;
  const op = c.operator.replace(/^\s+|\s+$/g, '');
  if (!op || op.length > 40 || c.type.length > 40) continue;
  photos.push({ iata: c.iata, type: c.type, op, thumb: c.thumb, page: c.page, date: `${m[1]}-${m[2]}-${m[3]}`, by: strip(c.artist).slice(0, 60) || 'Wikimedia Commons', lic: c.license || 'CC' });
}
const n = {}; photos.forEach((p) => (n[p.iata] = (n[p.iata] || 0) + 1));
const keep = new Set(Object.keys(n).filter((k) => n[k] >= 2));
const out = {
  airports: AIRPORTS.filter((a) => keep.has(a[0])).map(([iata, en, zh, country, cont, lat, lng]) => ({ iata, en, zh, country, cont, lat, lng })),
  photos: photos.filter((p) => keep.has(p.iata)),
};
writeFileSync('../data.json', JSON.stringify(out));
console.log(out.airports.length, 'airports', out.photos.length, 'photos', JSON.stringify(out).length, 'bytes');
