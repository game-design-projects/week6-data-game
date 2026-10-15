const BANDS = [[2, 6], [1.6, 2.2], [1.35, 1.8], [1.2, 1.45], [1.08, 1.25]];
const MIN_FAILS = 12, MIN_DIFF = 6; // keep every pair clearly separable: no ties, no 3-vs-4 coin flips

// Pure: 5 zip pairs of growing difficulty from one month's rows [zip, fails, inspections].
// Each pair's ratio of rat-failures falls in a band that tightens round by round.
export function buildPairs(rows, rng) {
  const used = new Set();
  const out = [];
  const ok = (a, b) => {
    const hi = Math.max(a[1], b[1]), lo = Math.min(a[1], b[1]);
    return lo >= MIN_FAILS && hi - lo >= MIN_DIFF ? hi / lo : 0;
  };
  for (const [lo, hi] of BANDS) {
    const pool = rng.shuffle(rows.filter((r) => !used.has(r[0])));
    let found = null;
    for (let widen = 0; widen < 5 && !found; widen++) {
      const l = widen === 4 ? 1.03 : 1 + (lo - 1) / (1 + widen * 0.5), h = hi + widen * 0.5;
      for (let i = 0; i < pool.length && !found; i++)
        for (let j = i + 1; j < pool.length; j++) {
          const r = ok(pool[i], pool[j]);
          if (r && r >= l && r <= h) { found = [pool[i], pool[j]]; break; }
        }
    }
    if (!found) break;
    found.forEach((f) => used.add(f[0]));
    out.push(found.map((f) => f[0]));
  }
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (m) => `${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}`;

// Pure: what the round-by-round results teach about this month.
export function lessonStats(pairs, by) {
  let countWins = 0, rateWins = 0, upsets = 0;
  for (const [a, b] of pairs) {
    const x = by.get(a), y = by.get(b);
    const hi = x[1] > y[1] ? x : y, lo = hi === x ? y : x;
    if (hi[2] > lo[2]) countWins++;
    if (hi[1] / hi[2] > lo[1] / lo[2]) rateWins++;
    if (hi[2] < lo[2]) upsets++;
  }
  return { countWins, rateWins, upsets, n: pairs.length };
}

export default {
  meta: {
    num: 19,
    slug: 'rat-race',
    title: 'Rat Race',
    tagline: 'Two New York ZIP codes: which one failed more rat inspections this month?',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      'Each day picks a month (2018 to now). Every round shows two NYC ZIP codes and the total number of health-department inspections each had that month.',
      'Pick the one with more inspections that \u201cfailed for rat activity\u201d. There are 5 rounds, and the gap between the two narrows as you go.',
      'More inspections does not mean more rats; a ZIP may just be checked more often. After each round you see the fail count and the fail rate.',
    ],
    scoring: '1 point per correct round, 5 at most. Pure guessing averages about 2.5; reading inspection counts and neighborhood patterns reliably gets 4 or more.',
    sources: [
      { name: 'NYC Open Data \u00b7 Rodent Inspection (DOHMH)', url: 'https://data.cityofnewyork.us/Health/Rodent-Inspection/p937-wjvj', note: 'counts inspections whose result is \u201cFailed for Rat Activity\u201d (including \u201cand other reasons\u201d); the denominator is conclusive Passed / Failed inspections' },
    ],
    dataNote: 'Data are pre-aggregated by ZIP code and month (a snapshot; build/ regenerates it). Only ZIPs with at least 60 conclusive inspections that month are kept, and a month needs at least 30 such ZIPs to be used; every pair has at least 12 fails each and differs by at least 6. Months in the 2020 pandemic and early 2021 with very low inspection volume, and recent months that are still incomplete, are skipped. The dataset updates daily, but monthly counts only settle after the month ends, so there is no live fetch.',
  },

  puzzle({ data, pick, rng }) {
    const month = pick(Object.keys(data.months).sort());
    const rows = data.months[month];
    return { month, pairs: buildPairs(rows, rng) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const by = new Map(ctx.data.months[p.month].map((r) => [r[0], r]));
    const boro = ctx.data.boros;
    const flip = p.pairs.map(() => ctx.rng.chance(0.5));
    const fmt = ctx.core.fmtNum;
    const when = monthLabel(p.month);
    const rate = (r) => ((r[1] / r[2]) * 100).toFixed(0);
    const rounds = p.pairs.map(([a, b], i) => {
      const pr = flip[i] ? [b, a] : [a, b];
      const [x, y] = pr.map((z) => by.get(z));
      const win = x[1] > y[1] ? 0 : 1;
      return {
        prompt: `Round ${i + 1} \u00b7 ${when}: which ZIP failed more?`,
        options: pr.map((z) => ({ label: z, sub: `${boro[z]} \u00b7 ${fmt(by.get(z)[2])} inspections` })),
        correct: win,
        explain: `${x[0]}: ${fmt(x[1])} failed (${rate(x)}%); ${y[0]}: ${fmt(y[1])} failed (${rate(y)}%)`,
      };
    });
    ctx.log('rat-race rounds', p.month, p.pairs);
    ctx.stage.append(ui.panel({ kicker: when, title: 'Failed rat inspections' }, ui.h('p', { class: 'ink2' }, 'New York\u2019s health department inspects properties for rats; signs of rats mean a fail. You compare the number of fails that month, not the rate.')));
    const res = await ctx.rounds({ rounds, minWidth: 150 });
    const rows = [...by.values()];
    const top = rows.slice().sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topRate = rows.filter((r) => r[2] >= 150).sort((a, b) => b[1] / b[2] - a[1] / a[2])[0];
    const L = lessonStats(p.pairs, by);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `Of the ${L.n} pairs, the side with more fails also had more inspections in ${L.countWins}, was out-inspected yet came out on top in ${L.upsets}, and had the higher fail rate in ${L.rateWins}. ${L.countWins >= L.n - 1 ? 'Inspection counts nearly gave the answer: the more a ZIP is checked, the more fails it racks up.' : 'This month inspection counts would have fooled you; you needed neighborhood and fail rate too.'}`),
      ui.h('div', { class: 'ink2' }, `ZIP codes with the most fails in ${when}:`),
      ui.table({
        columns: [{ key: 'z', label: 'ZIP' }, { key: 'b', label: 'Borough' }, { key: 'f', label: 'Fails', num: true }, { key: 'r', label: 'Fail rate', num: true }],
        rows: top.map((r) => ({ z: r[0], b: boro[r[0]], f: fmt(r[1]), r: rate(r) + '%' })),
      }),
      ui.h('div', { class: 'small muted' }, `The highest fail rate was ${topRate[0]} (${boro[topRate[0]]}, ${rate(topRate)}%, ${fmt(topRate[2])} inspections): the rate is the better gauge of rat trouble, while the count mostly reflects how often a ZIP gets checked.`));
    return res;
  },
};
