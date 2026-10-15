// Surrogate-series generators shared by build.mjs and tests.
export function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
export const diff = (x) => x.slice(1).map((v, i) => v - x[i]);
export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
export const integrate = (x0, d) => { const o = [x0]; for (const v of d) o.push(o[o.length - 1] + v); return o; };
export function ar1(d, r) {
  const m = mean(d), c = d.map((v) => v - m);
  const phi = c.slice(1).reduce((s, v, i) => s + v * c[i], 0) / c.slice(0, -1).reduce((s, v) => s + v * v, 0);
  const sig = std(c) * Math.sqrt(1 - phi * phi); const o = []; let p = 0;
  for (let i = 0; i < d.length; i++) { p = phi * p + sig * gauss(r); o.push(m + p); }
  return o;
}
export function shuffle(d, r) { const o = d.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; }
export function block(d, r, B = 6) { const o = []; while (o.length < d.length) { const s = Math.floor(r() * (d.length - B + 1)); o.push(...d.slice(s, s + B)); } return o.slice(0, d.length); }
export function phase(d, r) {
  const n = d.length, m = mean(d), c = d.map((v) => v - m), K = Math.floor(n / 2);
  const re = [], im = [];
  for (let k = 0; k <= K; k++) { let a = 0, b = 0; for (let t = 0; t < n; t++) { const w = (2 * Math.PI * k * t) / n; a += c[t] * Math.cos(w); b -= c[t] * Math.sin(w); } re.push(a); im.push(b); }
  const out = [];
  const ph = re.map(() => 2 * Math.PI * r());
  for (let t = 0; t < n; t++) {
    let s = re[0] / n;
    for (let k = 1; k <= K; k++) { const amp = Math.hypot(re[k], im[k]) * (k === n / 2 ? 1 : 2) / n; s += amp * Math.cos((2 * Math.PI * k * t) / n + ph[k]); }
    out.push(m + s);
  }
  return out;
}
export const METHODS = { ar1: ['AR(1) Gaussian model', ar1], shuffle: ['Shuffled steps', shuffle], block: ['Block bootstrap', block], phase: ['Random phase (spectrum kept)', phase] };
export function surrogate(method, x, r) {
  const d = diff(x), g = METHODS[method][1](d, r);
  return integrate(x[0], g);
}
export const norm100 = (x) => { const lo = Math.min(...x), hi = Math.max(...x); return x.map((v) => Math.round(((v - lo) / (hi - lo || 1)) * 1000) / 10); };
