// Pure routing helpers for Storm Run. Grid cells hold radar level L = dBZ / 5 (0..15).
export const SQ2 = Math.SQRT2;

/** Per-cell hazard multiplier: clear 1, light rain 1.5, storm 3, severe 8, core 25. */
export function hazard(L) {
  if (L <= 3) return 1;
  if (L <= 5) return 1.5;
  if (L <= 7) return 3;
  if (L <= 9) return 8;
  return 25;
}

/** Cost of a path (array of [x,y]); each step costs hazard of the entered cell times 1 (or √2 diagonal). */
export function pathCost(grid, w, path) {
  let c = 0;
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1], [x, y] = path[i];
    c += hazard(grid[y * w + x]) * (x !== x0 && y !== y0 ? SQ2 : 1);
  }
  return c;
}

/** Dijkstra over 8-neighbours. Returns { cost, path, straight } where straight = cost of the direct line. */
export function solve(grid, w, h, from, to) {
  const n = w * h, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
  const src = from[1] * w + from[0], dst = to[1] * w + to[0];
  dist[src] = 0;
  const done = new Uint8Array(n);
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0 || u === dst) break;
    done[u] = 1;
    const ux = u % w, uy = (u / w) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = ux + dx, y = uy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const v = y * w + x, nd = dist[u] + hazard(grid[v]) * (dx && dy ? SQ2 : 1);
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; }
    }
  }
  const path = [];
  for (let v = dst; v >= 0; v = prev[v]) path.push([v % w, (v / w) | 0]);
  path.reverse();
  return { cost: dist[dst], path, straight: pathCost(grid, w, line(from, to)) };
}

/** Straight 8-connected line (interpolated). */
export function line(a, b) {
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) || 1;
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([Math.round(a[0] + ((b[0] - a[0]) * i) / n), Math.round(a[1] + ((b[1] - a[1]) * i) / n)]);
  return pts;
}

/** Score 0..100 from player cost vs optimal cost (1.0 ratio = 100). */
export function routeScore(opt, mine) {
  return Math.round(100 * Math.min(1, opt / mine) ** 1.5);
}

/** Decode a grid string of hex chars into an array of levels. */
export const decodeGrid = (s) => Array.from(s, (c) => parseInt(c, 16));
