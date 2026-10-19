// Color core shared by the game, the painting renderer and the tests: sRGB <-> OKLab, HSV for the
// picker, match % and the per-axis hint shown after each test. No DOM in here.
// The OKLab math matches scripts/build_paintings.py, which computes each day's answer.

export const MAX_TESTS = 6;
export const TEST_PENALTY = 3; // points lost for every test after the first
export const MATCH = 95; // accuracy that counts as a match in the share grid

const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = x => Math.min(1, Math.max(0, x));

/** Linear-light sRGB (0–1) to OKLab [L, a, b]. */
export function linearToOklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

/** OKLab to 0–255 sRGB channels, clamped into gamut. */
export function oklabToRgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ].map(c => Math.round(toGamma(clamp01(c)) * 255));
}

export const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
export const hexOf = channels => '#' + channels.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
export const oklab = hex => linearToOklab(...rgb(hex).map(x => toLinear(x / 255)));
export const distance = (a, b) => { const p = oklab(a), q = oklab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
export const lch = hex => { const [L, a, b] = oklab(hex); return [L, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360]; };

/** HSV (h in degrees, s and v 0–1) to '#RRGGBB'. This is what the in-game picker produces. */
export function hsvToHex(h, s, v) {
  const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return hexOf([f(5), f(3), f(1)].map(x => Math.round(x * 255)));
}

/** '#RRGGBB' to HSV; grays come back with hue 0. */
export function hexToHsv(hex) {
  const [r, g, b] = rgb(hex).map(x => x / 255);
  const v = Math.max(r, g, b), c = v - Math.min(r, g, b);
  const h = !c ? 0 : v === r ? ((g - b) / c + 6) % 6 : v === g ? (b - r) / c + 2 : (r - g) / c + 4;
  return { h: h * 60, s: v ? c / v : 0, v };
}

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
