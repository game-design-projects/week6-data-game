// raw CelesTrak GP JSON -> data.json (12 h ground tracks via two-body Kepler propagation + Earth rotation)
import fs from 'node:fs';
import { buildSat, classify, edgeMargin } from '../orbit.mjs';
const R = (f) => JSON.parse(fs.readFileSync(new URL(`./raw/${f}.json`, import.meta.url)));
const byName = (list, re) => list.filter((s) => re.test(s.OBJECT_NAME));
// each group: candidates + how many to take (deterministic spread over RAAN); `pin` = always included
const groups = [
  { cls: 'leo', n: 3, pin: byName(R('stations'), /^(ISS \(ZARYA\)|CSS \(TIANHE\))$/), list: [] },
  { cls: 'leo', n: 6, list: R('starlink').filter((s) => s.INCLINATION > 42 && s.INCLINATION < 44 && s.ECCENTRICITY < 0.02) },
  { cls: 'leo', n: 8, list: R('starlink').filter((s) => s.INCLINATION > 52 && s.INCLINATION < 54 && s.ECCENTRICITY < 0.02) },
  { cls: 'leo', n: 4, list: R('starlink').filter((s) => s.INCLINATION > 69 && s.INCLINATION < 71 && s.ECCENTRICITY < 0.02) },
  { cls: 'sso', n: 18, list: [...R('resource'), ...R('weather'), ...R('science')].filter((s) => s.INCLINATION > 96 && s.INCLINATION < 100 && s.ECCENTRICITY < 0.05 && s.MEAN_MOTION > 13 && s.MEAN_MOTION < 16.5) },
  { cls: 'meo', n: 16, list: [...R('gps-ops'), ...R('glo-ops'), ...R('galileo'), ...R('beidou').filter((s) => s.MEAN_MOTION > 1.8 && s.MEAN_MOTION < 1.9)].filter((s) => s.MEAN_MOTION > 1.6 && s.MEAN_MOTION < 2.2 && s.ECCENTRICITY < 0.05) },
  { cls: 'mol', n: 12, list: R('molniya').filter((s) => s.ECCENTRICITY > 0.6 && s.MEAN_MOTION > 1.9 && s.MEAN_MOTION < 2.2) },
  { cls: 'geo', n: 9, list: R('geo').filter((s) => s.MEAN_MOTION > 0.99 && s.MEAN_MOTION < 1.01 && s.ECCENTRICITY < 0.05) },
  { cls: 'geo', n: 6, list: R('beidou').filter((s) => s.MEAN_MOTION > 0.99 && s.MEAN_MOTION < 1.01 && s.INCLINATION > 20) }, // inclined GSO: figure-8
];
const sats = [], seenIds = new Set();
for (const g of groups) {
  const cands = [...(g.pin ?? []), ...g.list.filter((s) => !g.pin?.includes(s))];
  const seen = new Set();
  const uniq = cands.filter((s) => s.MEAN_MOTION > 0 && !seen.has(s.NORAD_CAT_ID) && seen.add(s.NORAD_CAT_ID) && !seenIds.has(s.NORAD_CAT_ID));
  const pins = uniq.filter((s) => g.pin?.includes(s));
  const rest = uniq.filter((s) => !g.pin?.includes(s)).sort((a, b) => a.RA_OF_ASC_NODE - b.RA_OF_ASC_NODE || a.NORAD_CAT_ID - b.NORAD_CAT_ID);
  // walk an evenly spaced sample; skip candidates whose max latitude sits within 1.5° of a bucket edge (unfair to eyeball)
  const chosen = [...pins];
  for (let i = 0; chosen.length < g.n && i < rest.length * 2; i++) {
    const s = rest[Math.floor(((i % rest.length) * rest.length) / Math.max(1, g.n - pins.length)) % rest.length] ?? rest[i % rest.length];
    if (!chosen.includes(s)) chosen.push(s);
  }
  for (const s of chosen) {
    const rec = buildSat(s, g.cls);
    if (edgeMargin(rec.maxLat) < 1.5) { console.warn('skip (edge)', rec.name, rec.maxLat); continue; }
    if (classify(s) !== g.cls) { console.warn('skip (class mismatch)', rec.name); continue; }
    sats.push(rec); seenIds.add(s.NORAD_CAT_ID);
  }
}
const out = { generated: new Date().toISOString().slice(0, 10), windowH: 12, sats };
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out));
const cnt = {}; sats.forEach((s) => (cnt[s.cls] = (cnt[s.cls] || 0) + 1));
console.log(sats.length, 'sats', (fs.statSync(new URL('../data.json', import.meta.url)).size / 1024).toFixed(0), 'KB', cnt);
