// Pure shaping helpers shared by the browser (live load) and build/build.mjs:
// IEM NEXRAD N0R composite PNG (8-bit palette, 0.01 deg px) -> 36x24 storm window puzzle.
import { hazard, dijkstra, pathCost, line } from './route.js';

export const W = 36, H = 24, CELL = 25; // grid cells; px per cell (0.25 deg)
export const COMPOSITE = { w: 6000, h: 2600, lonW: -126, latN: 50, deg: 0.01 };
// strict tier = what the snapshot pool uses; the relaxed tier only exists so a quiet live day still yields a puzzle
export const TIERS = [
  { covMin: 0.18, covMax: 0.5, core: 8, ratio: 1.8 },
  { covMin: 0.1, covMax: 0.6, core: 4, ratio: 1.5 },
];

/** Decode an 8-bit palette PNG (colour type 3) into { w, h, px } (palette indices). Async: uses DecompressionStream. */
export async function decodePNG(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let p = 8, w = 0, h = 0, depth = 0, ctype = -1;
  const idat = [];
  while (p + 8 <= u8.length) {
    const len = dv.getUint32(p), t = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
    if (t === 'IHDR') { w = dv.getUint32(p + 8); h = dv.getUint32(p + 12); depth = u8[p + 16]; ctype = u8[p + 17]; }
    if (t === 'IDAT') idat.push(u8.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  if (!w || depth !== 8 || ctype !== 3) throw new Error(`unsupported PNG ${w}x${h} depth ${depth} type ${ctype}`);
  const total = idat.reduce((a, c) => a + c.length, 0), z = new Uint8Array(total);
  let o = 0; for (const c of idat) { z.set(c, o); o += c.length; }
  const d = new Uint8Array(await new Response(new Blob([z]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  const px = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const f = d[y * (w + 1)], r0 = y * (w + 1) + 1, o0 = y * w, up = o0 - w;
    for (let x = 0; x < w; x++) {
      const v = d[r0 + x], a = x ? px[o0 + x - 1] : 0, b = y ? px[up + x] : 0;
      let r;
      if (f === 0) r = v; else if (f === 1) r = v + a; else if (f === 2) r = v + b; else if (f === 3) r = v + ((a + b) >> 1);
      else { const c = x && y ? px[up + x - 1] : 0, pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      px[o0 + x] = r & 255;
    }
  }
  return { w, h, px };
}

/** Palette index 7..21 = 5 dBZ bins starting at 5 dBZ -> level 1..15 (level L = lower bound dBZ / 5); anything else = 0. */
const level = (i) => (i >= 7 && i <= 21 ? i - 6 : 0);

/** Crop an H x W grid of levels with its top-left at pixel (ox, oy): per cell, the 88th percentile of 169 samples. */
export function crop(img, ox, oy) {
  const g = new Array(W * H);
  const vals = new Array(169);
  for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
    let k = 0;
    for (let y = 0; y < CELL; y += 2) for (let x = 0; x < CELL; x += 2) vals[k++] = level(img.px[(oy + cy * CELL + y) * img.w + ox + cx * CELL + x]);
    vals.sort((a, b) => a - b);
    g[cy * W + cx] = vals[Math.floor(vals.length * 0.88)];
  }
  return g;
}

/**
 * Search windows of one composite for the best storm-run layout (start in the left column, end in the right,
 * both on clear cells, direct line much worse than the optimum). Returns null when nothing qualifies.
 * opts: { tier, x0, y0, x1, y1, step } — pixel bounds the window top-left may range over.
 */
export function bestWindow(img, opts = {}) {
  const tier = opts.tier ?? TIERS[0];
  const x0 = opts.x0 ?? 300, y0 = opts.y0 ?? 200, x1 = opts.x1 ?? img.w - 100, y1 = opts.y1 ?? img.h - 100, step = opts.step ?? 250;
  let best = null;
  for (let oy = y0; oy + H * CELL < y1; oy += step) for (let ox = x0; ox + W * CELL < x1; ox += step) {
    const g = crop(img, ox, oy);
    let wet = 0, core = 0;
    for (const v of g) { if (v >= 4) wet++; if (v >= 8) core++; }
    const cov = wet / g.length;
    if (cov < tier.covMin || cov > tier.covMax || core < tier.core) continue;
    let pair = null;
    for (let a = 1; a < H - 1; a += 4) {
      if (hazard(g[a * W]) > 1) continue;
      const { dist } = dijkstra(g, W, H, [0, a]);
      for (let b = 1; b < H - 1; b += 4) {
        if (hazard(g[b * W + W - 1]) > 1) continue;
        const opt = dist[b * W + W - 1], straight = pathCost(g, W, line([0, a], [W - 1, b])), score = straight / opt;
        if (!pair || score > pair.score) pair = { a, b, score };
      }
    }
    if (!pair || pair.score < tier.ratio) continue;
    const sc = pair.score * (0.5 + cov);
    if (!best || sc > best.sc) best = { sc, ox, oy, g, pair, cov };
  }
  return best;
}

/** Turn a decoded composite into a puzzle record (same shape as data.json puzzles), or null. */
export function toPuzzle(img, date, hh, opts = {}) {
  const c = { ...COMPOSITE, ...opts.composite };
  const best = bestWindow(img, opts);
  if (!best) return null;
  return {
    date, utc: `${hh}:00`,
    lat0: +(c.latN - best.oy * c.deg).toFixed(2), lon0: +(c.lonW + best.ox * c.deg).toFixed(2), cell: 0.25,
    grid: best.g.map((v) => v.toString(16)).join(''), start: [0, best.pair.a], end: [W - 1, best.pair.b],
    ...(opts.extra || {}),
    _sc: best.sc,
  };
}

/** Compose several hours of one day: keep the best-scoring window. */
export function pickBest(cands) {
  let best = null;
  for (const c of cands) if (c && (!best || c._sc > best._sc)) best = c;
  if (!best) return null;
  const { _sc, ...rest } = best;
  return rest;
}

export const livePath = (date, hh) => {
  const [y, m, d] = date.split('-');
  return `https://mesonet.agron.iastate.edu/archive/data/${y}/${m}/${d}/GIS/uscomp/n0r_${y}${m}${d}${hh}00.png`;
};
