import fs from 'node:fs';
const g = JSON.parse(fs.readFileSync('raw/usgs.json', 'utf8'));
const days = {};
for (const f of g.features) {
  const p = f.properties; const d = new Date(p.time).toISOString();
  const day = d.slice(0, 10);
  (days[day] ??= []).push({ m: +p.mag.toFixed(1), t: d.slice(11, 16), place: (p.place || '').replace(/^\d+ km [NSEW]+ of /, ''), depth: Math.round(f.geometry.coordinates[2]) });
}
const pool = Object.entries(days).filter(([, q]) => q.length >= 8 && q.slice(0, 16).some((x) => x.m >= 5.8)).map(([date, q]) => ({ date, quakes: q.slice(0, 16) }));
fs.writeFileSync('../data.json', JSON.stringify({ pool }));
console.log(pool.length, 'days');
