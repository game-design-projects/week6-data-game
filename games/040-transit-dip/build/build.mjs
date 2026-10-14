// raw/ps.csv (NASA Exoplanet Archive pscomppars, via TAP) -> data.json
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = new URL('.', import.meta.url).pathname;
const raw = dir + 'raw/ps.csv';
if (!fs.existsSync(raw)) {
  fs.mkdirSync(dir + 'raw', { recursive: true });
  const q = 'select pl_name,hostname,pl_rade,st_rad,pl_trandep,pl_orbper,st_teff,disc_year,pl_bmasse,sy_dist from pscomppars where tran_flag=1 and pl_rade is not null and st_rad is not null and pl_trandep is not null';
  execFileSync('curl', ['-sG', 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync', '-A', 'daily-data-games class project', '--data-urlencode', 'query=' + q, '--data-urlencode', 'format=csv', '-o', raw]);
}
const parse = (l) => l.match(/("([^"]*)"|[^,]*)(,|$)/g).map((s) => s.replace(/,$/, '').replace(/^"|"$/g, ''));
const [head, ...lines] = fs.readFileSync(raw, 'utf8').trim().split('\n');
const cols = parse(head).slice(0, 10);
const rows = lines.map((l) => Object.fromEntries(parse(l).slice(0, 10).map((v, i) => [cols[i], v])));
const RE_PER_RS = 0.009168; // R_earth / R_sun
const good = [];
for (const r of rows) {
  const rp = +r.pl_rade, rs = +r.st_rad, depth = +r.pl_trandep, per = +r.pl_orbper;
  if (!(rp > 0 && rs > 0 && depth > 0 && per > 0)) continue;
  const implied = Math.sqrt(depth / 100) * rs / RE_PER_RS;
  if (Math.abs(implied / rp - 1) > 0.2) continue; // dip must actually explain the radius
  if (depth < 0.01 || depth > 5) continue;
  good.push({ name: r.pl_name, star: r.hostname, rp: +rp.toFixed(2), rs: +rs.toFixed(3), depth: +depth.toFixed(4), per: +per.toFixed(3), teff: r.st_teff ? Math.round(+r.st_teff) : null, year: +r.disc_year, dist: r.sy_dist ? +(+r.sy_dist * 3.2616).toFixed(0) : null });
}
// stratify by log radius into 12 bins, take up to 10 each, deterministic
good.sort((a, b) => a.rp - b.rp);
const lo = Math.log(0.5), hi = Math.log(25), B = 12, bins = Array.from({ length: B }, () => []);
for (const g of good) { const b = Math.floor(((Math.log(g.rp) - lo) / (hi - lo)) * B); if (b >= 0 && b < B) bins[b].push(g); }
const pool = bins.flatMap((b) => b.filter((_, i) => i % Math.max(1, Math.floor(b.length / 10)) === 0).slice(0, 10));
fs.writeFileSync(dir + '../data.json', JSON.stringify({ source: 'NASA Exoplanet Archive PSCompPars', fetched: new Date().toISOString().slice(0, 10), planets: pool }));
console.log(rows.length, good.length, pool.length, bins.map((b) => b.length).join(','));
