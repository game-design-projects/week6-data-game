// raw -> ../data.json. Stars: HYG v4 (Hipparcos-derived), constellation lines: d3-celestial, cities: GeoNames.
import fs from 'node:fs';
const R = (f) => fs.readFileSync(new URL(`./raw/${f}`, import.meta.url), 'utf8');
const rows = R('hyg.csv').split('\n');
const parseLine = (l) => { const o = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(cur); cur = ''; } else cur += ch; } o.push(cur); return o; };
const head = parseLine(rows[0]); const ix = Object.fromEntries(head.map((h, i) => [h, i]));
const stars = [];
for (const l of rows.slice(1)) {
  if (!l) continue; const c = parseLine(l);
  if (!c[ix.hip]) continue;
  const mag = +c[ix.mag]; if (mag > 4.6) continue;
  const named = c[ix.proper] && mag < 2.6 ? c[ix.proper] : '';
  stars.push([+(+c[ix.ra] * 15).toFixed(3), +(+c[ix.dec]).toFixed(3), +mag.toFixed(2), named, +c[ix.hip]]);
}
// constellation lines
const cl = JSON.parse(R('constellations.lines.json'));
const lines = []; const labels = [];
for (const f of cl.features) {
  const pts = []; let sx = 0, sy = 0, n = 0;
  for (const seg of f.geometry.coordinates) {
    lines.push(seg.map(([lo, la]) => [+((lo + 360) % 360).toFixed(2), +la.toFixed(2)]));
    for (const [lo, la] of seg) { const r = ((lo + 360) % 360) * Math.PI / 180; sx += Math.cos(r); sy += Math.sin(r); pts.push(la); n++; }
  }
  labels.push([f.id, +(((Math.atan2(sy, sx) * 180 / Math.PI) + 360) % 360).toFixed(1), +(pts.reduce((a, b) => a + b, 0) / n).toFixed(1)]);
}
// cities
const cc = {}; for (const l of R('countryInfo.txt').split('\n')) if (l && l[0] !== '#') { const p = l.split('\t'); cc[p[0]] = p[4]; }
const cities = R('cities15000.txt').split('\n').filter(Boolean).map((l) => l.split('\t'))
  .map((p) => ({ name: p[2], country: cc[p[8]] || p[8], lat: +(+p[4]).toFixed(3), lng: +(+p[5]).toFixed(3), pop: +p[14] }))
  .filter((c) => c.pop >= 1.2e6 && Math.abs(c.lat) <= 66).sort((a, b) => b.pop - a.pop);
const out = { source: 'HYG v4 (Hipparcos), d3-celestial, GeoNames', built: new Date().toISOString().slice(0, 10), stars, lines, labels, cities };
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out));
console.log(stars.length, 'stars', lines.length, 'lines', cities.length, 'cities', fs.statSync(new URL('../data.json', import.meta.url)).size);
