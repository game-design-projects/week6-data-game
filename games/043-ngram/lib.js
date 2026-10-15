// Pure helpers (tested in game.test.mjs).
export function cosine(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na * nb) || 1);
}
export function pearson(a, b) {
  const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let c = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
  return c / (Math.sqrt(va * vb) || 1);
}
export const pct = (x) => `${Math.round(x * 100)}%`;
/** 'hit' | 'near' | undefined for a semantic cosine */
export const semState = (c) => (c >= 0.999 ? 'hit' : c >= 0.6 ? 'near' : undefined);
export function trendText(item) {
  const r = item.last;
  const t = r >= 0.9 ? '至今仍接近历史高点' : r >= 0.5 ? '近年有所回落，但仍在高位' : r >= 0.15 ? '峰值之后明显衰退' : '如今只剩峰值时的一小部分';
  return `峰值在 ${item.peak} 年前后；${t}。`;
}

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
/** Concrete facts about a yearly log10 curve: rise year, peak, share today, a second peak if any. */
export function shapeFacts(item, y0 = 1800) {
  const f = item.f, max = Math.max(...f), peakI = item.peak ? item.peak - y0 : f.indexOf(max);
  const riseI = f.findIndex((v) => v >= max - 1);            // first year within 10x of the peak
  const lastRatio = 10 ** (f.at(-1) - max);
  // decade means -> look for a second peak at least 30 years from the main one
  const dec = []; for (let i = 0; i + 10 <= f.length; i += 10) dec.push(mean(f.slice(i, i + 10)));
  const dMax = Math.max(...dec), dI = dec.indexOf(dMax);
  let second = null;
  for (let j = 1; j < dec.length - 1; j++) {
    if (Math.abs(j - dI) < 3 || dec[j] < dec[j - 1] || dec[j] < dec[j + 1] || dec[j] < dMax - 0.35) continue;
    const lo = Math.min(...dec.slice(Math.min(j, dI), Math.max(j, dI) + 1));
    if (dec[j] - lo >= 0.12 && (!second || dec[j] > second.v)) second = { year: y0 + j * 10 + 5, v: dec[j] };
  }
  return { peak: y0 + peakI, rise: y0 + riseI, lastRatio, second, riseFromStart: riseI <= 3, emerged: riseI > 3 && peakI - riseI <= 100 };
}
export function whyText(item, y0 = 1800) {
  const s = shapeFacts(item, y0);
  const parts = [];
  parts.push(s.riseFromStart ? `1800 年代起就已常见` : `${s.rise} 年前后词频首次升到峰值的十分之一以上`);
  parts.push(`${s.peak} 年到达顶点`);
  if (s.second) parts.push(`${s.second.year} 年前后另有一个高点（双峰）`);
  const now = s.lastRatio >= 0.9 ? '2019 年仍在历史最高位附近' : `2019 年只剩峰值的 ${Math.max(1, Math.round(s.lastRatio * 100))}%`;
  parts.push(now);
  return `${parts.join('，')}。峰值与谷底相差约 ${Math.round(10 ** item.range)} 倍。`;
}
export const peakNear = (a, b) => Math.abs(a - b) <= 10;
