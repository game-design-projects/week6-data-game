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
const out = { month: '2025-09', stations: all };
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out));
console.log(all.length, 'stations;', all.filter((s) => s.pool).length, 'in pool', fs.statSync(new URL('../data.json', import.meta.url)).size);
