// raw 311 aggregates (2025) -> data.json. Fetch: see fetch.sh
import fs from 'node:fs';
const raw = (f) => JSON.parse(fs.readFileSync(new URL(`./raw/${f}`, import.meta.url)));
const counts = raw('counts.json'), zips = raw('zips.json');
const city = {}; let cityTot = 0;
const byZip = {};
for (const r of counts) { const n = +r.n; city[r.complaint_type] = (city[r.complaint_type] || 0) + n; cityTot += n; (byZip[r.incident_zip] ||= {})[r.complaint_type] = n; }
const out = [];
for (const z of zips) {
  const c = byZip[z.incident_zip]; if (!c) continue;
  const lat = +z.lat, lng = +z.lng;
  if (!(lat > 40.49 && lat < 40.92 && lng > -74.27 && lng < -73.69)) continue;
  const tot = Object.values(c).reduce((a, b) => a + b, 0);
  if (tot < 4000 || !/^(MANHATTAN|BROOKLYN|QUEENS|BRONX|STATEN ISLAND)$/.test(z.borough)) continue;
  const ent = Object.entries(c);
  const top = ent.sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t, n]) => [t, +(100 * n / tot).toFixed(1), +(100 * city[t] / cityTot).toFixed(2)]);
  const lift = ent.filter(([, n]) => n >= 40).map(([t, n]) => [t, +((n / tot) / (city[t] / cityTot)).toFixed(1)])
    .sort((a, b) => b[1] - a[1]).slice(0, 3);
  out.push({ zip: z.incident_zip, lat: +lat.toFixed(4), lng: +lng.toFixed(4), borough: z.borough, total: tot, top, lift });
}
const cityTop = Object.entries(city).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t, n]) => [t, +(100 * n / cityTot).toFixed(1)]);
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ year: 2025, cityTop, cityTotal: cityTot, zips: out }));
console.log(out.length, 'zips');
