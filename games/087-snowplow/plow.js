// Pure snowplow model: road graph, speeds that depend on snow depth, shortest
// "state-aware" travel, a reference solver (Held-Karp + local search).
// Graph: { nodes: [[lat,lng]], edges: [[a,b,lenMeters,req]], depot }.

export const V_FREE = 40; // km/h on a cleared road (or a main road once plowed)

/** km/h for the three situations at a given snow depth (inches). */
export function speeds(depth) {
  return {
    free: V_FREE,
    plow: Math.max(5, 22 - 0.9 * depth), // pushing snow on a priority road
    res: Math.max(8, 32 - 1.0 * depth), // driving through snow on an unplowed side street
  };
}

/** Minutes to drive edge `e` given whether it is already plowed. */
export function edgeMinutes(e, cleared, depth) {
  const v = speeds(depth);
  const km = e[2] / 1000;
  if (e[3]) return (km / (cleared ? v.free : v.plow)) * 60;
  return (km / v.res) * 60;
}

export function adjacency(g) {
  const adj = g.nodes.map(() => []);
  g.edges.forEach((e, i) => { adj[e[0]].push([e[1], i]); adj[e[1]].push([e[0], i]); });
  return adj;
}

/** Dijkstra with a custom per-edge cost; returns { dist, prev: [[node, edge]] }. */
export function dijkstra(g, adj, src, cost) {
  const n = g.nodes.length;
  const dist = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(null);
  const done = new Array(n).fill(false);
  dist[src] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) break;
    done[u] = true;
    for (const [v, ei] of adj[u]) {
      const d = dist[u] + cost(ei);
      if (d < dist[v]) { dist[v] = d; prev[v] = [u, ei]; }
    }
  }
  return { dist, prev };
}

export function newState(g) {
  return { pos: g.depot, cleared: g.edges.map(() => false), time: 0, plowMin: 0, trail: [] };
}

/** Cheapest route (under the CURRENT plowed state) from state.pos to `to`. Returns list of [from,to,edge]. */
export function route(g, adj, depth, st, to) {
  const { prev } = dijkstra(g, adj, st.pos, (ei) => edgeMinutes(g.edges[ei], st.cleared[ei], depth));
  const legs = [];
  let at = to;
  while (at !== st.pos) {
    const p = prev[at];
    if (!p) return null;
    legs.push([p[0], at, p[1]]);
    at = p[0];
  }
  return legs.reverse();
}

/** Drive one leg; plows a priority road the first time it is driven. Mutates st. */
export function drive(g, depth, st, leg) {
  const [a, b, ei] = leg;
  const e = g.edges[ei];
  const m = edgeMinutes(e, st.cleared[ei], depth);
  if (e[3] && !st.cleared[ei]) { st.cleared[ei] = true; st.plowMin += m; }
  st.time += m;
  st.pos = b;
  st.trail.push([a, b, ei]);
}

export function goTo(g, adj, depth, st, to) {
  const legs = route(g, adj, depth, st, to);
  if (!legs) return false;
  for (const l of legs) drive(g, depth, st, l);
  return true;
}

export const done = (g, st) => g.edges.every((e, i) => !e[3] || st.cleared[i]);

/** Run a sequence of [edgeIndex, dir] (dir 0 = a→b, 1 = b→a). Returns final state. */
export function simulate(g, adj, depth, seq) {
  const st = newState(g);
  for (const [ei, dir] of seq) {
    const [a, b] = g.edges[ei];
    const from = dir ? b : a, to = dir ? a : b;
    if (st.cleared[ei]) continue;
    goTo(g, adj, depth, st, from);
    // plow it directly (the cheapest route to `from` could have crossed it already)
    if (!st.cleared[ei]) drive(g, depth, st, [from, to, ei]);
  }
  return st;
}

function lcg(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/** Held-Karp over priority edges; `plowedCost` sets the cost of re-driving a priority road in transit. */
function heldKarp(g, adj, depth, req, cheapTransit) {
  const k = req.length, S = 2 * k;
  const trCost = (ei) => (g.edges[ei][3] && !cheapTransit ? edgeMinutes(g.edges[ei], false, depth) : edgeMinutes(g.edges[ei], true, depth));
  const dist = g.nodes.map((_, i) => dijkstra(g, adj, i, trCost).dist);
  const end = (s) => { const [a, b] = g.edges[req[s >> 1]]; return s & 1 ? a : b; };
  const start = (s) => { const [a, b] = g.edges[req[s >> 1]]; return s & 1 ? b : a; };
  const plow = req.map((ei) => edgeMinutes(g.edges[ei], false, depth));
  const full = (1 << k) - 1;
  const dp = Array.from({ length: 1 << k }, () => new Float64Array(S).fill(Infinity));
  const par = Array.from({ length: 1 << k }, () => new Int16Array(S).fill(-1));
  for (let s = 0; s < S; s++) dp[1 << (s >> 1)][s] = dist[g.depot][start(s)] + plow[s >> 1];
  for (let m = 1; m <= full; m++) {
    for (let s = 0; s < S; s++) {
      const c = dp[m][s];
      if (c === Infinity) continue;
      for (let t = 0; t < S; t++) {
        if (m & (1 << (t >> 1))) continue;
        const nm = m | (1 << (t >> 1));
        const nc = c + dist[end(s)][start(t)] + plow[t >> 1];
        if (nc < dp[nm][t]) { dp[nm][t] = nc; par[nm][t] = s; }
      }
    }
  }
  let bs = 0;
  for (let s = 1; s < S; s++) if (dp[full][s] < dp[full][bs]) bs = s;
  const seq = [];
  let m = full, s = bs;
  while (s >= 0) { seq.push([req[s >> 1], s & 1]); const p = par[m][s]; m &= ~(1 << (s >> 1)); s = p; }
  return seq.reverse();
}

/** Reference route: best of two DP orderings polished by local search under the true rules. */
export function solve(g, depth, seed = 7) {
  const adj = adjacency(g);
  const req = g.edges.map((e, i) => (e[3] ? i : -1)).filter((i) => i >= 0);
  let best = null, bestT = Infinity;
  const consider = (seq) => {
    const t = simulate(g, adj, depth, seq).time;
    if (t < bestT - 1e-9) { bestT = t; best = seq; }
    return t;
  };
  consider(heldKarp(g, adj, depth, req, false));
  consider(heldKarp(g, adj, depth, req, true));
  const rnd = lcg(seed);
  for (let it = 0; it < 1200; it++) {
    const s = best.map((x) => x.slice());
    const i = Math.floor(rnd() * s.length), j = Math.floor(rnd() * s.length);
    const r = rnd();
    if (r < 0.35) s[i][1] ^= 1;
    else if (r < 0.7) [s[i], s[j]] = [s[j], s[i]];
    else { const [x] = s.splice(i, 1); s.splice(j, 0, x); }
    consider(s);
  }
  const st = simulate(g, adj, depth, best);
  return { seq: best, time: st.time, plowMin: st.plowMin };
}

/** 100 at (or better than) the reference, 0 at 1.8× the reference time; −5 per restart. */
export function scoreFor(time, ref, resets = 0) {
  const over = time / ref - 1;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - over / 0.8)) - 5 * resets));
}
