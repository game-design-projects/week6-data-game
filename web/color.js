// Color core shared by the game and the build/experiment scripts: paint mixing,
// distance, score and the per-axis hint shown after each test. No DOM in here.
import { Color, mix, deltaEOK } from './vendor/spectral.js';

// Process-ink primaries plus white and black: CMY covers far more vivid colors than red-yellow-blue.
export const PAINTS = [
  { id: 'W', name: 'White', hex: '#F8F7F2', key: 'w' },
  { id: 'K', name: 'Black', hex: '#1E1D1C', key: 'k', strength: 3 }, // real black overpowers white
  { id: 'C', name: 'Cyan', hex: '#009FE3', key: 'c' },
  { id: 'M', name: 'Magenta', hex: '#E5007D', key: 'm' },
  { id: 'Y', name: 'Yellow', hex: '#FFE100', key: 'y' },
];
export const POT_CAPACITY = 30;
export const MAX_TESTS = 6;
export const TEST_PENALTY = 3; // points lost for every test after the first
export const MATCH = 95; // accuracy that counts as a match in the share grid

const pigments = PAINTS.map(p => {
  const c = new Color(p.hex);
  if (p.strength) c.tintingStrength = p.strength;
  return c;
});
const cache = new Map();

/** Mix paint by drop counts (array aligned with PAINTS). Returns '#RRGGBB', or null for an empty pot. */
export function mixHex(counts) {
  const key = counts.join(',');
  let hex = cache.get(key);
  if (hex !== undefined) return hex;
  const parts = [];
  counts.forEach((n, i) => { if (n > 0) parts.push([pigments[i], Math.sqrt(n)]); }); // spectral squares the factor; sqrt keeps concentration linear in drops
  hex = parts.length ? mix(...parts).toString() : null;
  if (cache.size > 50000) cache.clear();
  cache.set(key, hex);
  return hex;
}

export const oklab = hex => new Color(hex).OKLab;
export const distance = (a, b) => deltaEOK(oklab(a), oklab(b));

/** 0–100. Gaussian on OKLab distance: 0.05 ≈ 89, 0.10 ≈ 64, 0.20 ≈ 17. */
export function accuracy(guessHex, targetHex) {
  const d = distance(guessHex, targetHex);
  return Math.round(1000 * Math.exp(-((d / 0.15) ** 2))) / 10;
}

/** Score for a finished game: best test minus a flat cost for each extra test. */
export function score(tests) {
  if (!tests.length) return 0;
  const best = Math.max(...tests.map(t => t.acc));
  return Math.max(0, Math.round(best - TEST_PENALTY * (tests.length - 1)));
}

// OKLab axes: L light/dark, a green(-)/red(+), b blue(-)/yellow(+).
const AXES = [
  { axis: 'L', plus: 'lighter', minus: 'darker' },
  { axis: 'a', plus: 'redder', minus: 'greener' },
  { axis: 'b', plus: 'yellower', minus: 'bluer' },
];

/** Which way the target lies from the guess, per axis, with strength 0 (on it) to 3. */
export function hint(guessHex, targetHex) {
  const g = oklab(guessHex), t = oklab(targetHex);
  return AXES.map(({ axis, plus, minus }, i) => {
    const d = t[i] - g[i];
    const m = Math.abs(d);
    const strength = m < 0.015 ? 0 : m < 0.05 ? 1 : m < 0.12 ? 2 : 3;
    return { axis, word: strength ? (d > 0 ? plus : minus) : 'right on', strength, delta: d };
  });
}

/** Share-grid square for one test. */
export const square = acc => (acc >= MATCH ? '🟩' : acc >= 85 ? '🟨' : acc >= 70 ? '🟧' : '🟥');

/**
 * Every pot from 1..capacity drops, as [counts, hex, oklab]. Built once (~300k mixes);
 * the level builder uses it to prove each target is reachable and to find the fewest-drop recipe.
 */
export function allPots(capacity = POT_CAPACITY) {
  const out = [];
  const n = PAINTS.length;
  const counts = new Array(n).fill(0);
  const seen = new Set();
  (function rec(i, left) {
    if (i === n) {
      const total = counts.reduce((a, b) => a + b, 0);
      if (!total) return;
      const hex = mixHex(counts);
      if (seen.has(hex)) return; // same color from a bigger pot adds nothing
      seen.add(hex);
      out.push([counts.slice(), hex, oklab(hex), total]);
      return;
    }
    for (let k = 0; k <= left; k++) { counts[i] = k; rec(i + 1, left - k); }
    counts[i] = 0;
  })(0, capacity);
  return out;
}

/** Best reachable recipe and the smallest pot that still reaches `MATCH`. */
export function solve(targetHex, pots) {
  const t = oklab(targetHex);
  let best = null, par = null;
  for (const [counts, hex, lab, total] of pots) {
    const d = deltaEOK(lab, t);
    const acc = Math.round(1000 * Math.exp(-((d / 0.15) ** 2))) / 10;
    if (!best || acc > best.acc || (acc === best.acc && total < best.total)) best = { counts, hex, acc, total };
    if (acc >= MATCH && (!par || total < par.total || (total === par.total && acc > par.acc))) par = { counts, hex, acc, total };
  }
  return { best, par };
}
