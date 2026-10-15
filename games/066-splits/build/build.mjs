// raw Boston Marathon 2015-2017 CSVs -> data.json (pool of runners with 5K..25K splits + finish)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const secs = (s) => { const m = /^(\d+):(\d+):(\d+)$/.exec((s || '').trim()); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null; };
function parseCSV(t) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  return rows;
}
// tiny seeded PRNG so the build is reproducible
let s = 66; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const all = [];
for (const y of [2015, 2016, 2017]) {
  const rows = parseCSV(fs.readFileSync(path.join(dir, `raw/r${y}.csv`), 'utf8'));
  const H = rows[0];
  const ix = (n) => H.indexOf(n);
  for (const r of rows.slice(1)) {
    const sp = ['5K', '10K', '15K', '20K', 'Half', '25K'].map((k) => secs(r[ix(k)]));
    const t30 = secs(r[ix('30K')]), t35 = secs(r[ix('35K')]), t40 = secs(r[ix('40K')]), fin = secs(r[ix('Official Time')]);
    if (sp.some((v) => v == null) || [t30, t35, t40, fin].some((v) => v == null)) continue;
    const full = [...sp.slice(0, 4), sp[5], t30, t35, t40, fin]; // 5,10,15,20,25,30,35,40,finish
    if (!full.every((v, i) => i === 0 || v > full[i - 1])) continue;
    // drop timing-mat glitches: every 5K segment must be within 0.6-1.6x of the runner's overall pace
    const avg = fin / 42.195;
    if (!full.every((v, i) => { const d = (v - (full[i - 1] ?? 0)) / (i === 8 ? 2.195 : 5); return d > 0.6 * avg && d < 1.6 * avg; })) continue;
    const age = +r[ix('Age')];
    all.push({ y, g: r[ix('M/F')], age, cc: r[ix('Country')], half: sp[4], sp: full.slice(0, 5), rest: full.slice(5), fin });
  }
}
// fade ratio: second 17.195K pace vs first 25K pace
for (const a of all) a.fade = (a.fin - a.sp[4]) / (a.sp[4] * (17.195 / 25)); // 1 = even pace
// stratify: 6 fade buckets x 3 years, 8 each => 144
// the open-ended top bucket is capped at +40% fade: beyond that (injury, walking) nobody can predict the finish
const edges = [0.97, 1.02, 1.07, 1.15, 1.3, 1.4];
const picked = [];
for (const y of [2015, 2016, 2017]) for (let b = 0; b < edges.length; b++) {
  const pool = all.filter((a) => a.y === y && a.fade >= (edges[b - 1] ?? 0) && a.fade < edges[b] && a.fin < 6 * 3600);
  for (let k = 0; k < 8 && pool.length; k++) picked.push(...pool.splice(Math.floor(rnd() * pool.length), 1));
}
const runners = picked.map((a, i) => ({ id: i, y: a.y, g: a.g, age: a.age, cc: a.cc, sp: a.sp, rest: a.rest, fin: a.fin }));
fs.writeFileSync(path.join(dir, '../data.json'), JSON.stringify({ n: all.length, runners }));
console.log('eligible', all.length, 'picked', runners.length);
