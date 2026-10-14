// Exact-change solver shared by the build script, the game and the tests.
/** Count/describe ways to spend exactly `budget` cents with qty<=maxQty each and >=minKinds distinct items. */
export function solveExact(cents, budget, maxQty, minKinds) {
  const n = cents.length;
  // state: spent -> kinds (capped) -> count ; DP over items
  let dp = new Map([[`0|0`, { count: 1, ex: [] }]]);
  for (let i = 0; i < n; i++) {
    const next = new Map();
    for (const [key, v] of dp) {
      const [s, k] = key.split('|').map(Number);
      for (let q = 0; q <= maxQty && s + q * cents[i] <= budget; q++) {
        const nk = Math.min(minKinds, k + (q > 0 ? 1 : 0));
        const nkey = `${s + q * cents[i]}|${nk}`;
        const cur = next.get(nkey);
        if (cur) cur.count += v.count; else next.set(nkey, { count: v.count, ex: [...v.ex, q] });
      }
    }
    dp = next;
  }
  const hit = dp.get(`${budget}|${minKinds}`);
  return { count: hit ? hit.count : 0, example: hit ? hit.ex : null };
}
/** 0..100: exact = 100, each cent short costs 6 points. */
export function scoreGap(gapCents) { return Math.max(0, 100 - 6 * gapCents); }
