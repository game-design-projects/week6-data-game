// Writes build/fixture.json: one real UTC day (2026-10-10) of USGS M2.5+ events in the FDSN GeoJSON shape the live load() receives.
import fs from 'node:fs';
const DAY = '2026-10-10';
const feats = [];
for (const f of fs.readdirSync(new URL('./raw/', import.meta.url)).filter((f) => f.startsWith('usgs-'))) {
  for (const l of fs.readFileSync(new URL(`./raw/${f}`, import.meta.url), 'utf8').trim().split('\n').slice(1)) {
    if (!l.startsWith(DAY) || !l.includes(',earthquake,')) continue;
    const p = l.split(',');
    const place = p.slice(13).join(',').split(',earthquake,')[0].replace(/^"|"$/g, '');
    feats.push({ type: 'Feature', properties: { mag: +p[4], place, time: Date.parse(p[0]) }, geometry: { type: 'Point', coordinates: [+p[2], +p[1], +p[3]] } });
  }
}
fs.writeFileSync(new URL('./fixture.json', import.meta.url), JSON.stringify({ type: 'FeatureCollection', features: feats }));
console.log(feats.length, 'events');
