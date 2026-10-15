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

/** Single-source Dijkstra over 8-neighbours with a binary heap. Returns { dist, prev } typed arrays. */
export function dijkstra(grid, w, h, from) {
  const n = w * h, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
  const hd = [], hv = []; // heap of (dist, node)
  const push = (d, v) => {
    let i = hd.length; hd.push(d); hv.push(v);
    while (i > 0) { const p = (i - 1) >> 1; if (hd[p] <= d) break; hd[i] = hd[p]; hv[i] = hv[p]; i = p; }
    hd[i] = d; hv[i] = v;
  };
  const pop = () => {
    const d0 = hd[0], v0 = hv[0], d = hd.pop(), v = hv.pop(), m = hd.length;
    if (m) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1; if (c >= m) break;
        if (c + 1 < m && hd[c + 1] < hd[c]) c++;
        if (hd[c] >= d) break;
        hd[i] = hd[c]; hv[i] = hv[c]; i = c;
      }
      hd[i] = d; hv[i] = v;
    }
    return [d0, v0];
  };
  const src = from[1] * w + from[0];
  dist[src] = 0; push(0, src);
  while (hd.length) {
    const [d, u] = pop();
    if (d > dist[u]) continue;
    const ux = u % w, uy = (u / w) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = ux + dx, y = uy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const v = y * w + x, nd = d + hazard(grid[v]) * (dx && dy ? SQ2 : 1);
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push(nd, v); }
    }
  }
  return { dist, prev };
}

/** Optimal route. Returns { cost, path, straight } where straight = cost of the direct line. */
export function solve(grid, w, h, from, to) {
  const { dist, prev } = dijkstra(grid, w, h, from);
  const dst = to[1] * w + to[0];
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
