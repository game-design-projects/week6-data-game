// Candidate daily colors: the xkcd color survey (222,500 people naming 3.4 million random
// colors; CC0) filtered to vivid colors that the five paints can actually reach.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allPots, solve, oklab } from '../web/color.js';
import { OKLab_to_OKLCh } from '../web/vendor/spectral.js';

const SURVEY = fileURLToPath(new URL('../data/xkcd-rgb.txt', import.meta.url));
export const MIN_CHROMA = 0.15; // OKLCH chroma; below this olives, ochres and dusty shades creep in
export const MIN_REACHABLE = 96; // best accuracy the paints can reach within the pot
// The survey is the internet's vocabulary; skip the bathroom humor when the name is revealed in class.
const UNSHOWABLE = /poo|puke|vomit|diarrh|shit|piss|barf|snot|booger/i;

export function survey() {
  return readFileSync(SURVEY, 'utf8').split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => { const [name, hex] = line.split('\t'); return { name: name.trim(), hex: hex.trim().toUpperCase() }; });
}

/** Vivid, reachable survey colors with their OKLCH, best recipe and par (fewest drops to a match). */
export function candidates({ minChroma = MIN_CHROMA, clean = true, log = () => {} } = {}) {
  const started = Date.now();
  const pots = allPots();
  const out = [];
  for (const color of survey()) {
    const [L, C, h] = OKLab_to_OKLCh(oklab(color.hex));
    if (C < minChroma || (clean && UNSHOWABLE.test(color.name))) continue;
    const { best, par } = solve(color.hex, pots);
    if (best.acc < MIN_REACHABLE || !par) continue;
    out.push({ ...color, L, C, h, best, par });
  }
  log(`[colors] ${out.length} vivid reachable colors from ${pots.length} pots in ${Date.now() - started} ms`);
  return out;
}

/** Deterministic PRNG (mulberry32) so a seed always yields the same level order. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shuffle with a seed, then interleave hue sextants so consecutive days never share a hue family. */
export function dailyOrder(colors, seed) {
  const rand = rng(seed);
  const bins = Array.from({ length: 6 }, () => []);
  for (const c of colors) bins[Math.floor(c.h / 60) % 6].push(c);
  for (const bin of bins) for (let i = bin.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [bin[i], bin[j]] = [bin[j], bin[i]]; }
  const order = [];
  const binOrder = [0, 3, 1, 4, 2, 5]; // jump across the wheel each day
  for (let round = 0; order.length < colors.length; round++) {
    for (const b of binOrder) if (bins[b][round]) order.push(bins[b][round]);
  }
  return order;
}
