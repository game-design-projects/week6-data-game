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
    tagline: '六条真实的年度曲线，只有一对相关系数 r > 0.9。把它们找出来。',
    category: 'literacy',
    data: 'snapshot',
    howTo: [
      '每题给出 6 条 2000–2022 年的曲线，来自 6 个不同国家、6 个不同指标，纵轴各自缩放、不标数字。',
      '其中恰好有一对的相关系数 r 超过 0.9，其余任意两条的 r 都小于 0.8。陷阱：不止一对曲线在“同向爬升”，要看起伏的节奏是否一致。点选你认为的那一对，选满 2 条后提交。',
      '一天三题，由易到难。揭晓时会告诉你每条曲线到底是什么、去掉共同趋势后它们还相关吗，以及最容易被误选的那一对。',
    ],
    scoring: '每题按 Jaccard 重合度给分：选对两条得 1 分，对一条得 1/3 分，全错 0 分。满分 3 分；纯靠猜平均只有约 0.7 分。',
    sources: [{ name: 'World Bank Open Data API', url: 'https://data.worldbank.org/', note: '30 个指标 × 各国 2000–2022 年度值，仅保留完整无缺失的序列' }],
    dataNote: '数据为世界银行公开指标的快照（该数据集按年发布，没有“今天”的数据，故不做实时抓取）。题目由离线脚本（build/build.mjs）从 4000 多条真实序列中搜索得到：目标对 r 在 0.93–0.995 且来自不同国家与指标，其余曲线两两 r < 0.8，并保证至少两条干扰曲线与目标同向变化。目标对之间通常毫无因果，只是共享上升或下降趋势。每天 3 题按难度（最像目标的干扰对、同向干扰数、目标 r）由易到难排列。',
  },

  puzzle({ data, pick }) {
    return { rounds: pick(data.puzzles) };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const nm = (k) => { const [ind, cc] = k.split('|'); return `${data.countries[cc].z} · ${data.ind[ind]}`; };
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
      title: '哪两条相关系数 r > 0.9？',
      multi: true,
      minWidth: 150,
      rounds: built.map(({ set, r, rd }, n) => ({
        prompt: `第 ${n + 1} 题（${['易', '中', '难'][n]}）：选出 r > 0.9 的那一对（选 2 条后提交）`,
        options: set.s.map((k, i) => ({ label: LET[i], body: charts[n][i] })),
        correct: set.t,
        explain: `答案 ${set.t.map((i) => LET[i]).join(' 和 ')}：${nm(set.s[set.t[0]])} 与 ${nm(set.s[set.t[1]])}，r = ${r.toFixed(2)}。去掉趋势（逐年变化量）后 r = ${rd.toFixed(2)}。`,
      })),
    });
    const dir = (t) => (t > 0 ? '上升' : '下降');
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, '相关不等于因果：两条曲线只要都在爬升（或都在下滑），r 就会很高。“逐年变化 r”是去掉趋势后的相关，通常骤降到接近 0——这就是伪相关的指纹。'),
      ...built.map(({ set, r, rd, near, trend }, n) => {
        const [i, j] = set.t;
        const why = Math.abs(rd) < 0.4
          ? `两条曲线都在${dir(trend[i])}${Math.sign(trend[i]) === Math.sign(trend[j]) ? '' : '/' + dir(trend[j])}，r = ${r.toFixed(2)}；但把每年的涨跌单独拿出来比，r 只剩 ${rd.toFixed(2)}，说明高相关几乎全来自共同趋势，是伪相关。`
          : `r = ${r.toFixed(2)}，逐年变化 r 仍有 ${rd.toFixed(2)}：除了共同趋势，连年度起伏也有些同步（多半是巧合或共同的全球冲击）。`;
        return ui.h('div', { class: 'ds-stack' },
          ui.h('div', { class: 'ink2' }, `第 ${n + 1} 题：${why} 最容易误选的是 ${LET[near.a]} 与 ${LET[near.b]}（r = ${near.r.toFixed(2)}，仍低于目标）。`),
          ui.table({
            columns: [{ key: 'k', label: '曲线' }, { key: 'v', label: '国家 · 指标' }, { key: 't', label: '2000→2022' }],
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
