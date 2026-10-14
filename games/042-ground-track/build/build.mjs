// raw CelesTrak GP JSON -> data.json (12 h ground tracks via two-body Kepler propagation + Earth rotation)
import fs from 'node:fs';
import { groundTrack, classify } from '../orbit.mjs';
const R = (f) => JSON.parse(fs.readFileSync(new URL(`./raw/${f}.json`, import.meta.url)));
const pools = {};
const add = (cls, list) => (pools[cls] ||= []).push(...list);
const ok = (s) => s.MEAN_MOTION > 0;
add('leo', R('stations').filter((s) => ok(s) && s.INCLINATION > 40 && s.INCLINATION < 75 && s.ECCENTRICITY < 0.02));
add('leo', R('starlink').filter((s) => s.INCLINATION > 40 && s.INCLINATION < 75 && s.ECCENTRICITY < 0.02));
add('sso', [...R('resource'), ...R('weather'), ...R('science')].filter((s) => s.INCLINATION > 96 && s.INCLINATION < 100 && s.ECCENTRICITY < 0.05 && s.MEAN_MOTION > 13 && s.MEAN_MOTION < 16.5));
add('meo', [...R('gps-ops'), ...R('glo-ops'), ...R('galileo')].filter((s) => s.MEAN_MOTION > 1.6 && s.MEAN_MOTION < 2.2 && s.ECCENTRICITY < 0.05));
add('mol', R('molniya').filter((s) => s.ECCENTRICITY > 0.6 && s.MEAN_MOTION > 1.9 && s.MEAN_MOTION < 2.2));
add('geo', R('geo').filter((s) => s.MEAN_MOTION > 0.99 && s.MEAN_MOTION < 1.01 && s.ECCENTRICITY < 0.05));
const N = { leo: 16, sso: 14, meo: 14, mol: 12, geo: 14 };
const sats = [];
for (const [cls, list] of Object.entries(pools)) {
  const seen = new Set();
  const uniq = list.filter((s) => !seen.has(s.NORAD_CAT_ID) && seen.add(s.NORAD_CAT_ID));
  // deterministic spread: sort by RAAN then take evenly spaced
  uniq.sort((a, b) => a.RA_OF_ASC_NODE - b.RA_OF_ASC_NODE || a.NORAD_CAT_ID - b.NORAD_CAT_ID);
  const n = Math.min(N[cls], uniq.length);
  for (let i = 0; i < n; i++) {
    const s = uniq[Math.floor((i * uniq.length) / n)];
    const t = groundTrack(s, 12);
    sats.push({
      id: s.NORAD_CAT_ID, name: s.OBJECT_NAME, cls, epoch: s.EPOCH.slice(0, 16),
      inc: +s.INCLINATION.toFixed(1), ecc: +s.ECCENTRICITY.toFixed(3), periodMin: +(1440 / s.MEAN_MOTION).toFixed(1),
      perigeeKm: Math.round(t.perigeeKm), apogeeKm: Math.round(t.apogeeKm), maxLat: +t.maxLat.toFixed(1),
      track: t.segments,
    });
    if (classify(s) !== cls) console.warn('class mismatch', s.OBJECT_NAME, cls, classify(s));
  }
}
const out = { generated: new Date().toISOString().slice(0, 10), windowH: 12, sats };
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out));
console.log(sats.length, 'sats', (fs.statSync(new URL('../data.json', import.meta.url)).size / 1024).toFixed(0), 'KB', Object.fromEntries(Object.keys(N).map((k) => [k, sats.filter((s) => s.cls === k).length])));
