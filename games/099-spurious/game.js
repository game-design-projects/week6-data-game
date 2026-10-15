// #99 Spurious — six real yearly series from six countries; find the one pair with r > 0.9.
export const corr = (a, b) => {
  const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let s = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { s += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; }
  return s / Math.sqrt(sa * sb);
};
export const diffs = (a) => a.slice(1).map((x, i) => x - a[i]);
export const LET = 'ABCDEF';
export const TARGET_MIN = 0.9;
export const DECOY_MAX = 0.8;

/** Everything the reveal needs for one set: r of the pair, r after de-trending, closest decoy pair, per-series trend. */
export function analyse(data, set) {
  const v = set.s.map((k) => data.lib[k]);
  const [i, j] = set.t;
  const years = data.years;
  const r = corr(v[i], v[j]);
  const rd = corr(diffs(v[i]), diffs(v[j]));
  let near = null;
  for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) {
    if (a === i && b === j) continue;
    const x = corr(v[a], v[b]);
    if (!near || x > near.r) near = { a, b, r: x };
  }
  const trend = v.map((s) => corr(s, years));
  const change = v.map((s) => (s[s.length - 1] - s[0]) / Math.abs(s[0] || 1));
  return { r, rd, near, trend, change };
}

/** Jaccard score of a picked pair vs the target pair (same rule as ctx.rounds multi). */
export const jaccard = (picked, target) => {
  const p = new Set(picked), t = new Set(target);
  const inter = [...p].filter((x) => t.has(x)).length;
  return inter / (p.size + t.size - inter);
};

export default {
  meta: {
    num: 99,
    slug: 'spurious',
    title: 'Spurious',
    tagline: 'Six real yearly curves, and only one pair has a correlation above r = 0.9. Find it.',
    category: 'literacy',
    data: 'snapshot',
    howTo: [
      'Each question shows 6 curves for 2000-2022, from 6 different countries and 6 different indicators. Each is scaled on its own, with no axis numbers.',
      'Exactly one pair has a correlation r above 0.9; every other pair is below 0.8. The trap: more than one pair climbs in the same direction, so look at whether the ups and downs keep the same rhythm. Tap the two curves you think match, then submit.',
      'Three questions a day, easy to hard. The reveal tells you what each curve really is, whether the pair still correlates once the shared trend is removed, and which decoy pair was most tempting.',
    ],
    scoring: 'Each question is scored by Jaccard overlap: both curves right is 1 point, one right is 1/3, none is 0. Max 3 points; pure guessing averages about 0.7.',
    sources: [{ name: 'World Bank Open Data API', url: 'https://data.worldbank.org/', note: '30 indicators × every country, yearly values for 2000-2022; only complete series with no gaps are kept' }],
    dataNote: 'A snapshot of World Bank open indicators (the data is published yearly, so there is no "today" value to fetch live). An offline script (build/build.mjs) searched 4,000+ real series for each puzzle: the target pair has r between 0.93 and 0.995 and comes from different countries and indicators, every other pair has r < 0.8, and at least two decoys trend the same way as the target. The target pair usually has no causal link at all; they just share a rising or falling trend. The 3 daily questions are ordered easy to hard by how close the best decoy pair is, how many decoys trend alike, and the target r.',
  },

  puzzle({ data, pick }) {
    return { rounds: pick(data.puzzles) };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const nm = (k) => { const [ind, cc] = k.split('|'); return `${data.countries[cc].n} · ${data.ind[ind]}`; };
    const built = [];
    const charts = [];
    for (const idx of p.rounds) {
      const set = data.sets[idx];
      charts.push(await Promise.all(set.s.map((k) => ui.plot((Plot, c) => ({
        height: 90, width: 150, margin: 4,
        marks: [Plot.lineY(data.lib[k], { stroke: c.ink, strokeWidth: 2 })],
      }), { axis: false, width: 150 }))));
      const a = analyse(data, set);
      built.push({ set, ...a });
      ctx.log('round', idx, 'target', set.t.map((i) => LET[i]).join(''), 'r=', a.r.toFixed(3), 'near=', a.near.r.toFixed(2));
    }
    const res = await ctx.rounds({
      title: 'Which two curves correlate at r > 0.9?',
      multi: true,
      minWidth: 150,
      rounds: built.map(({ set, r, rd }, n) => ({
        prompt: `Question ${n + 1} (${['easy', 'medium', 'hard'][n]}): pick the pair with r > 0.9 (choose 2, then submit)`,
        options: set.s.map((k, i) => ({ label: LET[i], body: charts[n][i] })),
        correct: set.t,
        explain: `Answer: ${set.t.map((i) => LET[i]).join(' and ')}, ${nm(set.s[set.t[0]])} and ${nm(set.s[set.t[1]])}, r = ${r.toFixed(2)}. With the trend removed (year-over-year changes), r = ${rd.toFixed(2)}.`,
      })),
    });
    const dir = (t) => (t > 0 ? 'rising' : 'falling');
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, 'Correlation is not causation: any two curves that both climb (or both slide) will show a high r. The "year-over-year r" is the correlation after removing the trend, and it usually collapses to near 0. That is the fingerprint of a spurious correlation.'),
      ...built.map(({ set, r, rd, near, trend }, n) => {
        const [i, j] = set.t;
        const why = Math.abs(rd) < 0.4
          ? `Both curves are ${dir(trend[i])}${Math.sign(trend[i]) === Math.sign(trend[j]) ? '' : ' / ' + dir(trend[j])}, r = ${r.toFixed(2)}. But compare each year\'s ups and downs on their own and r drops to ${rd.toFixed(2)}: the high correlation comes almost entirely from the shared trend, so it is spurious.`
          : `r = ${r.toFixed(2)}, and the year-over-year r is still ${rd.toFixed(2)}: beyond the shared trend, the yearly wiggles also move together (likely coincidence or a common global shock).`;
        return ui.h('div', { class: 'ds-stack' },
          ui.h('div', { class: 'ink2' }, `Question ${n + 1}: ${why} The most tempting decoy was ${LET[near.a]} and ${LET[near.b]} (r = ${near.r.toFixed(2)}, still below the target).`),
          ui.table({
            columns: [{ key: 'k', label: 'Curve' }, { key: 'v', label: 'Country · indicator' }, { key: 't', label: '2000→2022' }],
            rows: set.s.map((k, x) => ({
              k: LET[x] + (set.t.includes(x) ? ' ✓' : ''),
              v: nm(k),
              t: `${ctx.core.fmtCompact(data.lib[k][0])} → ${ctx.core.fmtCompact(data.lib[k][22])}`,
            })),
          }));
      }));
    return res;
  },
};
