// Downloads daily bike totals for 4 East River bridge counters + NYC daily weather into raw/.
import fs from 'node:fs'; import path from 'node:path';
const raw = path.join(import.meta.dirname, 'raw'); fs.mkdirSync(raw, { recursive: true });
const UA = { 'User-Agent': 'daily-data-games-class-project' };
export const SENSORS = { brooklyn: '300020904', manhattan: '100062893', williamsburg: '100009427', queensboro: '100009428' };
for (const [k, id] of Object.entries(SENSORS)) {
  const f = path.join(raw, `daily-${k}.json`); if (fs.existsSync(f)) continue;
  const u = new URL('https://data.cityofnewyork.us/resource/uczf-rk3c.json');
  u.searchParams.set('$select', "date_trunc_ymd(date) as d, sum(counts) as n, count(*) as k");
  u.searchParams.set('$where', `id='${id}' AND date>='2022-01-01' AND date<'2026-01-01'`);
  u.searchParams.set('$group', 'd'); u.searchParams.set('$order', 'd'); u.searchParams.set('$limit', '5000');
  const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error(r.status);
  fs.writeFileSync(f, await r.text()); await new Promise((s) => setTimeout(s, 1000));
}
const wf = path.join(raw, 'weather.json');
if (!fs.existsSync(wf)) {
  const u = 'https://archive-api.open-meteo.com/v1/archive?latitude=40.71&longitude=-73.99&start_date=2022-01-01&end_date=2025-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York';
  const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error(r.status);
  fs.writeFileSync(wf, await r.text());
}
