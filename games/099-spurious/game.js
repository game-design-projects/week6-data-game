// #99 Spurious — six real yearly series from different countries; find the one pair with r > 0.9.
export const corr = (a, b) => {
  const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let s = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { s += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; }
  return s / Math.sqrt(sa * sb);
};
export const diffs = (a) => a.slice(1).map((x, i) => x - a[i]);
const LET = 'ABCDEF';
const zh = (c2) => { try { return new Intl.DisplayNames(['zh-Hans'], { type: 'region' }).of(c2); } catch { return c2; } };

export default {
  meta: {
    num: 99,
    slug: 'spurious',
    title: 'Spurious',
    tagline: '六条真实的年度曲线，只有一对相关系数 r > 0.9。把它们找出来。',
    category: 'literacy',
    data: 'snapshot',
    howTo: [
      '每题给出 6 条 2000-2022 年的曲线，来自不同国家、不同指标，纵轴各自缩放、不标数字。',
      '其中恰好有一对的相关系数 r 超过 0.9，其余任意两条 |r| 都小于 0.7（约）。点选你认为的那一对。',
      '一天三题。揭晓时会告诉你每条曲线到底是什么，以及去掉共同趋势后它们还相关吗。',
    ],
    scoring: '每题按 Jaccard 重合度给分：选对两条得满分，对一条得 1/3，全错 0。满分 3 分。',
    sources: [{ name: 'World Bank Open Data API', url: 'https://data.worldbank.org/', note: '30 个指标 × 各国 2000-2022 年度值，仅保留完整无缺失的序列' }],
    dataNote: '题目由离线脚本从真实序列中搜索得到：目标对 r 在 0.90–0.995，且来自不同国家和指标；其他曲线两两 |r| < 0.7。目标对之间通常毫无因果，只是共享上升或下降趋势。',
  },

  puzzle({ data, pick }) {
    const n = data.sets.length, i = data.sets.indexOf(pick(data.sets));
    const rounds = [i, (i + Math.floor(n / 3)) % n, (i + Math.floor((2 * n) / 3)) % n];
    return { rounds };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const name = (k) => { const [ind, cc] = k.split('|'); const c = data.countries[cc]; return `${zh(c.c2)} · ${data.ind[ind]}`; };
    const built = [];
    const charts = [];
    for (const idx of p.rounds) {
      const set = data.sets[idx];
      const body = await Promise.all(set.s.map((k) => ui.plot((Plot, c) => ({
        height: 90, width: 150, margin: 4,
        marks: [Plot.lineY(data.lib[k], { stroke: c.accent, strokeWidth: 2 })],
      }), { axis: false, width: 150 })));
      charts.push(body);
      const r = corr(data.lib[set.s[set.t[0]]], data.lib[set.s[set.t[1]]]);
      const rd = corr(diffs(data.lib[set.s[set.t[0]]]), diffs(data.lib[set.s[set.t[1]]]));
      built.push({ set, r, rd });
      ctx.log('round', idx, 'target', set.t.map((i) => LET[i]).join(''), 'r=', r.toFixed(3));
    }
    const res = await ctx.rounds({
      title: '哪两条相关系数 r > 0.9？',
      multi: true,
      minWidth: 150,
      rounds: built.map(({ set, r, rd }, n) => ({
        prompt: `第 ${n + 1} 题：选出 r > 0.9 的那一对（选 2 条后确认）`,
        options: set.s.map((k, i) => ({ label: LET[i], body: charts[n][i] })),
        correct: set.t,
        explain: `答案 ${set.t.map((i) => LET[i]).join(' 和 ')}：${name(set.s[set.t[0]])} 与 ${name(set.s[set.t[1]])}，r = ${r.toFixed(2)}。去掉趋势（逐年变化量）后 r = ${rd.toFixed(2)}。`,
      })),
    });
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, '相关不等于因果：两条曲线只要都在爬升（或都在下滑），r 就会很高。下表的“逐年变化 r”是去掉趋势后的相关，通常骤降到接近 0——这就是伪相关的指纹。'),
      ...built.map(({ set, r, rd }, n) => ui.table({
        columns: [{ key: 'k', label: `第 ${n + 1} 题` }, { key: 'v', label: '曲线' }],
        rows: [
          { k: LET[set.t[0]], v: name(set.s[set.t[0]]) },
          { k: LET[set.t[1]], v: name(set.s[set.t[1]]) },
          { k: 'r', v: `${r.toFixed(2)}（逐年变化 r = ${rd.toFixed(2)}）` },
        ],
      })));
    return res;
  },
};
