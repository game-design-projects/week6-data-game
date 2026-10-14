// #74 Star History — weekly new-star curve of a famous GitHub repo; guess the repo.

/** Hide the repo's own name inside text. */
export function redact(text, full) {
  const [owner, repo] = full.split('/');
  let out = text || '';
  for (const w of [repo, repo.replace(/[-_.]/g, ' '), owner]) {
    if (w && w.length > 2) out = out.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '▇▇▇');
  }
  return out;
}

/** Shape stats of a weekly series: peak week, peak vs median, share of stars in the top 3 weeks. */
export function shape(s) {
  const sorted = [...s].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 1;
  const peak = Math.max(...s);
  const total = s.reduce((a, b) => a + b, 0);
  const top3 = sorted.slice(-3).reduce((a, b) => a + b, 0);
  return { peak, peakIdx: s.indexOf(peak), median, ratio: peak / median, top3Share: top3 / total, total };
}

const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
const bucket = (n) => `${fmt(Math.floor(n / 10000) * 10000)}–${fmt(Math.floor(n / 10000) * 10000 + 10000)}`;

export default {
  meta: {
    num: 74,
    slug: 'star-history',
    title: 'Star History',
    tagline: '一条 GitHub 仓库的每周新增 star 曲线，看形状猜仓库。',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      '图里是某个热门仓库在 2023-02 至 2024-05 之间每周新增的 star 数（纵轴是对数刻度）。',
      '从列表里选仓库来猜，最多 6 次；每猜错一次多解锁一条线索（语言、创建年份、话题、描述、总 star 数）。',
      '猜错时会告诉你：语言是否相同、创建年份相差几年、那段时间的涨星量是你猜的几倍。',
      '提示：尖峰通常是登上 Hacker News 或发布大版本；一路上扬的多是 AI 新项目；平稳长尾是老牌经典项目。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'GH Archive（WatchEvent），经 ClickHouse 公开 playground 的 github_events 表', url: 'https://www.gharchive.org/' },
      { name: 'GitHub REST API（仓库元数据：语言、创建时间、话题、总 star）', url: 'https://docs.github.com/rest/search/search#search-repositories' },
    ],
    dataNote: 'GitHub 已不再公开返回 stargazers 时间戳，因此改用 GH Archive 的 WatchEvent（即点 star 事件）按周汇总。该镜像表在 2024-06 至 2025-08 之间缺数据，故曲线取 2023-02-06 至 2024-05-26 共 68 周。总 star 数为抓取时的快照。',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.repos).id };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const repos = ctx.data.repos;
    const byId = new Map(repos.map((r) => [r.id, r]));
    const ans = byId.get(p.id);
    const st = shape(ans.s);
    ctx.log('answer', ans.id, 'peak', st.peak, 'ratio', st.ratio.toFixed(1));
    const dates = ctx.data.weeks.map((w) => new Date(`${w}T00:00:00Z`));
    const rows = ans.s.map((v, i) => ({ d: dates[i], v: Math.max(v, 1) }));

    const chart = await ui.plot((Plot, c) => ({
      height: 260,
      marginLeft: 44,
      y: { type: 'log', label: '每周新增 star', grid: true, ticks: 4, tickFormat: '~s', domain: [Math.max(1, Math.min(...ans.s) * 0.6), st.peak * 1.3] },
      x: { label: null },
      marks: [Plot.areaY(rows, { x: 'd', y: 'v', y1: 1, fill: c.accent, fillOpacity: 0.18 }), Plot.lineY(rows, { x: 'd', y: 'v', stroke: c.accent, strokeWidth: 2 }), Plot.tip(rows, Plot.pointerX({ x: 'd', y: 'v' }))],
    }));

    const clues = [
      chart,
      `这 68 周里共新增 ${core.fmtNum(ans.total)} 个 star；最高的一周 ${core.fmtNum(st.peak)} 个，是中位周的 ${st.ratio.toFixed(1)} 倍。`,
      `主要语言：${ans.lang || '（无）'}；创建于 ${ans.created.slice(0, 4)} 年。`,
      ans.topics.length ? `GitHub 话题标签：${ans.topics.join('、')}` : '这个仓库没有设置话题标签。',
      `项目描述（名字已涂掉）：${redact(ans.desc, ans.id) || '（无）'}`,
      `如今累计 star 数在 ${bucket(ans.stars)} 之间。`,
    ];

    const res = await ctx.guess({
      options: repos.map((r) => ({ id: r.id, label: r.id, hint: r.lang || '', aliases: [r.id.split('/')[1]] })),
      answer: ans.id,
      maxGuesses: 6,
      title: '这是哪个仓库？',
      placeholder: '输入仓库名，如 react …',
      clues,
      cluesTitle: '曲线和线索',
      columns: ['语言', '创建', '涨星倍数'],
      near: (g, a) => Math.abs(byId.get(g.id).total / byId.get(a.id).total - 1) < 0.35,
      feedback: (g) => {
        const gr = byId.get(g.id);
        if (gr.id === ans.id) return [{ text: ans.lang || '—', state: 'hit' }, { text: ans.created.slice(0, 4), state: 'hit', num: true }, { text: '1×', state: 'hit', num: true }];
        const dy = +gr.created.slice(0, 4) - +ans.created.slice(0, 4);
        const k = gr.total / ans.total;
        return [
          { text: gr.lang || '—', state: gr.lang === ans.lang ? 'hit' : 'miss' },
          { text: `${gr.created.slice(0, 4)} ${dy === 0 ? '=' : dy > 0 ? '↓' : '↑'}`, state: Math.abs(dy) <= 1 ? 'near' : undefined, num: true },
          { text: `${k >= 10 ? k.toFixed(0) : k.toFixed(1)}×`, state: k > 0.7 && k < 1.4 ? 'near' : undefined, num: true },
        ];
      },
    });

    const pattern = st.top3Share > 0.3 ? '少数几周贡献了大部分涨星——典型的 Hacker News / 社交媒体爆发。' : st.ratio < 2.5 ? '曲线非常平稳——老牌项目的长尾增长。' : '涨势起伏适中，有持续关注也有阶段性高峰。';
    res.detail = ui.kv([
      ['答案', `${ans.id}（${ans.lang || '—'}，${ans.created.slice(0, 4)} 年创建）`],
      ['简介', ans.desc || '—'],
      ['最高的一周', `${ctx.data.weeks[st.peakIdx]} 起，+${core.fmtNum(st.peak)} star`],
      ['形状特征', `最高周 / 中位周 = ${st.ratio.toFixed(1)}；前三周占 ${(st.top3Share * 100).toFixed(0)}%。${pattern}`],
      ['累计 star', core.fmtNum(ans.stars)],
    ]);
    return res;
  },
};
