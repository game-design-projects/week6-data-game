// Fetch NOAA CO-OPS harmonic tide predictions (snapshot fallback; the game fetches the puzzle date live) for ~110 reference stations (3 days, hourly) -> ../data.json
import fs from 'node:fs';
const RAW = new URL('./raw/', import.meta.url).pathname;
const UA = { 'User-Agent': 'daily-data-games class project (contact: lishuyustevenli@gmail.com)' };
const sj = JSON.parse(fs.readFileSync(RAW + 'stations.json', 'utf8')).stations;
const R = sj.filter((s) => s.type === 'R' && s.lat && s.lng);
const rad = Math.PI / 180;
const km = (a, b) => { const d = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2; return 12742 * Math.asin(Math.sqrt(d)); };
// farthest-point sampling, over-select then drop failures
const chosen = [R.find((s) => /Battery/.test(s.name)) || R[0]];
while (chosen.length < 110) {
  let best = null, bd = -1;
  for (const s of R) { const d = Math.min(...chosen.map((c) => km(c, s))); if (d > bd) { bd = d; best = s; } }
  chosen.push(best);
}
const BEGIN = '20261001', END = '20261003';
const out = [];
for (const s of chosen) {
  const f = RAW + `pred-${s.id}.json`;
  if (!fs.existsSync(f)) {
    const u = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=dailygames&begin_date=${BEGIN}&end_date=${END}&datum=MLLW&station=${s.id}&time_zone=lst&units=metric&interval=h&format=json`;
    const r = await fetch(u, { headers: UA }); fs.writeFileSync(f, await r.text());
    await new Promise((r) => setTimeout(r, 400));
  }
  let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
  if (!j.predictions || j.predictions.length < 72) { console.log('skip', s.id, s.name); continue; }
  const v = j.predictions.slice(0, 72).map((p) => +(+p.v).toFixed(2));
  if (v.some((x) => !isFinite(x))) continue;
  if (Math.max(...v) - Math.min(...v) < 0.05) { console.log('skip flat', s.id, s.name); continue; } // e.g. 8762483 (river floodway), no tide signal
  out.push({ id: s.id, name: s.name, state: s.state, lat: +s.lat.toFixed(3), lng: +s.lng.toFixed(3), tz: s.timezonecorr, v });
}
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ begin: '2026-10-01', stations: out }));
console.log(out.length, 'stations');
