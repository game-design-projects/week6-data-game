// Gravity Assist — pure orbital mechanics: JPL Keplerian ephemeris, Lambert solver, patched-conic flyby cost,
// and the route planner. No DOM / fetch / Date.now: runs identically in Node tests and in the browser.
export const MU_SUN = 1.32712440018e11; // km^3/s^2
export const AU = 1.495978707e8; // km
export const PLANETS = {
  mercury: { mu: 22032, rmin: 2440 + 200 },
  venus: { mu: 324858.6, rmin: 6051.8 + 300 },
  earth: { mu: 398600.4, rmin: 6371 + 300 },
  mars: { mu: 42828.4, rmin: 3389.5 + 300 },
  jupiter: { mu: 126686534, rmin: 71492 * 1.5 },
  saturn: { mu: 37931207, rmin: 60268 * 1.5 },
};
export const R_LEO = 6371 + 300;
export const STEP = 10; // days per planning-grid index
export const NDEP = 10; // departure candidates ...
export const DEP_STRIDE = 4; // ... every 4 grid steps (40 days) -> a 400-day window
export const MAX_YEARS = 14;
export const BODIES = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn'];
/** target -> three candidate flyby planets (Earth is excluded: it would need a resonant return orbit) */
export const FLYBYS = {
  mars: ['venus', 'jupiter', 'mercury'],
  mercury: ['venus', 'mars', 'jupiter'],
  venus: ['mercury', 'mars', 'jupiter'],
  jupiter: ['venus', 'mars', 'saturn'],
  saturn: ['venus', 'mars', 'jupiter'],
};
export const TARGETS = Object.keys(FLYBYS);

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a) => Math.sqrt(dot(a, a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// ───────────── ephemeris: JPL "Approximate Positions of the Planets", Table 1 (1800–2050) ─────────────
const D2R = Math.PI / 180;
export const jdOf = (date) => Date.parse(`${date}T00:00:00Z`) / 86400000 + 2440587.5;

/** Heliocentric ecliptic-J2000 position in km. el[body] = {a,e,I,L,w,n} each [value, rate per century]. */
export function position(el, body, jd) {
  const T = (jd - 2451545.0) / 36525;
  const g = (k) => el[body][k][0] + el[body][k][1] * T;
  const a = g('a'), e = g('e'), I = g('I') * D2R, L = g('L'), w = g('w'), node = g('n');
  const omega = (w - node) * D2R, Om = node * D2R;
  let M = (((L - w) % 360) + 540) % 360 - 180; // −180..180 deg
  M *= D2R;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 30; i++) { const d = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E)); E += d; if (Math.abs(d) < 1e-12) break; }
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const co = Math.cos(omega), so = Math.sin(omega), cO = Math.cos(Om), sO = Math.sin(Om), cI = Math.cos(I), sI = Math.sin(I);
  return [
    ((co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp) * AU,
    ((co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp) * AU,
    ((so * sI) * xp + (co * sI) * yp) * AU,
  ];
}
/** position (km) + velocity (km/s, central difference over one day). */
export function state(el, body, jd) {
  const p = position(el, body, jd), a = position(el, body, jd - 0.5), b = position(el, body, jd + 0.5);
  return { r: p, v: [(b[0] - a[0]) / 86400, (b[1] - a[1]) / 86400, (b[2] - a[2]) / 86400] };
}
/** heliocentric longitude of body minus that of earth, degrees in (−180, 180] */
export function phaseDeg(el, body, jd) {
  const a = position(el, body, jd), e = position(el, 'earth', jd);
  const d = (Math.atan2(a[1], a[0]) - Math.atan2(e[1], e[0])) / D2R;
  return ((d + 540) % 360) - 180;
}

// ───────────── Lambert (universal variables, Curtis alg. 5.2) ─────────────
function stumpC(z) { return z > 1e-8 ? (1 - Math.cos(Math.sqrt(z))) / z : z < -1e-8 ? (Math.cosh(Math.sqrt(-z)) - 1) / -z : 0.5 - z / 24; }
function stumpS(z) { return z > 1e-8 ? (Math.sqrt(z) - Math.sin(Math.sqrt(z))) / Math.pow(z, 1.5) : z < -1e-8 ? (Math.sinh(Math.sqrt(-z)) - Math.sqrt(-z)) / Math.pow(-z, 1.5) : 1 / 6 - z / 120; }

/** Prograde zero-revolution Lambert arc. Returns {v1, v2} (km/s) or null. */
export function lambert(r1, r2, dt, mu = MU_SUN) {
  const R1 = norm(r1), R2 = norm(r2);
  const cz = cross(r1, r2)[2];
  let dth = Math.acos(Math.max(-1, Math.min(1, dot(r1, r2) / (R1 * R2))));
  if (cz < 0) dth = 2 * Math.PI - dth;
  const A = Math.sin(dth) * Math.sqrt((R1 * R2) / (1 - Math.cos(dth)));
  if (Math.abs(A) < 1e-9) return null;
  const y = (z) => R1 + R2 + (A * (z * stumpS(z) - 1)) / Math.sqrt(stumpC(z));
  const F = (z) => { const yy = y(z); return Math.pow(yy / stumpC(z), 1.5) * stumpS(z) + A * Math.sqrt(yy) - Math.sqrt(mu) * dt; };
  let lo = -4 * Math.PI * Math.PI, hi = 4 * Math.PI * Math.PI - 1e-3;
  while (y(lo) < 0 || !isFinite(F(lo))) lo += 1;
  if (!(F(lo) < 0 && F(hi) > 0)) { if (F(lo) > 0) return null; }
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (F(mid) < 0) lo = mid; else hi = mid; }
  const z = (lo + hi) / 2, yy = y(z);
  if (!(yy > 0) || !isFinite(yy)) return null;
  const f = 1 - yy / R1, g = A * Math.sqrt(yy / mu), gd = 1 - yy / R2;
  return { v1: r2.map((c, i) => (c - f * r1[i]) / g), v2: r2.map((c, i) => (gd * c - r1[i]) / g) };
}

/** Burn from a circular 300 km LEO that reaches hyperbolic excess speed vinf. */
export function departDv(vinf, mu = PLANETS.earth.mu, r = R_LEO) {
  return Math.sqrt(vinf * vinf + (2 * mu) / r) - Math.sqrt(mu / r);
}
const turn = (rp, v, mu) => Math.asin(1 / (1 + (rp * v * v) / mu));

/** Cheapest burn at a flyby turning vIn into vOut (vectors relative to the planet, km/s). */
export function flybyDv(vIn, vOut, body) {
  const { mu, rmin } = PLANETS[body];
  const vi = norm(vIn), vo = norm(vOut);
  const delta = Math.acos(Math.max(-1, Math.min(1, dot(vIn, vOut) / (vi * vo))));
  const f = (rp) => turn(rp, vi, mu) + turn(rp, vo, mu);
  if (f(rmin) < delta) {
    const short = delta - f(rmin);
    const extra = Math.sqrt(Math.max(0, vi * vi + vo * vo - 2 * vi * vo * Math.cos(short)));
    return Math.abs(Math.sqrt(vo * vo + (2 * mu) / rmin) - Math.sqrt(vi * vi + (2 * mu) / rmin)) + extra;
  }
  let lo = rmin, hi = rmin * 1e4;
  if (f(hi) > delta) return Math.abs(vo - vi);
  for (let i = 0; i < 60; i++) { const mid = Math.sqrt(lo * hi); if (f(mid) > delta) lo = mid; else hi = mid; }
  const rp = Math.sqrt(lo * hi);
  return Math.abs(Math.sqrt(vo * vo + (2 * mu) / rp) - Math.sqrt(vi * vi + (2 * mu) / rp));
}

// ───────────── route planner ─────────────
const mean = (el, b) => el[b].a[0];
/** candidate flight times (grid indices) for one leg, around the Hohmann time */
function tofs(el, a, b) {
  const at = (mean(el, a) + mean(el, b)) / 2;
  const hoh = (Math.PI * Math.sqrt(Math.pow(at * AU, 3) / MU_SUN)) / 86400 / STEP;
  const lo = Math.max(2, Math.floor(hoh * 0.5)), hi = Math.ceil(hoh * 1.9);
  const stride = Math.max(1, Math.round((hi - lo) / 9));
  const out = [];
  for (let k = lo; k <= hi; k += stride) out.push(k);
  return out;
}

/** Make a planner bound to one launch date; caches states and Lambert arcs. */
export function planner(el, date) {
  const jd0 = jdOf(date);
  const sc = new Map(), lc = new Map();
  const st = (b, i) => { const k = `${b}${i}`; if (!sc.has(k)) sc.set(k, state(el, b, jd0 + i * STEP)); return sc.get(k); };
  const leg = (a, b, ia, ib) => {
    const k = `${a}${b}${ia}_${ib}`;
    if (!lc.has(k)) lc.set(k, lambert(st(a, ia).r, st(b, ib).r, (ib - ia) * STEP * 86400));
    return lc.get(k);
  };
  const maxIdx = Math.round((MAX_YEARS * 365.25) / STEP);
  /** best total Δv over the departure window for the path [earth, …flybys, target] */
  function best(path) {
    const n = path.length;
    const ks = path.slice(0, -1).map((p, i) => tofs(el, p, path[i + 1]));
    let bestR = null;
    const go = (li, idxs, legs) => {
      if (li === n - 1) {
        const dep = norm(sub(legs[0].v1, st(path[0], idxs[0]).v));
        const flybys = [];
        let dv = departDv(dep);
        for (let j = 1; j < n - 1; j++) {
          const vp = st(path[j], idxs[j]).v;
          const c = flybyDv(sub(legs[j - 1].v2, vp), sub(legs[j].v1, vp), path[j]);
          flybys.push(c); dv += c;
        }
        const arr = norm(sub(legs[n - 2].v2, st(path[n - 1], idxs[n - 1]).v));
        dv += arr;
        if (!bestR || dv < bestR.dv) bestR = { dv, dep, flybys, arr, idxs: [...idxs] };
        return;
      }
      for (const k of ks[li]) {
        const ni = idxs[li] + k;
        if (ni - idxs[0] > maxIdx) break;
        const l = leg(path[li], path[li + 1], idxs[li], ni);
        if (l) go(li + 1, [...idxs, ni], [...legs, l]);
      }
    };
    for (let d = 0; d < NDEP; d++) go(0, [d * DEP_STRIDE], []);
    return bestR;
  }
  return { jd0, st, best };
}

const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const r2 = (x) => Math.round(x * 100) / 100;

/** Four candidate routes (direct + three single-flyby) for a target, launch window opening on `date`. */
export function routesFor(el, date, target) {
  const pl = planner(el, date);
  const out = [];
  for (const via of [null, ...FLYBYS[target]]) {
    const r = pl.best(via ? ['earth', via, target] : ['earth', target]);
    if (!r) return null;
    const last = r.idxs[r.idxs.length - 1];
    out.push({
      via, dv: r2(r.dv), vinf: r2(r.dep), flyby: r.flybys.map(r2), arr: r2(r.arr),
      launch: addDays(date, r.idxs[0] * STEP), flybyDate: via ? addDays(date, r.idxs[1] * STEP) : null, arrive: addDays(date, last * STEP),
      years: Math.round(((last - r.idxs[0]) * STEP / 365.25) * 10) / 10,
    });
  }
  return out;
}

export const MIN_GAP = 1.04; // adjacent routes must differ by ≥ 4 %
const minGap = (routes) => { const s = routes.map((r) => r.dv).sort((a, b) => a - b); return Math.min(...s.slice(1).map((v, i) => v / s[i])); };

/** The puzzle for a date: try the day's target first, then the others until the four routes are clearly separated. */
export function buildPuzzle(el, date, firstTarget) {
  const s0 = Math.max(0, TARGETS.indexOf(firstTarget));
  const order = TARGETS.map((_, i) => TARGETS[(s0 + i) % TARGETS.length]);
  let fallback = null;
  for (const target of order) {
    const routes = routesFor(el, date, target);
    if (!routes) continue;
    const g = minGap(routes);
    if (g >= MIN_GAP) return { date, target, routes };
    if (!fallback || g > fallback.g) fallback = { g, date, target, routes };
  }
  if (!fallback) return null;
  const { g, ...rest } = fallback;
  return rest;
}
