// Download USGS M2.5+ quakes in <=10-day chunks into raw/ (cached).
import fs from 'node:fs';
const START = Date.parse('2026-04-01T00:00:00Z'), END = Date.parse('2026-10-15T00:00:00Z'), STEP = 10 * 864e5;
fs.mkdirSync('raw', { recursive: true });
for (let t = START; t < END; t += STEP) {
  const s = new Date(t).toISOString().slice(0, 10), e = new Date(Math.min(t + STEP, END)).toISOString().slice(0, 10);
  const f = `raw/${s}_${e}.json`;
  const old = `raw/${s}.json`; // legacy 10-day files already cover [s, s+10d)
  if (fs.existsSync(f) || (fs.existsSync(old) && e <= '2026-10-01')) continue;
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${s}&endtime=${e}&minmagnitude=2.5&orderby=time-asc&limit=20000`;
  const r = await fetch(url, { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
  if (!r.ok) throw new Error(s + ' ' + r.status);
  fs.writeFileSync(f, await r.text());
  console.log('got', s, e);
  await new Promise((r) => setTimeout(r, 1500));
}
