// Natural Earth 1:50m land (world-atlas land-50m TopoJSON) -> point-in-land test, used only at build time.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = join(HERE, 'raw/land-50m.json');
export const LAND_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json';

export async function ensureLandRaw() {
  if (existsSync(RAW)) return;
  const r = await fetch(LAND_URL, { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
  if (!r.ok) throw new Error(`land-50m ${r.status}`);
  writeFileSync(RAW, await r.text());
}

function decodeArcs(t) {
  const [sx, sy] = t.transform.scale, [tx, ty] = t.transform.translate;
  return t.arcs.map((arc) => { let x = 0, y = 0; return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
}

/** returns { polys: [{bbox, rings}] } with rings as [[lng,lat],…] */
export function loadLand() {
  const t = JSON.parse(readFileSync(RAW, 'utf8')), arcs = decodeArcs(t);
  const ring = (idx) => idx.flatMap((i, k) => { const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse(); return k ? a.slice(1) : a; });
  const polys = [];
  const add = (rings) => {
    const rs = rings.map(ring); let w = 1e9, s = 1e9, e = -1e9, n = -1e9;
    for (const [x, y] of rs[0]) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
    polys.push({ bbox: [w, s, e, n], rings: rs });
  };
  for (const g of t.objects.land.geometries) {
    if (g.type === 'Polygon') add(g.arcs); else if (g.type === 'MultiPolygon') g.arcs.forEach(add);
  }
  return polys;
}
const inRing = (r, x, y) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
export function isLand(polys, lat, lng) {
  for (const p of polys) {
    const [w, s, e, n] = p.bbox; if (lng < w || lng > e || lat < s || lat > n) continue;
    let c = false; for (const r of p.rings) if (inRing(r, lng, lat)) c = !c;
    if (c) return true;
  }
  return false;
}
