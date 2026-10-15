// Fetch hourly subway ridership aggregates (station x day-type x hour) for Sep 2025 from NY open data (Socrata SoQL).
import fs from 'node:fs';
const UA = { 'User-Agent': 'daily-data-games/1.0 (class project)' };
const base = 'https://data.ny.gov/resource/5wq4-mkjj.json';
const q = (extra) => `${base}?$query=` + encodeURIComponent(extra);
const jobs = {
  'mx.json': `select max(transit_timestamp) as mx, min(transit_timestamp) as mn`,
};
for (const [dow, name] of [['wk', 'between 1 and 5'], ['we', 'in (0,6)']]) {
  jobs[`hourly_${dow}.json`] = `select station_complex_id, station_complex, borough, avg(latitude) as lat, avg(longitude) as lng, date_extract_hh(transit_timestamp) as h, sum(ridership) as r, count(distinct date_trunc_ymd(transit_timestamp)) as nd where transit_timestamp >= '2025-09-01T00:00:00' and transit_timestamp < '2025-10-01T00:00:00' and transit_mode='subway' and date_extract_dow(transit_timestamp) ${name} and date_trunc_ymd(transit_timestamp) != '2025-09-01T00:00:00.000' group by station_complex_id, station_complex, borough, h limit 100000`;
}
for (const [f, sql] of Object.entries(jobs)) {
  const p = `raw/${f}`;
  if (fs.existsSync(p)) continue;
  const r = await fetch(q(sql), { headers: UA });
  const t = await r.text();
  if (!r.ok) throw new Error(f + ' ' + r.status + ' ' + t.slice(0, 300));
  fs.writeFileSync(p, t);
  console.log(f, t.length);
  await new Promise((s) => setTimeout(s, 1500));
}

// Station directory (complex_id <-> GTFS stop ids) and the static GTFS feed, used to count stops between stations.
import { execFileSync } from 'node:child_process';
const dl = async (url, p) => {
  if (fs.existsSync(p)) return;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  fs.writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  console.log(p, fs.statSync(p).size);
  await new Promise((s) => setTimeout(s, 1500));
};
await dl('https://data.ny.gov/resource/39hk-dx4f.json?$limit=2000', 'raw/stations.json');
await dl('https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip', 'raw/gtfs_subway.zip');
fs.mkdirSync('raw/gtfs', { recursive: true });
if (!fs.existsSync('raw/gtfs/stop_times.txt')) execFileSync('unzip', ['-oq', 'raw/gtfs_subway.zip', 'stops.txt', 'trips.txt', 'stop_times.txt', '-d', 'raw/gtfs']);
