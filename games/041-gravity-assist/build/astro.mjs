// Patched-conic helpers: Lambert solver (universal variables) and powered-flyby cost.
export const MU_SUN = 1.32712440018e11; // km^3/s^2
export const PLANETS = {
  mercury: { mu: 22032, rmin: 2440 + 200 },
  venus: { mu: 324858.6, rmin: 6051.8 + 300 },
  earth: { mu: 398600.4, rmin: 6371 + 300 },
  mars: { mu: 42828.4, rmin: 3389.5 + 300 },
  jupiter: { mu: 126686534, rmin: 71492 * 1.5 },
  saturn: { mu: 37931207, rmin: 60268 * 1.5 },
};
export const R_LEO = 6371 + 300;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => Math.sqrt(dot(a, a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export { norm };

function stumpC(z) { return z > 1e-8 ? (1 - Math.cos(Math.sqrt(z))) / z : z < -1e-8 ? (Math.cosh(Math.sqrt(-z)) - 1) / -z : 0.5 - z / 24; }
function stumpS(z) { return z > 1e-8 ? (Math.sqrt(z) - Math.sin(Math.sqrt(z))) / Math.pow(z, 1.5) : z < -1e-8 ? (Math.sinh(Math.sqrt(-z)) - Math.sqrt(-z)) / Math.pow(-z, 1.5) : 1 / 6 - z / 120; }

/** Prograde zero-revolution Lambert (Curtis alg. 5.2). Returns {v1, v2} (km/s) or null. */
export function lambert(r1, r2, dt, mu = MU_SUN) {
  const R1 = norm(r1), R2 = norm(r2);
  const cz = cross(r1, r2)[2];
  let dth = Math.acos(Math.max(-1, Math.min(1, dot(r1, r2) / (R1 * R2))));
  if (cz < 0) dth = 2 * Math.PI - dth;
  const A = Math.sin(dth) * Math.sqrt((R1 * R2) / (1 - Math.cos(dth)));
  if (Math.abs(A) < 1e-9) return null;
  const y = (z) => R1 + R2 + (A * (z * stumpS(z) - 1)) / Math.sqrt(stumpC(z));
  const F = (z) => { const yy = y(z); return Math.pow(yy / stumpC(z), 1.5) * stumpS(z) + A * Math.sqrt(yy) - Math.sqrt(mu) * dt; };
  // bracket: y(z) must be > 0
  let lo = -4 * Math.PI * Math.PI, hi = 4 * Math.PI * Math.PI - 1e-3;
  while (y(lo) < 0 || !isFinite(F(lo))) lo += 1;
  if (!(F(lo) < 0 && F(hi) > 0)) { if (F(lo) > 0) return null; }
  for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (F(mid) < 0) lo = mid; else hi = mid; }
  const z = (lo + hi) / 2, yy = y(z);
  if (!(yy > 0) || !isFinite(yy)) return null;
  const f = 1 - yy / R1, g = A * Math.sqrt(yy / mu), gd = 1 - yy / R2;
  const v1 = r2.map((c, i) => (c - f * r1[i]) / g);
  const v2 = r2.map((c, i) => (gd * c - r1[i]) / g);
  return { v1, v2 };
}

/** Departure burn from a circular LEO to reach hyperbolic excess vinf. */
export function departDv(vinf, mu = PLANETS.earth.mu, r = R_LEO) {
  return Math.sqrt(vinf * vinf + (2 * mu) / r) - Math.sqrt(mu / r);
}

const turn = (rp, v, mu) => Math.asin(1 / (1 + (rp * v * v) / mu));

/** Cheapest burn at a flyby turning vinIn into vOut (vectors relative to the planet, km/s). */
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
