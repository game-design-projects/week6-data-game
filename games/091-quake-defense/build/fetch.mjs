// Downloads M4.5+ USGS events into raw/ (cached; delete the file to refresh).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('.', import.meta.url)));
const out = 'raw/usgs-2026-06-01_2026-10-15.json';
fs.mkdirSync('raw', { recursive: true });
if (!fs.existsSync(out)) {
  const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2026-06-01&endtime=2026-10-15&minmagnitude=4.5&orderby=time-asc';
  const r = await fetch(url, { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
  if (!r.ok) throw new Error('USGS ' + r.status);
  fs.writeFileSync(out, await r.text());
}
console.log('ok', fs.statSync(out).size);
