// Fetch NYC TLC yellow-taxi trips (2023, NYC Open Data Socrata mirror) + taxi zones geojson into raw/.
// Sampling: 3 pseudo-random days per month x 4 time windows, each query at a seeded random $offset
// inside the window (so trips are NOT biased towards the start of a window).
import fs from 'node:fs';
const UA = { 'User-Agent': 'daily-data-games/1.0 (class project)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('raw', { recursive: true });
async function get(url, file) {
  if (fs.existsSync(file)) return;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  fs.writeFileSync(file, await r.text());
  await sleep(500);
}
// deterministic hash -> [0,1)
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100003) / 100003; }
await get('https://data.cityofnewyork.us/resource/8meu-9t5y.geojson?$limit=300', 'raw/zones.geojson');
const dates = [];
for (let m = 1; m <= 12; m++) {
  const used = new Set();
  for (let k = 0; k < 3; k++) { let d; let i = 0; do { d = 1 + Math.floor(hash(`d${m}-${k}-${i++}`) * 28); } while (used.has(d)); used.add(d); dates.push(`2023-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`); }
}
const wins = [[0, 4], [5, 9], [10, 15], [16, 19], [20, 23]];
for (const date of dates) for (const [a, b] of wins) {
  const where = `tpep_pickup_datetime between '${date}T${String(a).padStart(2, '0')}:00:00' and '${date}T${String(b).padStart(2, '0')}:59:59' AND ratecodeid=1 AND trip_distance>0.4 AND fare_amount>=3 AND fare_amount<120 AND pulocationid!=dolocationid`;
  const offset = Math.floor(hash(`o${date}-${a}`) * 1500);
  const url = `https://data.cityofnewyork.us/resource/4b4i-vvec.json?$limit=20&$offset=${offset}&$select=tpep_pickup_datetime,tpep_dropoff_datetime,trip_distance,pulocationid,dolocationid,fare_amount,passenger_count,tolls_amount,extra,mta_tax,improvement_surcharge,congestion_surcharge&$where=` + encodeURIComponent(where);
  await get(url, `raw/s2-${date}-${a}.json`);
}
console.log('done', dates.length * wins.length, 'queries');
