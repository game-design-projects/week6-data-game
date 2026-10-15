// Step 2: for every Wikidata candidate, look up PLUTO lots within ~45 m (NYC Open Data, Socrata 64uk-42ks).
// Cached per Wikidata id in raw/pluto.json so reruns are free. Run from build/: node fetch-pluto.mjs
import fs from 'node:fs';
import { candidates } from './lib.mjs';
const UA = 'daily-data-games/1.0 (NYU class project)';
const cache = 'raw/pluto.json';
const out = fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache)) : {};
const cands = candidates();
console.log(cands.length, 'candidates,', Object.keys(out).length, 'cached');
let n = 0;
for (const b of cands) {
  if (out[b.id]) continue;
  const dLat = 0.0004, dLng = 0.0005;
  const u = 'https://data.cityofnewyork.us/resource/64uk-42ks.json?' + new URLSearchParams({
    $select: 'address,borough,yearbuilt,numfloors,bldgclass,landuse,latitude,longitude,zipcode',
    $limit: '40',
    $where: `latitude::number between ${b.lat - dLat} and ${b.lat + dLat} and longitude::number between ${b.lng - dLng} and ${b.lng + dLng}`,
  });
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(r.status);
      out[b.id] = await r.json();
      break;
    } catch (e) { console.warn('retry', b.id, e.message); await new Promise((r) => setTimeout(r, 2000)); }
  }
  if (++n % 50 === 0) { fs.writeFileSync(cache, JSON.stringify(out)); console.log(n); }
  await new Promise((r) => setTimeout(r, 200));
}
fs.writeFileSync(cache, JSON.stringify(out));
console.log('done', Object.keys(out).length);
