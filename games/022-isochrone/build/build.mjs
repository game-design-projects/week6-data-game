// MTA NYCT subway GTFS -> precomputed 30-minute reachability sets (weekday midday).
// Model: median segment run times (10:00-15:00 weekday departures), 4 min average wait per boarding,
// transfers.txt in-station transfer times, plus walking to a station <= 600 m away (1.3 detour, 80 m/min),
// walking at most once (no walk-walk chains). Run fetch.sh first.
import fs from 'node:fs';
const D = new URL('./raw/x/', import.meta.url).pathname;
const csv = (f) => {
  const [h, ...ls] = fs.readFileSync(D + f, 'utf8').trim().split(/\r?\n/);
  const cols = h.split(',');
  return ls.map((l) => { const v = l.split(','); return Object.fromEntries(cols.map((c, i) => [c, v[i]])); });
};
const stops = csv('stops.txt');
const parent = {}; const info = {};
for (const s of stops) if (s.location_type === '1') info[s.stop_id] = { name: s.stop_name, lat: +s.stop_lat, lng: +s.stop_lon };
for (const s of stops) parent[s.stop_id] = s.parent_station || s.stop_id;
const trips = {};
for (const t of csv('trips.txt')) if (t.service_id === 'Weekday') trips[t.trip_id] = t.route_id;
console.log('weekday trips', Object.keys(trips).length);
const seg = new Map();
const lines = fs.readFileSync(D + 'stop_times.txt', 'utf8').split(/\r?\n/);
const sec = (t) => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + s; };
let prev = null;
for (let i = 1; i < lines.length; i++) {
  const [tid, sid, arr, dep] = lines[i].split(',');
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
const adj = {};
const add = (a, b, c) => { (adj[a] ||= []).push([b, c]); };
const routesAt = {};
for (const [k, v] of seg) {
  const [r, a, b] = k.split('|');
  add(`${a}@${r}`, `${b}@${r}`, med(v));
  for (const s of [a, b]) (routesAt[s] ||= new Set()).add(r);
}
const WAIT = 4;
for (const [s, rs] of Object.entries(routesAt)) for (const r of rs) { add(s, `${s}@${r}`, WAIT); add(`w:${s}`, `${s}@${r}`, WAIT); add(`${s}@${r}`, s, 0); }
for (const t of csv('transfers.txt')) {
  const a = parent[t.from_stop_id], b = parent[t.to_stop_id];
  if (a !== b && routesAt[a] && routesAt[b]) add(a, b, Math.max(1, +t.min_transfer_time / 60));
}
const rad = Math.PI / 180;
const hav = (a, b) => {
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
};
const ids = Object.keys(routesAt).filter((s) => info[s]);
for (const a of ids) for (const b of ids) {
  if (a === b) continue;
  const d = hav(info[a], info[b]);
  if (d <= 0.6) add(a, `w:${b}`, (d * 1000 * 1.3) / 80);
}
class Heap {
  constructor() { this.a = []; }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}
function reach(src, limit) {
  const dist = { [src]: 0 }; const q = new Heap(); q.push([0, src]); const done = new Set();
  while (q.size) {
    const [d, u] = q.pop();
    if (done.has(u)) continue; done.add(u);
    for (const [v, c] of adj[u] || []) {
      const nd = d + c;
      if (nd <= limit && (dist[v] === undefined || nd < dist[v])) { dist[v] = nd; q.push([nd, v]); }
    }
  }
  const out = {};
  for (const [n, d] of Object.entries(dist)) {
    if (n.includes('@')) continue;
    const id = n.startsWith('w:') ? n.slice(2) : n;
    if (out[id] === undefined || d < out[id]) out[id] = d;
  }
  return out;
}
const seenName = new Set(); const puzzles = [];
for (const s of ids) {
  const r = reach(s, 30);
  const me = info[s];
  // drop stations at the origin's own complex (same name or < 300 m): they would sit on top of the answer
  const kept = Object.entries(r).filter(([id]) => id !== s && info[id].name !== me.name && hav(me, info[id]) >= 0.3);
  if (kept.length < 18) continue;
  puzzles.push({ id: s, name: me.name, lat: me.lat, lng: me.lng, routes: [...routesAt[s]].sort(), kept });
}
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
puzzles.sort((a, b) => hash(a.id) - hash(b.id));
const picked = [];
for (const p of puzzles) {
  if (seenName.has(p.name)) continue;
  if (picked.some((q) => Math.hypot(q.lat - p.lat, (q.lng - p.lng) * 0.76) < 0.004)) continue;
  seenName.add(p.name); picked.push(p);
  if (picked.length >= 120) break;
}
// parent stations sharing name + rounded coordinates are one dot; keep the quickest
const dedupe = (rows) => [...rows.reduce((m, r) => { const k = `${r[0]},${r[1]},${r[3]}`; if (!m.has(k) || m.get(k)[2] > r[2]) m.set(k, r); return m; }, new Map()).values()];
const out = {
  feed: 'MTA NYCT subway GTFS, weekday service, departures 10:00-15:00 medians; feed_version ' + csv('feed_info.txt')[0].feed_version,
  wait: WAIT,
  puzzles: picked.map((p) => ({
    id: p.id, name: p.name, lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5), routes: p.routes,
    reached: dedupe(p.kept.map(([id, d]) => [+info[id].lat.toFixed(4), +info[id].lng.toFixed(4), Math.round(d * 10) / 10, info[id].name])),
  })),
};
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out));
console.log('puzzles', out.puzzles.length, 'bytes', fs.statSync(new URL('../data.json', import.meta.url).pathname).size);
