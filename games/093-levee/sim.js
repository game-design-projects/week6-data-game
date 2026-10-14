// Pure, deterministic toy flood model shared by the game, tests and build script.
export const N = 16;
export const LEN = 5;          // levee length in cells
export const STEPS = 400;
export const RAIN_STEPS = 100;
export const K = 0.2;
export const WET = 0.3;        // m of water that ruins a building
export const WALL = 60;        // m added to levee cells

/** Cells covered by a levee {r,c,o:'h'|'v'} (centered on r,c, clamped inside the grid). */
export function leveeCells({ r, c, o }) {
  const out = [];
  const half = Math.floor(LEN / 2);
  let start = (o === 'h' ? c : r) - half;
  start = Math.max(0, Math.min(N - LEN, start));
  for (let i = 0; i < LEN; i++) out.push(o === 'h' ? r * N + start + i : (start + i) * N + c);
  return out;
}

/** Rain R metres on every cell, water flows downhill; returns max depth per cell. */
export function simulate(z, rain, levees = []) {
  const zz = Float64Array.from(z);
  for (const lv of levees) for (const i of leveeCells(lv)) zz[i] += WALL;
  const w = new Float64Array(N * N);
  const mx = new Float64Array(N * N);
  const d = new Float64Array(N * N);
  const out = new Float64Array(N * N * 4);
  const dr = [-1, 1, 0, 0], dc = [0, 0, -1, 1];
  for (let t = 0; t < STEPS; t++) {
    if (t < RAIN_STEPS) for (let i = 0; i < w.length; i++) w[i] += rain / RAIN_STEPS;
    d.fill(0);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const i = r * N + c;
      if (w[i] <= 0) continue;
      const s = zz[i] + w[i];
      let tot = 0;
      const f = [0, 0, 0, 0];
      let edge = 0;
      for (let k = 0; k < 4; k++) {
        const rr = r + dr[k], cc = c + dc[k];
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) { edge += w[i] * K * 0.5; continue; }
        const j = rr * N + cc;
        const diff = s - (zz[j] + w[j]);
        if (diff > 0) { f[k] = K * diff; tot += f[k]; }
      }
      const total = tot + edge;
      const scale = total > w[i] ? w[i] / total : 1;
      for (let k = 0; k < 4; k++) if (f[k]) d[(r + dr[k]) * N + c + dc[k]] += f[k] * scale;
      d[i] -= total * scale;
    }
    for (let i = 0; i < w.length; i++) { w[i] += d[i]; if (w[i] > mx[i]) mx[i] = w[i]; }
  }
  void out;
  return mx;
}

/** Number of buildings (b = count per cell) left dry. */
export function dryCount(b, depth) {
  let n = 0;
  for (let i = 0; i < b.length; i++) if (depth[i] < WET) n += b[i];
  return n;
}

export const total = (b) => b.reduce((a, x) => a + x, 0);

export function saved(p, levees) {
  return dryCount(p.b, simulate(p.z, p.rain, levees));
}

/** Score 0..100: share of the achievable improvement (greedy reference) you captured. */
export function scoreOf(base, best, got) {
  if (best <= base) return got >= base ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((100 * (got - base)) / (best - base))));
}

/** Greedy search of n levees (offline reference). */
export function greedy(z, b, rain, n = 3) {
  const chosen = [];
  let cur = dryCount(b, simulate(z, rain, chosen));
  for (let k = 0; k < n; k++) {
    let bestV = null, bestN = cur;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const o of ['h', 'v']) {
      const lv = { r, c, o };
      const v = dryCount(b, simulate(z, rain, [...chosen, lv]));
      if (v > bestN) { bestN = v; bestV = lv; }
    }
    if (!bestV) break;
    chosen.push(bestV); cur = bestN;
  }
  return { levees: chosen, dry: cur };
}
