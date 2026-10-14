// Two-body Kepler propagation + Earth rotation -> sub-satellite points. Pure, no deps.
const MU = 398600.4418, RE = 6378.137, D2R = Math.PI / 180;
const WE = 7.2921159e-5; // rad/s

export function gmstRad(ms) {
  const d = ms / 86400000 + 2440587.5 - 2451545.0;
  const g = (280.46061837 + 360.98564736629 * d) % 360;
  return ((g + 360) % 360) * D2R;
}

export function solveKepler(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 40; i++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/** Sub-satellite point (lat, lng deg) at t seconds after the element epoch. */
export function subPoint(s, tSec) {
  const n = (s.MEAN_MOTION * 2 * Math.PI) / 86400;
  const a = Math.cbrt(MU / (n * n));
  const e = s.ECCENTRICITY, i = s.INCLINATION * D2R;
  const raan = s.RA_OF_ASC_NODE * D2R, w = s.ARG_OF_PERICENTER * D2R;
  const M = s.MEAN_ANOMALY * D2R + n * tSec;
  const E = solveKepler(((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  const u = w + nu;
  const x = r * (Math.cos(raan) * Math.cos(u) - Math.sin(raan) * Math.sin(u) * Math.cos(i));
  const y = r * (Math.sin(raan) * Math.cos(u) + Math.cos(raan) * Math.sin(u) * Math.cos(i));
  const z = r * Math.sin(u) * Math.sin(i);
  const t0 = Date.parse(s.EPOCH.endsWith('Z') ? s.EPOCH : s.EPOCH + 'Z');
  const th = gmstRad(t0 + tSec * 1000);
  const xe = x * Math.cos(th) + y * Math.sin(th), ye = -x * Math.sin(th) + y * Math.cos(th);
  let lng = Math.atan2(ye, xe) / D2R;
  return { lat: Math.asin(z / r) / D2R, lng, r };
}

/** Ground track over `hours`; returns segments (split at the antimeridian) of [lat10, lng10] integer tenths. */
export function groundTrack(s, hours) {
  const period = 86400 / s.MEAN_MOTION;
  const step = Math.min(period / 36, 600);
  const segs = [[]];
  let prev = null, maxLat = 0, rmin = 1e9, rmax = 0;
  for (let t = 0; t <= hours * 3600 + 1e-6; t += step) {
    const p = subPoint(s, t);
    maxLat = Math.max(maxLat, Math.abs(p.lat)); rmin = Math.min(rmin, p.r); rmax = Math.max(rmax, p.r);
    if (prev !== null && Math.abs(p.lng - prev) > 180) segs.push([]);
    segs[segs.length - 1].push([Math.round(p.lat * 10), Math.round(p.lng * 10)]);
    prev = p.lng;
  }
  return { segments: segs, maxLat, perigeeKm: rmin - RE, apogeeKm: rmax - RE };
}

export function classify(s) {
  const n = s.MEAN_MOTION, e = s.ECCENTRICITY, i = s.INCLINATION;
  if (e > 0.6 && n > 1.9 && n < 2.2) return 'mol';
  if (n > 0.99 && n < 1.01 && e < 0.05) return 'geo';
  if (n > 1.6 && n < 2.2 && e < 0.05) return 'meo';
  if (n > 13 && i > 96 && i < 100) return 'sso';
  return 'leo';
}

/** Bucket index for the highest latitude reached (0..4). */
export const LAT_BUCKETS = ['接近赤道（< 10°）', '10°–40°', '40°–60°', '60°–75°', '近极地（> 75°）'];
export function latBucket(maxLat) {
  return maxLat < 10 ? 0 : maxLat < 40 ? 1 : maxLat < 60 ? 2 : maxLat < 75 ? 3 : 4;
}
export const PERIOD_LADDER = [{ h: 1.5, label: '约 1.5 小时' }, { h: 3, label: '约 3 小时' }, { h: 6, label: '约 6 小时' }, { h: 12, label: '约 12 小时' }, { h: 24, label: '约 24 小时' }];
export function periodBucket(min) {
  const h = min / 60;
  let best = 0;
  PERIOD_LADDER.forEach((p, k) => { if (Math.abs(Math.log(h / p.h)) < Math.abs(Math.log(h / PERIOD_LADDER[best].h))) best = k; });
  return best;
}
