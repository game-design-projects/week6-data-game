// raw/*.json (ERA5 archive) + land-50m -> ../data.json. Usage: node build.mjs   (run fetch.mjs first)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STRAITS, N, box, CELL_KM } from './straits.mjs';
import { loadLand, isLand } from './land.mjs';
import { HOURS, MEAN_RANGE, meanWind, toPuzzleObj, difficulty } from '../game.js';
const HERE = dirname(fileURLToPath(import.meta.url));
const polys = loadLand();
const out = { n: N, hours: HOURS, straits: [], puzzles: [] };
const stat = { total: 0, calm: 0, trivial: 0, unreachable: 0 };
for (let k = 0; k < STRAITS.length; k++) {
  const s = STRAITS[k], arr = JSON.parse(readFileSync(join(HERE, `raw/${s.id}.json`), 'utf8'));
  const loc = Array.isArray(arr) ? arr : [arr];
  if (loc.length !== N * N) throw new Error(`${s.id}: ${loc.length} points`);
  const b = box(s), lat0 = (b.s + b.n) / 2;
  const W = (b.e - b.w) * 111.32 * Math.cos((lat0 * Math.PI) / 180), H = (b.n - b.s) * 110.57;
  const mw = Math.round(W / CELL_KM), mh = Math.round(H / CELL_KM);
  // a cell is land when >= half of 9 sample points inside it are on land
  let mask = '';
  for (let i = 0; i < mh; i++) for (let j = 0; j < mw; j++) {
    let c = 0;
    for (const fy of [0.17, 0.5, 0.83]) for (const fx of [0.17, 0.5, 0.83]) {
      const la = b.n - ((i + fy) / mh) * (b.n - b.s), lo = b.w + ((j + fx) / mw) * (b.e - b.w);
      if (isLand(polys, la, lo)) c++;
    }
    mask += c >= 5 ? '1' : '0';
  }
  const cell = (la, lo) => mask[Math.min(mh - 1, Math.floor(((b.n - la) / (b.n - b.s)) * mh)) * mw + Math.min(mw - 1, Math.floor(((lo - b.w) / (b.e - b.w)) * mw))];
  const port = ([nm, la, lo]) => { if (cell(la, lo) === '1') throw new Error(`${s.id}: port ${nm} is on land`); return { name: nm, lat: la, lng: lo }; };
  out.straits.push({ id: s.id, name: s.name, box: [b.s, b.w, b.n, b.e].map((x) => +x.toFixed(3)), a: port(s.a), b: port(s.b), mw, mh, mask });
  const times = loc[0].hourly.time, st = out.straits[k];
  const days = [...new Set(times.map((t) => t.slice(0, 10)))];
  for (const d of days) {
    const idx = HOURS.map((h) => times.indexOf(`${d}T${String(h).padStart(2, '0')}:00`));
    if (idx.some((i) => i < 0)) continue;
    const w = idx.map((ti) => loc.map((l) => [Math.round(l.hourly.wind_speed_10m[ti]), Math.round(l.hourly.wind_direction_10m[ti]) % 360]));
    if (w.some((f) => f.some(([a, c]) => !Number.isFinite(a) || !Number.isFinite(c)))) continue;
    stat.total++;
    const q = { s: k, date: d, mean: meanWind(w), w };
    if (q.mean < MEAN_RANGE[0] || q.mean > MEAN_RANGE[1]) { stat.calm++; continue; }
    const diff = difficulty(toPuzzleObj({ straits: out.straits, n: N, hours: HOURS }, q));
    if (!Number.isFinite(diff.opt)) { stat.unreachable++; console.log('unreachable', s.id, d); continue; }
    if (diff.directScore >= 97) { stat.trivial++; continue; }
    out.puzzles.push(q);
  }
  console.log(s.id, `${mw}x${mh}`, 'puzzles so far', out.puzzles.length);
}
const json = JSON.stringify(out);
writeFileSync(join(HERE, '../data.json'), json);
console.log(stat, out.puzzles.length, 'puzzles', (json.length / 1024).toFixed(0), 'KB');
