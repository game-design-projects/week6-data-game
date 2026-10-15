// Rail Time: GTFS timetables (Amtrak, VIA Rail, DB long-distance, SNCF TGV) -> data.json
// Fastest scheduled direct run between two stations, over all trips in each feed.
// Usage: node build/build.mjs   (downloads into build/raw/, cached; re-runs parse from disk)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const dir = path.dirname(new URL(import.meta.url).pathname);
const raw = path.join(dir, 'raw');
fs.mkdirSync(raw, { recursive: true });

const FEEDS = [
  { id: 'am', op: 'Amtrak', cc: 'US', url: 'https://content.amtrak.com/content/gtfs/GTFS.zip', zip: 'amtrak.zip', quota: 40, cap: 8, major: 140, minKm: 90, tz: null },
  { id: 'via', op: 'VIA Rail', cc: 'CA', url: 'https://www.viarail.ca/sites/all/files/gtfs/viarail.zip', zip: 'via.zip', quota: 12, cap: 4, major: 999, minKm: 90, tz: null },
  { id: 'db', op: 'DB long-distance', cc: 'DE', url: 'https://download.gtfs.de/germany/fv_free/latest.zip', zip: 'db.zip', quota: 40, cap: 3, major: 140, minKm: 90, tz: 'Europe/Berlin' },
  { id: 'tgv', op: 'SNCF TGV', cc: 'FR', url: 'https://eu.ftp.opendatasoft.com/sncf/plandata/export_gtfs_voyages.zip', zip: 'tgv.zip', quota: 22, cap: 3, major: 80, minKm: 90, tz: 'Europe/Paris' },
];

const csvParse = (text) => {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
  const cols = lines[0].split(',');
  return lines.slice(1).map((l) => {
    const out = []; let cur = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur);
    const o = {}; cols.forEach((c, i) => { o[c] = out[i] ?? ''; }); return o;
  });
};
const offCache = {};
const stdOffsetMin = (tz) => offCache[tz] ??= (() => {
  const d = new Date('2026-12-01T12:00:00Z');
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(d).map((x) => [x.type, x.value]));
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - d.getTime()) / 60000;
})();
const toMin = (t) => { const [h, m] = t.trim().split(':').map(Number); return h * 60 + m; };
const rad = Math.PI / 180;
const hav = (p, q) => { const dl = (q.lng - p.lng) * rad, a = Math.sin(((q.lat - p.lat) * rad) / 2) ** 2 + Math.cos(p.lat * rad) * Math.cos(q.lat * rad) * Math.sin(dl / 2) ** 2; return 12742 * Math.asin(Math.sqrt(a)); };
const titleCase = (s) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s\-'’(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : s);

function cleanName(feed, name) {
  let n = name.replace(/^"|"$/g, '');
  if (feed.id === 'am') n = n.replace(/ (Amtrak )?(Union )?(Station|Depot|Transportation Center|Transit Center)$/i, '').replace(/\bAmtrak\b/g, '').replace(/^Ny Moynihan Train Hall At Penn$/i, 'New York Penn').replace(/^Bwi /i, 'BWI ').replace(/ Union Passenger Terminal/i, '');
  if (feed.id === 'tgv') n = titleCase(n).replace(/\bTgv\b/g, 'TGV').replace(/\bSt\b/g, 'St').replace(/-Pierre-/g, '-Pierre-');
  if (feed.id === 'db') {
    const m = n.match(/^([^,]+), (.+)$/);
    if (m) n = m[2].toLowerCase().startsWith(m[1].toLowerCase().split(/[ (]/)[0]) ? m[2] : `${m[1]} ${m[2]}`;
    n = n.replace(/^(S\+U|S|U) /, '').replace(/^(.+?) Bhf \(Berlin\)$/, 'Berlin $1').replace(/^S\+U Berlin Hbf$/, 'Berlin Hbf').replace(/^(Berlin Hbf)( \(tief\))?$/, '$1');
    n = n.replace(/\bHauptbahnhof\b/, 'Hbf').replace(/ Busbf\/Bahnhof| Bahnhof$| Bf$/, '').replace(/ \((oben|tief)\)/, '');
  }
  return n.replace(/\s+/g, ' ').trim();
}

function loadFeed(feed) {
  const zip = path.join(raw, feed.zip), ex = path.join(raw, feed.id);
  if (!fs.existsSync(zip)) execFileSync('curl', ['-sL', '-m', '180', '-A', 'daily-data-games/1.0', '-o', zip, feed.url]);
  if (!fs.existsSync(path.join(ex, 'stop_times.txt'))) { fs.mkdirSync(ex, { recursive: true }); execFileSync('unzip', ['-oq', zip, '-d', ex]); }
  const rd = (f) => csvParse(fs.readFileSync(path.join(ex, f), 'utf8'));
  const routes = new Map(rd('routes.txt').filter((r) => r.route_type === '2').map((r) => [r.route_id, r]));
  const stopsRaw = new Map(rd('stops.txt').map((s) => [s.stop_id, s]));
  // station = parent station if there is one (DB / SNCF), else the stop itself
  const station = (id) => { const s = stopsRaw.get(id); return s?.parent_station && stopsRaw.has(s.parent_station) ? s.parent_station : id; };
  const trips = new Map(rd('trips.txt').filter((t) => routes.has(t.route_id)).map((t) => [t.trip_id, t]));
  const byTrip = new Map();
  for (const st of rd('stop_times.txt')) {
    if (!trips.has(st.trip_id)) continue;
    if (!byTrip.has(st.trip_id)) byTrip.set(st.trip_id, []);
    byTrip.get(st.trip_id).push(st);
  }
  const ok = (v) => v === '' || v === '0';
  const pairs = new Map(); const stationTrips = {};
  for (const [tid, sts] of byTrip) {
    sts.sort((a, b) => a.stop_sequence - b.stop_sequence);
    const trip = trips.get(tid), route = routes.get(trip.route_id);
    let prev = -1e9, dayAdd = 0;
    const utc = sts.map((s) => {
      const sp = stopsRaw.get(s.stop_id);
      const off = stdOffsetMin(feed.tz ?? sp.stop_timezone);
      const a = toMin(s.arrival_time || s.departure_time), d = toMin(s.departure_time || s.arrival_time);
      let u = a - off + dayAdd;
      while (u < prev - 1) { dayAdd += 1440; u += 1440; }
      const dep = Math.max(d - off + dayAdd + (u - (a - off + dayAdd)), u); prev = dep;
      return { id: station(s.stop_id), arr: u, dep, pu: ok(s.pickup_type), dr: ok(s.drop_off_type) };
    });
    const last = utc[utc.length - 1].id;
    for (const s of utc) stationTrips[s.id] = (stationTrips[s.id] ?? 0) + 1;
    let trainName, no;
    if (feed.id === 'db') { trainName = `${route.route_short_name} to ${cleanName(feed, stopsRaw.get(last).stop_name)}`; no = ''; }
    else if (feed.id === 'tgv') { trainName = route.route_long_name; no = trip.trip_headsign; }
    else { trainName = route.route_long_name; no = trip.trip_short_name; }
    for (let i = 0; i < utc.length; i++) for (let j = i + 1; j < utc.length; j++) {
      if (!utc[i].pu || !utc[j].dr || utc[i].id === utc[j].id) continue;
      const m = utc[j].arr - utc[i].dep;
      if (m <= 0 || m > 2900) continue;
      const k = `${utc[i].id}>${utc[j].id}`;
      const e = pairs.get(k) ?? { a: utc[i].id, b: utc[j].id, min: 1e9, max: 0, n: 0 };
      e.n++; e.max = Math.max(e.max, m);
      if (m < e.min) Object.assign(e, { min: m, st: j - i - 1, train: trainName, no, rid: trip.route_id });
      pairs.set(k, e);
    }
  }
  const P = (id) => ({ lat: +(+stopsRaw.get(id).stop_lat).toFixed(4), lng: +(+stopsRaw.get(id).stop_lon).toFixed(4) });
  const major = new Set(Object.entries(stationTrips).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, feed.major).map((x) => x[0]));
  const seen = new Set(); const cands = [];
  for (const e of [...pairs.values()].sort((x, y) => x.min - y.min || (x.a + x.b < y.a + y.b ? -1 : 1))) {
    if (!major.has(e.a) || !major.has(e.b)) continue;
    const key = [e.a, e.b].sort().join('|'); if (seen.has(key)) continue; seen.add(key);
    const d = hav(P(e.a), P(e.b));
    if (d < feed.minKm || d > 4000) continue;
    const spd = d / (e.min / 60);
    if (spd < 20 || spd > 330 || e.min < 25 || e.min > 3000) continue;
    const nm = (id) => cleanName(feed, stopsRaw.get(id).stop_name);
    if (nm(e.a) === nm(e.b) || /^(Hbf|Hauptbahnhof|Bahnhof)/.test(nm(e.a)) || /^(Hbf|Hauptbahnhof|Bahnhof)/.test(nm(e.b))) continue;
    cands.push({ a: { id: e.a.replace(/^StopArea:OCE/, ''), name: nm(e.a), ...P(e.a) }, b: { id: e.b.replace(/^StopArea:OCE/, ''), name: nm(e.b), ...P(e.b) }, km: Math.round(d), min: e.min, slow: e.max, n: e.n, st: e.st, train: e.train, no: e.no, op: feed.op, cc: feed.cc, _rid: e.rid });
  }
  // stratify by distance, deterministic thinning with a per-train cap
  cands.sort((x, y) => x.km - y.km || (x.a.id + x.b.id < y.a.id + y.b.id ? -1 : 1));
  const per = {}; const keep = new Set();
  for (const stride of [Math.max(1, Math.floor(cands.length / feed.quota)), 2, 1]) {
    for (let off = 0; off < stride && keep.size < feed.quota; off++) {
      for (let i = off; i < cands.length && keep.size < feed.quota; i += stride) {
        const c = cands[i]; if (keep.has(c)) continue;
        if ((per[c._rid] ?? 0) >= feed.cap) continue;
        per[c._rid] = (per[c._rid] ?? 0) + 1; keep.add(c);
      }
    }
  }
  const out = cands.filter((c) => keep.has(c)).map(({ _rid, ...c }) => c);
  const fi = fs.existsSync(path.join(ex, 'feed_info.txt')) ? rd('feed_info.txt')[0] : {};
  console.log(feed.id, 'pairs', pairs.size, 'cands', cands.length, 'kept', out.length, 'feed', fi.feed_version ?? fi.feed_start_date ?? '');
  return out;
}
const all = FEEDS.flatMap(loadFeed);
fs.writeFileSync(path.join(dir, '../data.json'), JSON.stringify({ built: '2026-10-15', pairs: all }));
console.log('total', all.length);
