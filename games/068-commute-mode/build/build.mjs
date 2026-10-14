// raw ACS JSON -> ../data.json : pool of counties with commute-mode shares
import fs from 'node:fs';
const rows = [];
const pop = new Map();
const parse = (f) => { const d = JSON.parse(fs.readFileSync(f, 'utf8')).response.data; const h = d[0]; return d.slice(1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]]))); };
for (const f of fs.readdirSync('raw')) {
  if (f.startsWith('B01003')) for (const r of parse('raw/' + f)) pop.set(r.NAME, +r.B01003_001E);
}
for (const f of fs.readdirSync('raw')) {
  if (!f.startsWith('B08301')) continue;
  for (const r of parse('raw/' + f)) {
    const n = +r.B08301_001E; if (!(n > 0)) continue;
    const pct = (k) => +(100 * (+r[k]) / n).toFixed(2);
    const [county, state] = r.NAME.split(', ');
    rows.push({ name: county, state, workers: n, pop: pop.get(r.NAME) ?? null,
      transit: pct('B08301_010E'), bike: pct('B08301_018E'), wfh: pct('B08301_021E'),
      drive: pct('B08301_003E'), carpool: pct('B08301_004E'), walk: pct('B08301_019E'), other: pct('B08301_020E') });
  }
}
// playable: big enough for stable estimates, and bike share measurable
const pool = rows.filter((r) => r.workers >= 40000 && r.bike >= 0.2).sort((a, b) => b.workers - a.workers).slice(0, 320);
fs.writeFileSync('../data.json', JSON.stringify({ vintage: 'ACS 2019-2023 5-year', counties: pool }));
console.log(rows.length, 'counties;', pool.length, 'in pool');
