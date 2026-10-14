// raw/all.json -> data.json : per game, WR progression [[YYYY-MM-DD, seconds], ...]
import fs from 'node:fs';
const all = JSON.parse(fs.readFileSync(new URL('./raw/all.json', import.meta.url)));
const games = [];
for (const g of all) {
  const runs = g.runs.filter((r) => r.date && r.t > 0).sort((a, b) => a.date.localeCompare(b.date) || a.t - b.t);
  const pts = [];
  let best = Infinity;
  for (const r of runs) if (r.t < best) { best = r.t; if (pts.length && pts[pts.length - 1][0] === r.date) pts[pts.length - 1][1] = r.t; else pts.push([r.date, +r.t.toFixed(2)]); }
  const years = pts.length ? (Date.parse(pts.at(-1)[0]) - Date.parse(pts[0][0])) / 31557600000 : 0;
  if (pts.length < 10 || years < 1.5 || !g.released) continue;
  games.push({ id: g.ab || g.id, name: g.name.replace(/\s*\(.*?\)\s*$/, ''), year: g.released, cat: g.cat, platforms: g.platforms, wr: pts.at(-1)[1], pts });
}
games.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ games }));
console.log(games.length, 'games');
