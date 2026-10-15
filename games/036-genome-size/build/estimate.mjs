/** Robust per-species size (Mb) from every NCBI assembly row of that organism.
 *  1) drop fragments (organelle / single-chromosome entries): < 25% of the upper median
 *  2) take the lower quartile of the rest as a reference and keep rows within [0.75, 1.35] x of it (drops doubled diploid assemblies)
 *  3) answer = median of kept rows. */
export function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function estimateSize(sizes) {
  const s = [...sizes].sort((a, b) => a - b);
  const upper = median(s.slice(s.length >> 1));
  const full = s.filter((x) => x >= 0.25 * upper);
  const m = full[Math.floor((full.length - 1) * 0.25)]; // lower quartile: diploid/haplotype-merged assemblies are ~2x, partial ones are rarer
  const kept = full.filter((x) => x >= 0.75 * m && x <= 1.35 * m);
  return { mb: median(kept), used: kept.length };
}
