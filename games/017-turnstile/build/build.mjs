// raw hourly aggregates -> ../data.json (avg riders per hour, weekday vs weekend, Sep 2025)
import fs from 'node:fs';
const read = (f) => JSON.parse(fs.readFileSync(new URL(`./raw/${f}`, import.meta.url)));
const st = new Map();
for (const [key, f] of [['wk', 'hourly_wk.json'], ['we', 'hourly_we.json']]) {
  for (const r of read(f)) {
    const id = r.station_complex_id;
    if (!st.has(id)) st.set(id, { id, name: r.station_complex, borough: r.borough, lat: +(+r.lat).toFixed(4), lng: +(+r.lng).toFixed(4), wk: Array(24).fill(0), we: Array(24).fill(0) });
    st.get(id)[key][+r.h] = Math.round(+r.r / +r.nd);
  }
}
const all = [...st.values()].filter((s) => s.wk.some((x) => x) && s.we.some((x) => x));
for (const s of all) s.day = s.wk.reduce((a, b) => a + b, 0);
all.sort((a, b) => b.day - a.day);
all.forEach((s, i) => { s.pool = i < 160; delete s.day; });

// --- stops between stations: BFS over the GTFS rail graph, collapsed to station complexes ---
const lines = (f) => fs.readFileSync(new URL(`./raw/gtfs/${f}`, import.meta.url), 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
const toComplex = new Map(read('stations.json').map((r) => [r.gtfs_stop_id, r.complex_id]));
const parent = new Map(lines('stops.txt').map((l) => { const c = l.split(','); return [c[0], toComplex.has(c[0]) ? c[0] : c[c.length - 1] || c[0]]; }));
const cx = (stopId) => toComplex.get(parent.get(stopId) ?? stopId);
const adj = new Map();
const link = (a, b) => { if (!a || !b || a === b) return; (adj.get(a) ?? adj.set(a, new Set()).get(a)).add(b); (adj.get(b) ?? adj.set(b, new Set()).get(b)).add(a); };
let prevTrip = null, prev = null;
for (const l of lines('stop_times.txt')) {
  const [trip, stop] = l.split(',');
  const c = cx(stop);
  if (trip === prevTrip) link(prev, c);
  prevTrip = trip; prev = c;
}
const ids = all.map((s) => s.id);
const idx = new Map(ids.map((id, i) => [id, i]));
const hops = ids.map((src) => {
  const dist = new Map([[src, 0]]);
  const q = [src];
  for (let i = 0; i < q.length; i++) for (const n of adj.get(q[i]) ?? []) if (!dist.has(n)) { dist.set(n, dist.get(q[i]) + 1); q.push(n); }
  return ids.map((id) => { const d = dist.get(id); if (d > 40) throw new Error('hop encoding overflow'); return d == null ? '~' : String.fromCharCode(48 + d); }).join('');
});
const unreachable = hops.filter((r) => r.includes('~')).length;
console.log('hop rows with unreachable stations:', unreachable, 'max hops', hops.join('').replace(/~/g, '').split('').reduce((m, c) => Math.max(m, c.charCodeAt(0) - 48), 0));
const out = { month: '2025-09', stations: all, hops };
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out));
console.log(all.length, 'stations;', all.filter((s) => s.pool).length, 'in pool', fs.statSync(new URL('../data.json', import.meta.url)).size);
