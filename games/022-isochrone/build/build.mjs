// MTA NYCT subway GTFS -> precomputed 30-minute reachability sets (weekday midday).
import fs from 'node:fs';
const D = new URL('./raw/x/', import.meta.url).pathname;
const csv = (f) => {
  const [h, ...ls] = fs.readFileSync(D + f, 'utf8').trim().split(/\r?\n/);
  const cols = h.split(',');
  return ls.map((l) => { const v = l.split(','); return Object.fromEntries(cols.map((c, i) => [c, v[i]])); });
};
const stops = csv('stops.txt');
const parent = {}; const info = {};
for (const s of stops) {
  if (s.location_type === '1') info[s.stop_id] = { name: s.stop_name, lat: +s.stop_lat, lng: +s.stop_lon };
}
for (const s of stops) parent[s.stop_id] = s.parent_station || s.stop_id;
const trips = {};
for (const t of csv('trips.txt')) if (t.service_id === 'Weekday') trips[t.trip_id] = t.route_id;
console.log('weekday trips', Object.keys(trips).length);
// segment times: median over midday trips
const seg = new Map(); // key route|a|b -> [mins]
const lines = fs.readFileSync(D + 'stop_times.txt', 'utf8').split(/\r?\n/);
const sec = (t) => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + s; };
let prev = null;
for (let i = 1; i < lines.length; i++) {
  const [tid, sid, arr, dep, seq] = lines[i].split(',');
  if (!tid) continue;
  const route = trips[tid];
  if (!route) { prev = null; continue; }
  if (prev && prev.tid === tid) {
    const a = sec(prev.dep);
    if (a >= 10 * 3600 && a <= 15 * 3600) {
      const k = `${route}|${parent[prev.sid]}|${parent[sid]}`;
      if (!seg.has(k)) seg.set(k, []);
      seg.get(k).push((sec(arr) - a) / 60);
    }
  }
  prev = { tid, sid, dep };
}
const med = (a) => { a.sort((x, y) => x - y); return a[a.length >> 1]; };
const adj = {}; // node -> [[node, cost]]
const add = (a, b, c) => { (adj[a] ||= []).push([b, c]); };
const routesAt = {};
for (const [k, v] of seg) {
  const [r, a, b] = k.split('|');
  add(`${a}@${r}`, `${b}@${r}`, med(v));
  for (const s of [a, b]) { (routesAt[s] ||= new Set()).add(r); }
}
const WAIT = 4;
for (const [s, rs] of Object.entries(routesAt)) for (const r of rs) { add(s, `${s}@${r}`, WAIT); add(`${s}@${r}`, s, 0); }
for (const t of csv('transfers.txt')) {
  const a = parent[t.from_stop_id], b = parent[t.to_stop_id];
  if (a !== b && routesAt[a] && routesAt[b]) add(a, b, Math.max(1, +t.min_transfer_time / 60));
}
function reach(src, limit) {
  const dist = { [src]: 0 }; const q = [[0, src]]; const done = new Set();
  while (q.length) {
    q.sort((x, y) => x[0] - y[0]);
    const [d, u] = q.shift();
    if (done.has(u)) continue; done.add(u);
    for (const [v, c] of adj[u] || []) {
      const nd = d + c;
      if (nd <= limit && (dist[v] === undefined || nd < dist[v])) { dist[v] = nd; q.push([nd, v]); }
    }
  }
  const out = {};
  for (const [n, d] of Object.entries(dist)) if (!n.includes('@')) out[n] = d;
  return out;
}
// group stations that share a name+proximity (complexes) as one origin: dedupe by name
const cands = Object.keys(routesAt).filter((s) => info[s]);
const seenName = new Set(); const puzzles = [];
for (const s of cands) {
  const nm = info[s].name;
  const r = reach(s, 30);
  const ids = Object.keys(r);
  if (ids.length < 18) continue;
  puzzles.push({ id: s, name: nm, lat: info[s].lat, lng: info[s].lng, routes: [...routesAt[s]].sort(), r });
}
// seeded-ish deterministic selection: sort by id hash, one per name, spread
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
puzzles.sort((a, b) => hash(a.id) - hash(b.id));
const picked = [];
for (const p of puzzles) {
  if (seenName.has(p.name)) continue;
  if (picked.some((q) => Math.hypot(q.lat - p.lat, (q.lng - p.lng) * 0.76) < 0.004)) continue; // skip near-duplicate complexes
  seenName.add(p.name); picked.push(p);
  if (picked.length >= 120) break;
}
const out = {
  feed: 'MTA NYCT subway GTFS, weekday service, departures 10:00-15:00 medians',
  wait: WAIT,
  puzzles: picked.map((p) => {
    const reached = Object.entries(p.r).filter(([id]) => id !== p.id).map(([id, d]) => [
      +info[id].lat.toFixed(4), +info[id].lng.toFixed(4), Math.round(d * 10) / 10, info[id].name]);
    return { id: p.id, name: p.name, lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5), routes: p.routes, reached };
  }),
};
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out));
console.log('puzzles', out.puzzles.length, 'bytes', fs.statSync(new URL('../data.json', import.meta.url).pathname).size);
