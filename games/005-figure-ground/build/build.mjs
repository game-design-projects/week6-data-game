import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { CITIES } from './cities.mjs';
import { rawName } from './common.mjs';
const here = new URL('.', import.meta.url).pathname;
const CLS = { motorway: 0, trunk: 0, primary: 0, secondary: 0, tertiary: 0, motorway_link: 0, trunk_link: 0, primary_link: 0, secondary_link: 0, tertiary_link: 0,
  residential: 1, unclassified: 1, living_street: 1, service: 2, pedestrian: 2 };
const S = 1000;
function clip(a, b) { // Liang-Barsky on [0,S]^2
  let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0]], [dx, S - a[0]], [-dy, a[1]], [dy, S - a[1]]]) {
    if (p === 0) { if (q < 0) return null; } else { const r = q / p; if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; } }
  }
  return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy]];
}
function dp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts.at(-1)]; let md = 0, mi = 0;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / L; if (d > md) { md = d; mi = i; } }
  return md > eps ? [...dp(pts.slice(0, mi + 1), eps).slice(0, -1), ...dp(pts.slice(mi), eps)] : [a, b];
}
export function build(name, lat, lng, raw, eps = 2) {
  const dl = 500 / 111320, dg = 500 / (111320 * Math.cos(lat * Math.PI / 180));
  const ways = [];
  for (const el of raw.elements) {
    if (el.type !== 'way' || !el.geometry) continue;
    const cls = CLS[el.tags?.highway]; if (cls == null) continue;
    const pts = el.geometry.map((g) => [(g.lon - (lng - dg)) / (2 * dg) * S, ((lat + dl) - g.lat) / (2 * dl) * S]);
    let cur = [];
    const flush = () => { if (cur.length > 1) ways.push([cls, dp(cur, eps)]); cur = []; };
    for (let i = 1; i < pts.length; i++) {
      const c = clip(pts[i - 1], pts[i]);
      if (!c) { flush(); continue; }
      if (!cur.length || Math.hypot(cur.at(-1)[0] - c[0][0], cur.at(-1)[1] - c[0][1]) > 0.5) { flush(); cur.push(c[0]); }
      cur.push(c[1]);
      if (c[1][0] !== pts[i][0] || c[1][1] !== pts[i][1]) flush();
    }
    flush();
  }
  return ways.map(([cls, p]) => { const q = p.map(([x, y]) => [Math.round(x), Math.round(y)]); const out = [cls, q[0][0], q[0][1]]; for (let i = 1; i < q.length; i++) out.push(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]); return out; });
}
const BUDGET = 30000; // bytes of JSON per city
const cities = []; let total = 0;
for (const [name, country, lat, lng, note] of CITIES) {
  const f = here + 'raw/' + rawName(name, lat, lng);
  if (!existsSync(f)) { console.log('missing', name); continue; }
  const raw = JSON.parse(await readFile(f, 'utf8'));
  let ways = build(name, lat, lng, raw);
  let size = JSON.stringify(ways).length;
  if (size > BUDGET) { ways = build(name, lat, lng, raw, 3); size = JSON.stringify(ways).length; }
  if (size > BUDGET) { ways = ways.filter((w) => w[0] < 2); size = JSON.stringify(ways).length; }
  if (ways.length < 40) { console.log('too sparse', name, ways.length); continue; }
  cities.push({ name, country, lat, lng, note, ways }); total += size;
  console.log(name, ways.length, size);
}
await writeFile(here + '../data.json', JSON.stringify({ built: new Date().toISOString().slice(0, 10), cities }));
console.log('cities', cities.length, 'bytes', total);
