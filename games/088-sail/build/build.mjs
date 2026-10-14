import { readFileSync, writeFileSync } from 'node:fs';
import { STRAITS, N, box } from './straits.mjs';
const out = { n: N, straits: [], puzzles: [] };
for (let k = 0; k < STRAITS.length; k++) {
  const s = STRAITS[k], arr = JSON.parse(readFileSync(`raw/${s.id}.json`, 'utf8'));
  const loc = Array.isArray(arr) ? arr : [arr];
  const mask = loc.map((l) => (l.elevation > 1.5 ? 1 : 0));
  const b = box(s);
  // snap endpoints to nearest grid node and force sea
  const snap = ([nm, la, lo]) => {
    const i = Math.round((b.n - la) / (b.n - b.s) * (N - 1)), j = Math.round((lo - b.w) / (b.e - b.w) * (N - 1));
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < N && jj < N) mask[ii * N + jj] = 0; }
    return { name: nm, lat: la, lng: lo, i, j };
  };
  const A = snap(s.a), B = snap(s.b);
  out.straits.push({ id: s.id, name: s.name, box: [b.s, b.w, b.n, b.e].map((x) => +x.toFixed(3)), a: A, b: B, mask: mask.join('') });
  const times = loc[0].hourly.time;
  times.forEach((t, ti) => {
    if (!t.endsWith('T12:00')) return;
    const w = loc.map((l) => [Math.round(l.hourly.wind_speed_10m[ti] * 10) / 10, Math.round(l.hourly.wind_direction_10m[ti])]);
    if (w.some((x) => x[0] == null || x[1] == null)) return;
    const sea = w.filter((_, i) => !mask[i]);
    const mean = sea.reduce((a, x) => a + x[0], 0) / sea.length;
    if (mean < 7 || mean > 28) return;
    out.puzzles.push({ s: k, date: t.slice(0, 10), mean: +mean.toFixed(1), w: w.map((x) => [Math.round(x[0]), x[1]]) });
  });
  console.log(s.id, '\n' + Array.from({ length: N }, (_, i) => mask.slice(i * N, i * N + N).map((m) => (m ? '#' : '.')).join('')).join('\n'));
}
writeFileSync('../data.json', JSON.stringify(out));
console.log(out.puzzles.length, 'puzzles', JSON.stringify(out).length);
