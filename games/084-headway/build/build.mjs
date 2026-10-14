// raw GTFS (MTA NYC subway) -> data.json : pool of 15-minute arrival "beat maps"
import fs from 'node:fs';
import readline from 'node:readline';
const RAW = new URL('./raw/x/', import.meta.url).pathname;
const csv = (f) => fs.readFileSync(RAW + f, 'utf8').trim().split(/\r?\n/).map((l) => l.split(','));
const rows = (f) => { const [h, ...r] = csv(f); return r.map((c) => Object.fromEntries(h.map((k, i) => [k, c[i]]))); };

const stops = new Map(rows('stops.txt').map((s) => [s.stop_id, s]));
const trips = new Map(rows('trips.txt').map((t) => [t.trip_id, t]));
const SERVICES = { Weekday: '工作日', Saturday: '周六', Sunday: '周日' };
const sec = (t) => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + s; };

const plat = new Map(); // stop_id|service -> {arr:[[sec,route]], heads:Map}
const rl = readline.createInterface({ input: fs.createReadStream(RAW + 'stop_times.txt') });
let first = true;
for await (const line of rl) {
  if (first) { first = false; continue; }
  const [tid, sid, arr] = line.split(',');
  const t = trips.get(tid);
  if (!t || !SERVICES[t.service_id]) continue;
  const k = `${sid}|${t.service_id}`;
  let p = plat.get(k); if (!p) plat.set(k, p = { arr: [], heads: new Map() });
  p.arr.push([sec(arr), t.route_id.replace(/X$/, '')]);
  p.heads.set(t.trip_headsign, (p.heads.get(t.trip_headsign) || 0) + 1);
}

const WIN = 15 * 60;
const cands = [];
for (const [k, p] of plat) {
  const [sid, service] = k.split('|');
  if (!/[NS]$/.test(sid)) continue;
  p.arr.sort((a, b) => a[0] - b[0]);
  const head = [...p.heads].sort((a, b) => b[1] - a[1])[0][0];
  for (let start = 5 * 3600; start <= 25 * 3600; start += 30 * 60) {
    const inWin = p.arr.filter(([s]) => s >= start && s < start + WIN);
    // merge trains within 15 s into one chord-note
    const notes = [];
    for (const [s, r] of inWin) {
      const last = notes[notes.length - 1];
      if (last && s - last.s < 15) { if (!last.r.includes(r)) last.r.push(r); } else notes.push({ s, r: [r] });
    }
    if (notes.length < 8 || notes.length > 22) continue;
    cands.push({ sid, service, start, head, notes });
  }
}
console.log('candidates', cands.length);

// deterministic spread: score variety, keep <=3 windows per platform, ensure rhythm diversity
const gapsOf = (c) => c.notes.slice(1).map((n, i) => n.s - c.notes[i].s);
const cv = (g) => { const m = g.reduce((a, b) => a + b, 0) / g.length; return Math.sqrt(g.reduce((a, b) => a + (b - m) ** 2, 0) / g.length) / m; };
let seed = 84; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
cands.sort(() => rnd() - 0.5);
const perPlat = new Map(); const perStation = new Map(); const out = [];
for (const c of cands) {
  const st = stops.get(c.sid.slice(0, -1));
  const pk = c.sid + c.service;
  if ((perPlat.get(pk) || 0) >= 1) continue;
  if ((perStation.get(st.stop_id) || 0) >= 2) continue;
  perPlat.set(pk, 1); perStation.set(st.stop_id, (perStation.get(st.stop_id) || 0) + 1);
  const t0 = c.notes[0].s - 4; // window opens just before first train
  const g = gapsOf(c);
  out.push({
    station: st.stop_name, dir: c.sid.slice(-1) === 'N' ? '北行' : '南行', head: c.head,
    service: SERVICES[c.service], startSec: t0, lat: +st.stop_lat, lng: +st.stop_lon,
    notes: c.notes.map((n) => [c.notes.length && n.s - t0, n.r.join(' ')]).map(([s, r]) => [s, r]),
    cv: +cv(g).toFixed(2),
  });
  if (out.length >= 90) break;
}
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ feed: 'MTA NYC Subway static GTFS (feed 2026-05-26..2026-10-31)', windowSec: WIN, puzzles: out }));
console.log('puzzles', out.length, fs.statSync(new URL('../data.json', import.meta.url)).size);
