import { STRAITS, box, CELL_KM } from './straits.mjs';
import { loadLand, isLand } from './land.mjs';
const polys = loadLand();
for (const s of STRAITS) {
  const b = box(s), lat0 = (b.s + b.n) / 2;
  const W = (b.e - b.w) * 111.32 * Math.cos(lat0 * Math.PI / 180), H = (b.n - b.s) * 110.57;
  const mw = Math.round(W / CELL_KM), mh = Math.round(H / CELL_KM);
  const st = (la, lo) => isLand(polys, la, lo);
  console.log(s.id, `${W.toFixed(0)}x${H.toFixed(0)}km`, mw, mh, 'A land?', st(s.a[1], s.a[2]), 'B land?', st(s.b[1], s.b[2]));
  if (process.argv[2] === s.id) for (let i = 0; i < mh; i += 2) { let r = ''; for (let j = 0; j < mw; j++) { const la = b.n - (i + .5) / mh * (b.n - b.s), lo = b.w + (j + .5) / mw * (b.e - b.w); const A = Math.abs(la - s.a[1]) < (b.n - b.s) / mh && Math.abs(lo - s.a[2]) < (b.e - b.w) / mw, B = Math.abs(la - s.b[1]) < (b.n - b.s) / mh && Math.abs(lo - s.b[2]) < (b.e - b.w) / mw; r += A ? 'A' : B ? 'B' : st(la, lo) ? '#' : '.'; } console.log(r); }
}
