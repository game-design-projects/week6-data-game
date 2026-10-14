// engine/core.js — pure helpers shared by every game.
// No DOM, no fetch, no globals: safe to import from Node tests.

/** Puzzle #1 is this date. Everything before it is unplayable. */
export const EPOCH = '2026-10-01';

// ───────────────────────── dates ─────────────────────────

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isISODate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
}

const toUTC = (iso) => Date.parse(iso + 'T00:00:00Z');
const DAY_MS = 86400000;

export function addDays(iso, n) {
  const d = new Date(toUTC(iso) + n * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Days between two ISO dates (b − a). */
export function daysBetween(a, b) {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

/** Puzzle number for a date: EPOCH → 1. */
export function dayNumber(iso) {
  return daysBetween(EPOCH, iso) + 1;
}

export function isoFromDay(n) {
  return addDays(EPOCH, n - 1);
}

/** Day of week 0=Sun…6=Sat for an ISO date. */
export function weekday(iso) {
  return new Date(toUTC(iso)).getUTCDay();
}

// ───────────────────────── seeded randomness ─────────────────────────

/** 32-bit FNV-1a hash of a string. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG → floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic RNG with convenience methods. Same seed → same sequence. */
export function makeRng(seed) {
  const next = mulberry32(typeof seed === 'number' ? seed : hashString(String(seed)));
  const rng = {
    next,
    float: (a = 0, b = 1) => a + (b - a) * next(),
    /** Integer in [a, b] inclusive. */
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    chance: (p) => next() < p,
    pick: (arr) => {
      if (!arr || !arr.length) throw new Error('rng.pick: empty array');
      return arr[Math.floor(next() * arr.length)];
    },
    /** Returns a shuffled copy (Fisher–Yates). */
    shuffle: (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    /** k distinct elements, order randomized. */
    sample: (arr, k) => rng.shuffle(arr).slice(0, Math.min(k, arr.length)),
    /** Standard normal via Box–Muller. */
    normal: (mu = 0, sigma = 1) => {
      const u = 1 - next();
      const v = next();
      return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
  return rng;
}

/**
 * Index into a pool of n puzzles for a given day such that consecutive days
 * walk a seeded permutation: no repeats until the pool is exhausted, then a
 * fresh permutation for the next cycle.
 */
export function dailyIndex(slug, day, n) {
  if (!(n > 0)) throw new Error('dailyIndex: pool is empty');
  const k = day - 1;
  const cycle = Math.floor(k / n);
  const pos = ((k % n) + n) % n;
  const perm = makeRng(`${slug}:cycle:${cycle}`).shuffle([...Array(n).keys()]);
  return perm[pos];
}

// ───────────────────────── geography ─────────────────────────

const RAD = Math.PI / 180;

/** Great-circle distance in km. Points are {lat, lng}. */
export function haversineKm(a, b) {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Initial bearing from a to b in degrees, 0 = north, clockwise. */
export function bearingDeg(a, b) {
  const y = Math.sin((b.lng - a.lng) * RAD) * Math.cos(b.lat * RAD);
  const x =
    Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) -
    Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lng - a.lng) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Eight-way arrow for a bearing. */
export function arrow(deg) {
  return ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

// ───────────────────────── scoring ─────────────────────────

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const round = (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d;

/** Smooth decay: err 0 → max, err = scale → ~37% of max. */
export function expScore(err, scale, max = 100) {
  return Math.round(max * Math.exp(-Math.max(0, err) / scale));
}

/** Linear decay to 0 at zeroAt. */
export function linScore(err, zeroAt, max = 100) {
  return Math.round(max * clamp(1 - Math.max(0, err) / zeroAt, 0, 1));
}

export function pctError(guess, answer) {
  return answer === 0 ? Math.abs(guess) : Math.abs(guess - answer) / Math.abs(answer);
}

/** |log10(guess/answer)|; 1 means off by 10×. Both must be > 0. */
export function logError(guess, answer) {
  if (!(guess > 0) || !(answer > 0)) return Infinity;
  return Math.abs(Math.log10(guess / answer));
}

export function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 1 : inter / union;
}

/** F1 between predicted and true sets (e.g. edges as "a>b" strings). */
export function f1(pred, truth) {
  const P = new Set(pred);
  const T = new Set(truth);
  const tp = [...P].filter((x) => T.has(x)).length;
  if (tp === 0) return 0;
  const precision = tp / P.size;
  const recall = tp / T.size;
  return (2 * precision * recall) / (precision + recall);
}

/** Pearson correlation of two equal-length numeric arrays. */
export function pearson(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return NaN;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx, b = y[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  return num / Math.sqrt(dx * dy);
}

export const TILE = { hit: '🟩', near: '🟨', miss: '⬛', bad: '🟥', empty: '⬜' };

/** Fraction in [0,1] → a bar of n emoji squares. */
export function emojiBar(frac, n = 5) {
  const f = clamp(frac, 0, 1) * n;
  const full = Math.floor(f);
  const half = f - full >= 0.5 && full < n ? 1 : 0;
  return TILE.hit.repeat(full) + TILE.near.repeat(half) + TILE.empty.repeat(n - full - half);
}

/** Normalize a stage result so the shell can always render it. */
export function normalizeResult(r) {
  if (!r || typeof r !== 'object') throw new Error('play() must return a result object {score, max, …}');
  const max = Number.isFinite(r.max) && r.max > 0 ? r.max : 100;
  const score = clamp(Number.isFinite(r.score) ? r.score : 0, 0, max);
  return {
    score: round(score, 1),
    max,
    win: r.win ?? score >= max * 0.5,
    emoji: r.emoji ?? emojiBar(score / max),
    summary: r.summary ?? '',
    detail: r.detail ?? '',
  };
}

/** Merge several stage results (e.g. "guess the airport" + "guess the plane"). */
export function combine(results, { summarySep = ' · ' } = {}) {
  const rs = results.filter(Boolean).map(normalizeResult);
  return {
    score: rs.reduce((s, r) => s + r.score, 0),
    max: rs.reduce((s, r) => s + r.max, 0),
    win: rs.every((r) => r.win),
    emoji: rs.map((r) => r.emoji).join(' '),
    summary: rs.map((r) => r.summary).filter(Boolean).join(summarySep),
  };
}

// ───────────────────────── formatting ─────────────────────────

export function fmtNum(x, digits = 0) {
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 1234 → 1.2K, 3_400_000 → 3.4M. */
export function fmtCompact(x, digits = 1) {
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: digits });
}

export function fmtKm(km) {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${fmtNum(km)} km`;
}

export function fmtMoney(x, { currency = 'USD', digits } = {}) {
  if (!Number.isFinite(x)) return '—';
  const d = digits ?? (Math.abs(x) < 100 ? 2 : 0);
  return x.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtPct(frac, digits = 0) {
  if (!Number.isFinite(frac)) return '—';
  return `${(frac * 100).toFixed(digits)}%`;
}

// ───────────────────────── text matching ─────────────────────────

/** Lowercase, strip accents/punctuation, collapse whitespace. For comparing guesses. */
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
