import fs from 'node:fs';
const out = 'raw/usgs.json';
if (!fs.existsSync(out)) {
  const r = await fetch('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2026-06-01&endtime=2026-10-13&minmagnitude=4.5&orderby=time-asc', { headers: { 'User-Agent': 'daily-data-games/1.0' } });
  fs.writeFileSync(out, await r.text());
}
console.log('ok', fs.statSync(out).size);
