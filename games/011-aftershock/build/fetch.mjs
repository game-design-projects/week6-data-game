import fs from 'node:fs';
const START = Date.parse('2026-04-01T00:00:00Z'), END = Date.parse('2026-10-01T00:00:00Z'), STEP = 10 * 864e5;
fs.mkdirSync('raw', { recursive: true });
for (let t = START; t < END; t += STEP) {
  const s = new Date(t).toISOString().slice(0, 10), e = new Date(Math.min(t + STEP, END)).toISOString().slice(0, 10);
  const f = `raw/${s}.json`;
  if (fs.existsSync(f)) continue;
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${s}&endtime=${e}&minmagnitude=2.5&orderby=time-asc&limit=20000`;
  const r = await fetch(url, { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
  if (!r.ok) throw new Error(s + ' ' + r.status);
  fs.writeFileSync(f, await r.text());
  console.log('got', s);
  await new Promise((r) => setTimeout(r, 1500));
}
