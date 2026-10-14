// raw/trk_*.csv -> ../data.json. Keeps drifters with >=88 days of coverage, no date-line jump,
// resampled to daily positions (nearest 00:00 UTC obs), moved at least 150 km over 90 days.
import fs from 'node:fs';
const RAW = new URL('./raw/', import.meta.url).pathname;
const hav = (a, b) => { const R = 6371, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const out = [];
for (const f of fs.readdirSync(RAW).filter((n) => n.startsWith('trk_'))) {
  const rows = fs.readFileSync(RAW + f, 'utf8').trim().split('\n').slice(2).map((l) => l.split(','));
  if (rows.length < 300) continue;
  const t0 = Date.parse(rows[0][1]);
  const byDay = new Map();
  for (const r of rows) {
    const t = Date.parse(r[1]); const d = Math.round((t - t0) / 86400000);
    if ((t - t0) % 86400000 === 0) byDay.set(d, [+r[2], +r[3]]);
  }
  const days = []; let ok = true;
  for (let d = 0; d <= 90; d++) { const p = byDay.get(d); if (!p) { ok = false; break; } days.push(p); }
  if (!ok) continue;
  let jump = false; for (let i = 1; i < days.length; i++) if (Math.abs(days[i][1] - days[i - 1][1]) > 180) jump = true;
  if (jump) continue;
  const disp = hav(days[0], days[90]);
  if (disp < 150) continue;
  const lost = Date.parse(rows[0][4]);
  const [, id, start] = f.match(/trk_(\d+)_(\d{4}-\d\d-\d\d)/);
  out.push({ id, start, drogued: Number.isFinite(lost) && lost > t0 + 60 * 86400000, track: days.map((p) => [+p[0].toFixed(2), +p[1].toFixed(2)]) });
}
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ built: new Date().toISOString().slice(0, 10), drifters: out }));
console.log('drifters', out.length, 'drogued', out.filter((o) => o.drogued).length);
