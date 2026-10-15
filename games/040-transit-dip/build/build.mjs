// NASA Exoplanet Archive (pscomppars via TAP) -> ../data.json. Raw CSV cached in raw/ps.csv.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = new URL('.', import.meta.url).pathname;
const raw = dir + 'raw/ps.csv';
const COLS = ['pl_name', 'hostname', 'pl_rade', 'st_rad', 'pl_trandep', 'pl_orbper', 'pl_trandur', 'pl_imppar', 'st_teff', 'disc_year', 'sy_dist'];
if (!fs.existsSync(raw)) {
  fs.mkdirSync(dir + 'raw', { recursive: true });
  const q = `select ${COLS.join(',')} from pscomppars where tran_flag=1 and pl_rade is not null and st_rad is not null and pl_trandep is not null`;
  execFileSync('curl', ['-sfG', 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync', '-A', 'daily-data-games class project', '--data-urlencode', 'query=' + q, '--data-urlencode', 'format=csv', '-o', raw]);
}
export function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const [head, ...lines] = parseCsv(fs.readFileSync(raw, 'utf8').trim());
const rows = lines.map((l) => Object.fromEntries(l.map((v, i) => [head[i], v])));
const RE_PER_RS = 0.009168;
const good = [];
for (const r of rows) {
  const rp = +r.pl_rade, rs = +r.st_rad, depth = +r.pl_trandep, per = +r.pl_orbper, dur = +r.pl_trandur;
  if (![rp, rs, depth, per, dur].every((v) => v > 0 && Number.isFinite(v))) continue;
  if (r.pl_rade === '' || r.pl_trandur === '') continue;
  const implied = Math.sqrt(depth / 100) * rs / RE_PER_RS;
  if (Math.abs(implied / rp - 1) > 0.06) continue; // the dip must actually explain the published radius
  if (depth < 0.01 || depth > 5 || rs > 3 || dur > 20 || dur > per * 24 * 0.5) continue;
  const b = r.pl_imppar === '' ? null : +r.pl_imppar;
  good.push({ name: r.pl_name, star: r.hostname, rp: +rp.toFixed(2), rs: +rs.toFixed(3), depth: +depth.toFixed(4), per: +per.toFixed(3), dur: +dur.toFixed(2), b: b != null && b >= 0 && b < 1 ? +b.toFixed(2) : null, teff: r.st_teff ? Math.round(+r.st_teff) : null, year: +r.disc_year, dist: r.sy_dist ? Math.round(+r.sy_dist * 3.2616) : null });
}
good.sort((a, b) => a.rp - b.rp || a.name.localeCompare(b.name));
const lo = Math.log(0.5), hi = Math.log(25), B = 12, bins = Array.from({ length: B }, () => []);
for (const g of good) { const k = Math.floor(((Math.log(g.rp) - lo) / (hi - lo)) * B); if (k >= 0 && k < B) bins[k].push(g); }
const pool = bins.flatMap((b) => b.filter((_, i) => i % Math.max(1, Math.floor(b.length / 10)) === 0).slice(0, 10));
fs.writeFileSync(dir + '../data.json', JSON.stringify({ source: 'NASA Exoplanet Archive PSCompPars', fetched: new Date().toISOString().slice(0, 10), planets: pool }));
console.log(rows.length, good.length, pool.length, bins.map((b) => b.length).join(','));
