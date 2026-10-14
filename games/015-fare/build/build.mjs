// raw/ -> ../data.json : pool of real yellow-cab trips + simplified taxi-zone outlines.
import fs from 'node:fs';
const zonesGeo = JSON.parse(fs.readFileSync('raw/zones.geojson', 'utf8'));
const zones = {};
function ring(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  const best = polys.map((p) => p[0]).sort((a, b) => b.length - a.length)[0];
  const step = Math.max(1, Math.ceil(best.length / 36));
  const pts = best.filter((_, i) => i % step === 0).map(([x, y]) => [+y.toFixed(4), +x.toFixed(4)]);
  return pts;
}
for (const f of zonesGeo.features) {
  const r = ring(f.geometry);
  const lat = r.reduce((s, p) => s + p[0], 0) / r.length, lng = r.reduce((s, p) => s + p[1], 0) / r.length;
  zones[f.properties.locationid] = { id: +f.properties.locationid, name: f.properties.zone, boro: f.properties.borough, c: [+lat.toFixed(4), +lng.toFixed(4)], ring: r };
}
const trips = [];
const seen = new Set();
for (const file of fs.readdirSync('raw').filter((f) => f.startsWith('trips-')).sort()) {
  const rows = JSON.parse(fs.readFileSync('raw/' + file, 'utf8'));
  let kept = 0;
  for (const r of rows) {
    const t0 = r.tpep_pickup_datetime, t1 = r.tpep_dropoff_datetime;
    const min = (Date.parse(t1 + 'Z') - Date.parse(t0 + 'Z')) / 60000;
    const fare = +r.fare_amount, dist = +r.trip_distance;
    const pu = zones[r.pulocationid], dofl = zones[r.dolocationid];
    if (!pu || !dofl || min < 3 || min > 90 || dist > 40 || !(fare > 0)) continue;
    if (dist / (min / 60) > 60 || dist / (min / 60) < 2) continue;
    if (+r.tolls_amount > 0) continue; // keep fare ~ time+distance only
    const key = r.pulocationid + '>' + r.dolocationid;
    if (seen.has(key)) continue;
    seen.add(key);
    trips.push({ t: t0.slice(0, 16), pu: pu.id, do: dofl.id, mi: dist, min: +min.toFixed(1), fare, pax: +r.passenger_count || 1 });
    if (++kept >= 2) break;
  }
}
const used = new Set(trips.flatMap((t) => [t.pu, t.do]));
const out = { year: 2023, trips, zones: Object.fromEntries([...used].map((i) => [i, zones[i]])) };
fs.writeFileSync('../data.json', JSON.stringify(out));
console.log(trips.length, 'trips', used.size, 'zones', fs.statSync('../data.json').size, 'bytes');
