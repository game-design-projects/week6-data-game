// raw OSM + NOAA -> ../data.json. Run: node build/build.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { CITIES } from './cities.mjs';
import { solve, greedy } from '../plow.js';

const LEVELS = [/^(primary|secondary|tertiary)(_link)?$/, /^(primary|secondary)(_link)?$/, /^primary(_link)?$/];
const hav = (a, b) => {
  const R = 6371000, r = Math.PI / 180;
  const dl = (b[0] - a[0]) * r, dn = (b[1] - a[1]) * r;
  const x = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

/** Build a simplified graph from an Overpass dump, keeping everything within `rad` metres (box) of the centre. */
export function buildGraph(osm, center, rad, REQ = LEVELS[0]) {
  const pos = new Map();
  const ways = [];
  for (const el of osm.elements) {
    if (el.type === 'node') pos.set(el.id, [el.lat, el.lon]);
    else if (el.type === 'way') ways.push(el);
  }
  const inside = (p) => Math.abs(hav(p, [center[0], p[1]])) <= rad && Math.abs(hav(p, [p[0], center[1]])) <= rad;
  // raw segments between consecutive nodes
  const seg = new Map(); // "a-b" -> req
  for (const w of ways) {
    const req = REQ.test(w.tags.highway) ? 1 : 0;
    for (let i = 1; i < w.nodes.length; i++) {
      const a = w.nodes[i - 1], b = w.nodes[i];
      if (a === b || !pos.has(a) || !pos.has(b) || !inside(pos.get(a)) || !inside(pos.get(b))) continue;
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      seg.set(k, Math.max(seg.get(k) || 0, req));
    }
  }
  let edges = [...seg].map(([k, req]) => { const [a, b] = k.split('-').map(Number); return { a, b, req, len: hav(pos.get(a), pos.get(b)), pts: [] }; });
  const degOf = () => { const d = new Map(); for (const e of edges) { d.set(e.a, (d.get(e.a) || 0) + 1); d.set(e.b, (d.get(e.b) || 0) + 1); } return d; };
  // prune side-street dead ends
  for (let changed = true; changed;) {
    changed = false;
    const d = degOf();
    const keep = edges.filter((e) => e.req || (d.get(e.a) > 1 && d.get(e.b) > 1));
    if (keep.length !== edges.length) { edges = keep; changed = true; }
  }
  // largest connected component
  const par = new Map();
  const find = (x) => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
  for (const e of edges) { if (!par.has(e.a)) par.set(e.a, e.a); if (!par.has(e.b)) par.set(e.b, e.b); }
  for (const e of edges) par.set(find(e.a), find(e.b));
  const cnt = new Map();
  for (const e of edges) cnt.set(find(e.a), (cnt.get(find(e.a)) || 0) + 1);
  const big = [...cnt].sort((x, y) => y[1] - x[1])[0]?.[0];
  edges = edges.filter((e) => find(e.a) === big);
  // contract degree-2 chains with the same class
  for (let changed = true; changed;) {
    changed = false;
    const inc = new Map();
    edges.forEach((e, i) => { (inc.get(e.a) || inc.set(e.a, []).get(e.a)).push(i); (inc.get(e.b) || inc.set(e.b, []).get(e.b)).push(i); });
    for (const [n, list] of inc) {
      if (list.length !== 2) continue;
      const [i, j] = list;
      const x = edges[i], y = edges[j];
      if (x.req !== y.req || i === j) continue;
      const o1 = x.a === n ? x.b : x.a, o2 = y.a === n ? y.b : y.a;
      if (o1 === o2) continue;
      if (edges.some((e) => (e.a === o1 && e.b === o2) || (e.a === o2 && e.b === o1))) continue;
      edges = edges.filter((_, k) => k !== i && k !== j);
      const px = x.b === n ? x.pts : [...x.pts].reverse();
      const py = y.a === n ? y.pts : [...y.pts].reverse();
      edges.push({ a: o1, b: o2, req: x.req, len: x.len + y.len, pts: [...px, pos.get(n).map((v) => +v.toFixed(5)), ...py] });
      changed = true; break;
    }
  }
  const ids = [...new Set(edges.flatMap((e) => [e.a, e.b]))];
  const idx = new Map(ids.map((id, i) => [id, i]));
  const nodes = ids.map((id) => pos.get(id).map((v) => +v.toFixed(5)));
  // depot: south-west-most node
  let depot = 0;
  nodes.forEach((p, i) => { if (p[0] + p[1] < nodes[depot][0] + nodes[depot][1]) depot = i; });
  return { nodes, edges: edges.map((e) => { const r = [idx.get(e.a), idx.get(e.b), Math.round(e.len), e.req]; if (e.pts.length) r.push(e.pts); return r; }), depot };
}

const hard = (g) => { const r = solve(g, 10); return (r.time - r.plowMin) / r.time >= 0.2; };
// a puzzle only counts if a naive nearest-road driver is clearly beaten by the reference (>= 4% at some depth)
const gap = (g) => Math.max(...[6, 10, 16].map((d) => greedy(g, d).time / solve(g, d).time));
const nreq = (g) => g.edges.filter((e) => e[3]).length;
const ok = (g) => g.nodes.length >= 14 && g.nodes.length <= 60 && nreq(g) >= 6 && nreq(g) <= 13 && g.edges.length <= 100 && hard(g) && gap(g) >= 1.04;

async function main() {
  const areas = [], storms = {};
  for (const c of CITIES) {
    const rows = JSON.parse(await readFile(new URL(`./raw/snow-${c.id}.json`, import.meta.url)));
    const days = rows.filter((r) => r.SNOW && +r.SNOW >= 3).map((r) => ({ d: r.DATE, snow: +r.SNOW, snwd: +(r.SNWD || 0) })).sort((a, b) => b.snow - a.snow);
    const pick = [];
    for (const s of days) if (!pick.some((p) => Math.abs(Date.parse(p.d) - Date.parse(s.d)) < 3 * 864e5)) pick.push(s);
    storms[c.id] = pick.slice(0, 10).sort((a, b) => a.d.localeCompare(b.d));
    for (let i = 0; i < c.pts.length; i++) {
      let osm; try { osm = JSON.parse(await readFile(new URL(`./raw/osm-${c.id}-${i}.json`, import.meta.url))); } catch { continue; }
      let found = false;
      for (const rad of [470, 400, 340, 280, 230, 190]) {
        for (const [lv, REQ] of LEVELS.entries()) {
          const g = buildGraph(osm, c.pts[i], rad, REQ);
          if (ok(g)) { areas.push({ id: `${c.id}${i}`, city: c.id, center: c.pts[i], rad, lv, ...g }); found = true; break; }
        }
        if (found) break;
      }
    }
    console.log(c.id, 'areas', areas.filter((a) => a.city === c.id).length, 'storms', storms[c.id].length, storms[c.id].map((s) => s.snow).join(','));
  }
  // drop cities without storms
  const cities = Object.fromEntries(CITIES.map((c) => [c.id, { name: c.name, station: c.st }]));
  // reference routes are precomputed per (area, storm): refs[areaId][stormIndex] = { seq, time, plowMin }
  const refs = {};
  for (const a of areas) {
    refs[a.id] = storms[a.city].map((s) => { const r = solve(a, s.snow); return { seq: r.seq, time: +r.time.toFixed(2), plowMin: +r.plowMin.toFixed(2), greedy: +greedy(a, s.snow).time.toFixed(2) }; });
    console.log('ref', a.id);
  }
  const out = { cities, storms, areas, refs, built: new Date().toISOString().slice(0, 10) };
  // sanity: solver runs on one sample
  const t0 = Date.now(); const a = areas[0]; const r = solve(a, 8);
  console.log('solve sample', Date.now() - t0, 'ms', r.time.toFixed(1), 'min');
  await writeFile(new URL('../data.json', import.meta.url), JSON.stringify(out));
  console.log('areas', areas.length, 'bytes', JSON.stringify(out).length);
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) await main();
