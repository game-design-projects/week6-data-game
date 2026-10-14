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
