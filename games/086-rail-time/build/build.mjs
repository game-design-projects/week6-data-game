// Amtrak GTFS -> data.json : fastest scheduled station-to-station times.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const dir = path.dirname(new URL(import.meta.url).pathname);
const raw = path.join(dir, 'raw');
fs.mkdirSync(raw, { recursive: true });
if (!fs.existsSync(path.join(raw, 'amtrak.zip'))) {
  execFileSync('curl', ['-sL', '-A', 'daily-data-games/1.0', '-o', path.join(raw, 'amtrak.zip'), 'https://content.amtrak.com/content/gtfs/GTFS.zip']);
}
if (!fs.existsSync(path.join(raw, 'am/stop_times.txt'))) {
  fs.mkdirSync(path.join(raw, 'am'), { recursive: true });
  execFileSync('unzip', ['-oq', path.join(raw, 'amtrak.zip'), '-d', path.join(raw, 'am')]);
}
const csv = (f) => {
  const [h, ...rows] = fs.readFileSync(path.join(raw, 'am', f), 'utf8').trim().split(/\r?\n/);
  const cols = h.split(',');
  return rows.map((l) => {
    const out = []; let cur = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur);
    return Object.fromEntries(cols.map((c, i) => [c, out[i]]));
  });
};
const routes = new Map(csv('routes.txt').filter((r) => r.route_type === '2').map((r) => [r.route_id, r.route_long_name]));
const stops = new Map(csv('stops.txt').map((s) => [s.stop_id, s]));
const trips = new Map(csv('trips.txt').filter((t) => routes.has(t.route_id)).map((t) => [t.trip_id, t]));
const offCache = {};
const stdOffsetMin = (tz) => offCache[tz] ??= (() => {
  const d = new Date('2026-12-01T12:00:00Z');
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(d).map((x) => [x.type, x.value]));
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - d.getTime()) / 60000;
})();
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const byTrip = new Map();
for (const st of csv('stop_times.txt')) {
  if (!trips.has(st.trip_id)) continue;
  (byTrip.get(st.trip_id) ?? byTrip.set(st.trip_id, []).get(st.trip_id)).push(st);
}
const pairs = new Map(); const stationTrips = {};
for (const [tid, sts] of byTrip) {
  sts.sort((a, b) => a.stop_sequence - b.stop_sequence);
  const trip = trips.get(tid);
  // local clock -> UTC minutes (monotonic: add days if it goes backwards)
  let prev = -1e9; let dayAdd = 0;
  const utc = sts.map((s) => {
    const off = stdOffsetMin(stops.get(s.stop_id).stop_timezone);
    const a = toMin(s.arrival_time), d = toMin(s.departure_time);
    let u = a - off + dayAdd;
    while (u < prev - 1) { dayAdd += 1440; u += 1440; }
    const dep = d - off + dayAdd + (u - (a - off + dayAdd)); prev = Math.max(u, dep);
    return { id: s.stop_id, arr: u, dep: Math.max(dep, u), pu: s.pickup_type === '0', dr: s.drop_off_type === '0' };
  });
  for (const s of utc) stationTrips[s.id] = (stationTrips[s.id] ?? 0) + 1;
  for (let i = 0; i < utc.length; i++) for (let j = i + 1; j < utc.length; j++) {
    if (!utc[i].pu || !utc[j].dr) continue;
    const m = utc[j].arr - utc[i].dep;
    if (m <= 0 || m > 4000) continue;
    const k = `${utc[i].id}>${utc[j].id}`;
    const e = pairs.get(k) ?? { a: utc[i].id, b: utc[j].id, min: 1e9, max: 0, n: 0, train: '', no: '' };
    e.n++; e.max = Math.max(e.max, m);
    if (m < e.min) { e.min = m; e.train = routes.get(trip.route_id); e.no = trip.trip_short_name; }
    pairs.set(k, e);
  }
}
const rad = Math.PI / 180;
const km = (p, q) => { const dl = (q.lng - p.lng) * rad, a = Math.sin(((q.lat - p.lat) * rad) / 2) ** 2 + Math.cos(p.lat * rad) * Math.cos(q.lat * rad) * Math.sin(dl / 2) ** 2; return 12742 * Math.asin(Math.sqrt(a)); };
const nm = (id) => stops.get(id).stop_name.replace(/ (Amtrak )?(Union )?(Station|Depot|Transportation Center|Transit Center)$/i, '').replace(/\bAmtrak\b/g, '').replace(/^Ny Moynihan Train Hall At Penn$/i, 'New York Penn').replace(/^Bwi /i, 'BWI ').replace(/ Union Passenger Terminal/i, '').replace(/\s+/g, ' ').trim();
const P = (id) => ({ lat: +stops.get(id).stop_lat, lng: +stops.get(id).stop_lon });
const major = new Set(Object.entries(stationTrips).sort((a, b) => b[1] - a[1]).slice(0, 140).map((x) => x[0]));
const seen = new Set(); const cands = [];
for (const e of [...pairs.values()].sort((x, y) => x.min - y.min)) {
  if (!major.has(e.a) || !major.has(e.b)) continue;
  const key = [e.a, e.b].sort().join('|'); if (seen.has(key)) continue; seen.add(key);
  const d = km(P(e.a), P(e.b));
  if (d < 90 || d > 4000) continue;
  const spd = d / (e.min / 60);
  if (spd < 20 || spd > 200) continue;
  cands.push({ a: { id: e.a, name: nm(e.a), ...P(e.a) }, b: { id: e.b, name: nm(e.b), ...P(e.b) }, km: Math.round(d), min: e.min, slow: e.max, n: e.n, train: e.train, no: e.no });
}
// stratify by distance, deterministic thinning
cands.sort((x, y) => x.km - y.km);
const per = {}; const keep = [];
cands.forEach((c, i) => { if (i % 3) return; per[c.train] = (per[c.train] ?? 0) + 1; if (per[c.train] <= 8) keep.push(c); });
console.log('pairs', pairs.size, 'cands', cands.length, 'kept', keep.length);
fs.writeFileSync(path.join(dir, '../data.json'), JSON.stringify({ feed: 'Amtrak GTFS 2026-10-14', pairs: keep }));
