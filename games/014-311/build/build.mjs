// raw 311 aggregates (2025) + MODZCTA polygons -> data.json. Fetch: see fetch.sh
import fs from 'node:fs';
const raw = (f) => JSON.parse(fs.readFileSync(new URL(`./raw/${f}`, import.meta.url)));
const counts = raw('counts.json'), shapes = raw('zipshapes.geojson');
const ZH = JSON.parse(fs.readFileSync(new URL('./zh.json', import.meta.url)));

const byZip = {}; const city = {}; let cityTot = 0;
for (const r of counts) {
  const n = +r.n; if (!r.incident_zip) continue;
  city[r.complaint_type] = (city[r.complaint_type] || 0) + n; cityTot += n;
  (byZip[r.incident_zip] ||= {})[r.complaint_type] = n;
}

const KX = Math.cos(40.7 * Math.PI / 180) * 111.32, KY = 110.57; // km per degree
// shoelace area/centroid in local km, over all rings (holes have opposite winding -> subtract)
function geom(mp) {
  let A = 0, cx = 0, cy = 0;
  const polys = mp.type === 'Polygon' ? [mp.coordinates] : mp.coordinates;
  for (const poly of polys) for (const ring of poly) {
    let a = 0, x = 0, y = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = [ring[i][0] * KX, ring[i][1] * KY], [x1, y1] = [ring[i + 1][0] * KX, ring[i + 1][1] * KY];
      const f = x0 * y1 - x1 * y0; a += f; x += (x0 + x1) * f; y += (y0 + y1) * f;
    }
    A += a / 2; cx += x / 6; cy += y / 6;
  }
  return { area: Math.abs(A), lng: cx / A / KX, lat: cy / A / KY };
}
function dp(pts, eps) { // Douglas-Peucker in km space
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let dmax = 0, idx = 0;
  const dx = (b[0] - a[0]) * KX, dy = (b[1] - a[1]) * KY, L = Math.hypot(dx, dy) || 1e-9;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(((pts[i][0] - a[0]) * KX) * dy - ((pts[i][1] - a[1]) * KY) * dx) / L;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= eps) return [a, b];
  return [...dp(pts.slice(0, idx + 1), eps).slice(0, -1), ...dp(pts.slice(idx), eps)];
}
function outline(mp) { // simplified rings, [lat,lng] rounded, outer rings only, tiny parts dropped
  const polys = mp.type === 'Polygon' ? [mp.coordinates] : mp.coordinates;
  const out = [];
  for (const poly of polys) {
    const r0 = poly[0]; let far = 1, fd = 0;
    for (let i = 1; i < r0.length - 1; i++) { const d = Math.hypot((r0[i][0] - r0[0][0]) * KX, (r0[i][1] - r0[0][1]) * KY); if (d > fd) { fd = d; far = i; } }
    const ring = [...dp(r0.slice(0, far + 1), 0.04).slice(0, -1), ...dp(r0.slice(far), 0.04)];
    if (ring.length < 4) continue;
    const g = geom({ type: 'Polygon', coordinates: [ring] });
    if (g.area < 0.05) continue;
    out.push(ring.map(([x, y]) => [+y.toFixed(4), +x.toFixed(4)]));
  }
  return out;
}

const out = []; const need = new Set(); const dropped = [];
for (const f of shapes.features) {
  const p = f.properties;
  const zips = p.label.split(',').map((s) => s.trim());
  const c = {};
  for (const z of zips) for (const [t, n] of Object.entries(byZip[z] || {})) c[t] = (c[t] || 0) + n;
  const tot = Object.values(c).reduce((a, b) => a + b, 0);
  const g = geom(f.geometry);
  const rEq = Math.sqrt(g.area / Math.PI);
  if (tot < 4000) { dropped.push([p.label, 'few', tot]); continue; }
  if (rEq > 3.2) { dropped.push([p.label, 'big', +rEq.toFixed(1)]); continue; }
  const ent = Object.entries(c).sort((a, b) => b[1] - a[1]);
  const top = ent.slice(0, 8).map(([t, n]) => { need.add(t); return [t, +(100 * n / tot).toFixed(1), +(100 * city[t] / cityTot).toFixed(2)]; });
  const lift = ent.filter(([, n]) => n >= 40).map(([t, n]) => [t, +((n / tot) / (city[t] / cityTot)).toFixed(1)])
    .sort((a, b) => b[1] - a[1]).slice(0, 3);
  lift.forEach(([t]) => need.add(t));
  out.push({ zip: p.label, lat: +g.lat.toFixed(4), lng: +g.lng.toFixed(4), pop: +p.pop_est || 0, total: tot, r: +rEq.toFixed(1), top, lift, poly: outline(f.geometry) });
}
const missing = [...need].filter((t) => !ZH[t]);
if (missing.length) { console.log('MISSING zh:', JSON.stringify(missing)); }
const zh = {}; for (const t of need) zh[t] = ZH[t] || t;
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ year: 2025, zh, zips: out }));
console.log(out.length, 'zips', 'dropped', dropped.length, JSON.stringify(dropped.slice(0, 40)));
