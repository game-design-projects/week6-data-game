// Fetch NYC TLC yellow-taxi trips (2023, NYC Open Data Socrata mirror) + taxi zones geojson into raw/.
import fs from 'node:fs';
const UA = { 'User-Agent': 'daily-data-games/1.0 (class project)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('raw', { recursive: true });
async function get(url, file) {
  if (fs.existsSync(file)) return;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  fs.writeFileSync(file, await r.text());
  await sleep(600);
}
await get('https://data.cityofnewyork.us/resource/8meu-9t5y.geojson?$limit=300', 'raw/zones.geojson');
await get('https://data.cityofnewyork.us/resource/8meu-9t5y.json?$select=locationid,zone,borough&$limit=300', 'raw/zones.json');
// 24 dates spread over 2023 x 4 time windows
const dates = [];
for (let m = 1; m <= 12; m++) for (const d of [4, 19]) dates.push(`2023-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
const wins = [[0, 5], [6, 10], [11, 16], [17, 23]];
for (const date of dates) for (const [a, b] of wins) {
  const where = `tpep_pickup_datetime between '${date}T${String(a).padStart(2, '0')}:00:00' and '${date}T${String(b).padStart(2, '0')}:59:59' AND ratecodeid=1 AND trip_distance>0.4 AND fare_amount>=3 AND fare_amount<120 AND pulocationid!=dolocationid`;
  const url = 'https://data.cityofnewyork.us/resource/4b4i-vvec.json?$limit=12&$select=tpep_pickup_datetime,tpep_dropoff_datetime,trip_distance,pulocationid,dolocationid,fare_amount,passenger_count,tolls_amount,congestion_surcharge&$where=' + encodeURIComponent(where);
  await get(url, `raw/trips-${date}-${a}.json`);
}
console.log('done');
