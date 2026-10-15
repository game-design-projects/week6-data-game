// Downloads daily bike totals for 4 East River bridge counters (NYC DOT "Bicycle and Pedestrian Counts",
// Socrata ct66-47at) + daily NYC weather (Open-Meteo archive) into raw/. Cached: delete raw/ files to refresh.
import fs from 'node:fs'; import path from 'node:path';
const raw = path.join(import.meta.dirname, 'raw'); fs.mkdirSync(raw, { recursive: true });
const UA = { 'User-Agent': 'daily-data-games-class-project' };
export const SENSORS = { '300020904': 'brooklyn', '100062893': 'manhattan', '100009427': 'williamsburg', '100009428': 'queensboro' };
const START = '2022-01-01';
const END = process.env.BC_END ?? new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

const df = path.join(raw, 'dot-daily.json');
if (!fs.existsSync(df)) {
  const out = {};
  for (const id of Object.keys(SENSORS)) {
    const u = new URL('https://data.cityofnewyork.us/resource/ct66-47at.json');
    u.searchParams.set('$select', 'date_trunc_ymd(timestamp) as d, sum(counts) as n, count(*) as k');
    u.searchParams.set('$where', `sensor_id='${id}' AND travelmode='bike' AND timestamp>='${START}' AND timestamp<'${END}T23:59:59'`);
    u.searchParams.set('$group', 'd'); u.searchParams.set('$order', 'd'); u.searchParams.set('$limit', '50000');
    const r = await fetch(u, { headers: UA }); const t = await r.text();
    if (!r.ok) throw new Error(`${id} ${r.status} ${t.slice(0, 200)}`);
    out[id] = JSON.parse(t); console.log(id, out[id].length); await sleep(1000);
  }
  fs.writeFileSync(df, JSON.stringify(out));
}
const wf = path.join(raw, 'weather.json');
if (!fs.existsSync(wf)) {
  const u = `https://archive-api.open-meteo.com/v1/archive?latitude=40.71&longitude=-73.99&start_date=${START}&end_date=${END}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York`;
  const r = await fetch(u, { headers: UA }); const t = await r.text();
  if (!r.ok) throw new Error(`weather ${r.status} ${t.slice(0, 200)}`);
  fs.writeFileSync(wf, t);
}
console.log('raw ready');
