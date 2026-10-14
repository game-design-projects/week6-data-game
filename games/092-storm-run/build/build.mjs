// Fetch IEM NEXRAD n0r composite PNGs (derived from NOAA radar), crop storm windows, emit data.json.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hazard, solve } from '../route.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const raw = path.join(dir, 'raw');
fs.mkdirSync(raw, { recursive: true });
const UA = 'daily-data-games class project (lishuyustevenli@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = 36, H = 24, CELL = 25; // px per cell (0.25 deg)

function decodePNG(buf) {
  let p = 8, w = 0, h = 0; const idat = [];
  while (p < buf.length) {
    const l = buf.readUInt32BE(p), t = buf.toString('latin1', p + 4, p + 8);
    if (t === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); }
    if (t === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + l));
    p += 12 + l;
  }
  const d = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    const f = d[y * (w + 1)];
    for (let x = 0; x < w; x++) {
      const v = d[y * (w + 1) + 1 + x];
      const a = x ? out[y * w + x - 1] : 0, b = y ? out[(y - 1) * w + x] : 0, c = x && y ? out[(y - 1) * w + x - 1] : 0;
      let r;
      if (f === 0) r = v; else if (f === 1) r = v + a; else if (f === 2) r = v + b; else if (f === 3) r = v + ((a + b) >> 1);
      else { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      out[y * w + x] = r & 255;
    }
  }
  return { w, h, px: out };
}

async function get(date, hh) {
  const [y, m, d] = date.split('-');
  const name = `n0r_${y}${m}${d}${hh}00.png`;
  const f = path.join(raw, name);
  if (!fs.existsSync(f)) {
    const r = await fetch(`https://mesonet.agron.iastate.edu/archive/data/${y}/${m}/${d}/GIS/uscomp/${name}`, { headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    await sleep(400);
  }
  return decodePNG(fs.readFileSync(f));
}

function crop(img, ox, oy) { // ox,oy in px; returns level grid 0..15
  const g = [];
  for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
    const vals = [];
    for (let y = 0; y < CELL; y += 2) for (let x = 0; x < CELL; x += 2) {
      const i = img.px[(oy + cy * CELL + y) * img.w + ox + cx * CELL + x];
      vals.push(i >= 7 && i <= 21 ? i - 6 : 0);
    }
    vals.sort((a, b) => a - b);
    g.push(vals[Math.floor(vals.length * 0.88)]);
  }
  return g;
}

// deterministic candidate dates (convective season, 2022-2025)
let s = 92;
const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const cands = [];
for (let i = 0; i < 260; i++) {
  const y = 2022 + Math.floor(rnd() * 4), m = 4 + Math.floor(rnd() * 5), d = 1 + Math.floor(rnd() * 28);
  cands.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
}
const uniq = [...new Set(cands)].sort();
const puzzles = [];
const seen = new Set();
for (const date of uniq) {
  if (puzzles.length >= 80) break;
  const hh = ['20', '21', '22', '23', '00'][Math.floor(rnd() * 5)];
  const img = await get(date, hh).catch(() => null);
  if (!img || img.w !== 6000) continue;
  // try windows on a coarse grid; keep the best-scoring one
  let best = null;
  for (let oy = 200; oy + H * CELL < 2500; oy += 250) for (let ox = 300; ox + W * CELL < 5900; ox += 250) {
    const g = crop(img, ox, oy);
    const cov = g.filter((v) => v >= 4).length / g.length;
    const core = g.filter((v) => v >= 8).length;
    if (cov < 0.18 || cov > 0.5 || core < 8) continue;
    // endpoints: clear cells on left and right columns; maximise detour pressure
    let pair = null;
    for (let a = 1; a < H - 1; a += 4) for (let b = 1; b < H - 1; b += 4) {
      if (hazard(g[a * W]) > 1 || hazard(g[b * W + W - 1]) > 1) continue;
      const r = solve(g, W, H, [0, a], [W - 1, b]);
      const straight = r.straight;
      const score = straight / r.cost;
      if (!pair || score > pair.score) pair = { a, b, score, opt: r.cost, straight };
    }
    if (!pair || pair.score < 1.8) continue;
    const sc = pair.score * (0.5 + cov);
    if (!best || sc > best.sc) best = { sc, ox, oy, g, pair, cov };
  }
  if (!best) { console.log('skip', date, hh); continue; }
  const lon0 = -126 + best.ox * 0.01, lat0 = 50 - best.oy * 0.01;
  puzzles.push({
    date, utc: `${hh}:00`, lat0: +lat0.toFixed(2), lon0: +lon0.toFixed(2), cell: 0.25,
    grid: best.g.map((v) => v.toString(16)).join(''), start: [0, best.pair.a], end: [W - 1, best.pair.b],
  });
  console.log(puzzles.length, date, hh, best.pair.score.toFixed(2), best.cov.toFixed(2));
}
fs.writeFileSync(path.join(dir, '..', 'data.json'), JSON.stringify({ w: W, h: H, puzzles }));
console.log('wrote', puzzles.length);
