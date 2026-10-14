// #47 Spike — the hottest-rising English Wikipedia article of a day, shown as a nameless pageview curve.
// Each wrong guess reveals another article that spiked the same day.

/** Shape of the surge: how many days of calm before the spike, and the jump factor. */
export function describeSpike(series) {
  const last = series.at(-1);
  const prior = series.slice(0, -1);
  const base = prior.reduce((a, b) => a + b, 0) / prior.length;
  const calm = prior.filter((v) => v < base * 2).length;
  return { last, base: Math.round(base), factor: base > 0 ? last / base : 0, calm, prior: series.at(-2) };
}

export default {
  meta: {
    num: 47,
    slug: 'spike',
    title: 'Spike',
    tagline: '维基百科某一天浏览量暴涨最猛的词条，只给你一条没有名字的曲线。猜错一次，揭示一篇同一天一起暴涨的词条。',
    category: 'words',
    data: 'snapshot',
    howTo: [
      '图里是英文维基百科某个词条最近 21 天的每日浏览量，最后一天是暴涨日（日期已告诉你）。',
      '从列表里选词条来猜，最多 6 次。每猜错一次，揭示一篇同一天也在暴涨的相关词条。',
      '线索是互相关联的：同一天暴涨的往往是同一件事里的人、球队、作品。把它们拼起来，想想那天发生了什么。',
      '曲线的形状也有信息：平静后陡升多半是突发新闻；曲线本来就高，则是持续热点。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'Wikimedia Pageviews API（top / per-article）', url: 'https://wikimedia.org/api/rest_v1/#/Pageviews%20data', note: 'en.wikipedia，all-access，每日榜单前 1000 名；曲线为 user 流量' },
    ],
    dataNote: '快照数据：2026-07-02 至 2026-10-12 之间，每天取前 1000 热门词条中「当天浏览量 ÷ 前三天平均」最高的词条（当天 ≥ 4 万次，剔除首页、搜索页、Deaths in … 和 List of … 等）。前三天不在前 1000 名的词条，按当时榜单第 1000 名的浏览量估计基线，所以倍数是保守估计。',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return { id: p.id };
  },

  async play(ctx, pz) {
    const { ui, core } = ctx;
    const P = ctx.data.puzzles.find((x) => x.id === pz.id);
    const sp = describeSpike(P.series);
    const start = new Date(Date.parse(`${P.date}T00:00:00Z`) - 20 * 86400000);
    const rows = P.series.map((v, i) => ({ date: new Date(start.getTime() + i * 86400000), v }));
    ctx.log('puzzle', P.date, P.title, `x${P.ratio}`);

    const chart = await ui.plot((Plot, c) => ({
      height: 240,
      marginLeft: 52,
      x: { type: 'utc', tickFormat: '%m-%d', label: null },
      y: { type: 'log', domain: [Math.min(...P.series) * 0.6, Math.max(...P.series) * 1.5], grid: true, label: null, ticks: [10, 100, 1e3, 1e4, 1e5, 1e6], tickFormat: (v) => core.fmtCompact(v) },
      marks: [
        Plot.areaY(rows, { x: 'date', y: 'v', y1: Math.min(...P.series) * 0.6, fill: c.accent, fillOpacity: 0.15 }),
        Plot.lineY(rows, { x: 'date', y: 'v', stroke: c.accent, strokeWidth: 2 }),
        Plot.dot(rows.slice(-1), { x: 'date', y: 'v', fill: c.accent, r: 5 }),
        Plot.tip(rows, Plot.pointerX({ x: 'date', y: 'v', title: (d) => `${d.date.toISOString().slice(0, 10)}\n${core.fmtNum(d.v)} 次浏览` })),
      ],
    }));
    const coClue = (c) => `同一天也在暴涨：「${c.t}」（${core.fmtNum(c.v)} 次，约 ${c.r.toFixed(1)} 倍）`;
    const clues = [
      ui.h('div', chart,
        ui.h('div', { class: 'ds-grid', style: { '--min': '110px', marginTop: '12px' } },
          ui.stat({ label: '暴涨日', value: P.date.slice(5), sub: P.date.slice(0, 4) }),
          ui.stat({ label: '当天浏览', value: core.fmtCompact(sp.last), sub: '次' }),
          ui.stat({ label: '此前日均', value: core.fmtCompact(sp.base), sub: '次' }),
          ui.stat({ label: '暴涨倍数', value: `${sp.factor.toFixed(1)}×`, sub: '对数坐标' }))),
      ...P.co.map(coClue),
    ];
    while (clues.length < 6) clues.push(`词条标题以 “${P.title[0]}” 开头。`);

    const coSet = new Map(P.co.map((c) => [c.t, c]));
    const res = await ctx.guess({
      title: '这是哪个词条？',
      options: ctx.data.options.map((t) => ({ id: t, label: t })),
      answer: P.title,
      maxGuesses: 6,
      placeholder: '输入词条名（英文）…',
      clues,
      cluesTitle: `${P.date} 的暴涨线索`,
      columns: ['同日暴涨'],
      near: (g) => coSet.has(g.id),
      feedback: (g) => (g.id === P.title
        ? [{ text: '就是它', state: 'hit' }]
        : coSet.has(g.id) ? [{ text: `是 · ${coSet.get(g.id).r.toFixed(1)}×`, state: 'near', num: true }] : [{ text: '否', state: 'miss' }]),
      onGuess: (opt, { correct }) => ctx.log('guess', opt.id, correct),
    });

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['答案', ui.h('a', { href: `https://en.wikipedia.org/wiki/${encodeURIComponent(P.id)}`, target: '_blank', rel: 'noopener' }, P.title)],
        ['日期', P.date],
        ['当天浏览', `${core.fmtNum(P.views)} 次，约为此前 20 天日均的 ${sp.factor.toFixed(1)} 倍（对比前三天榜单为 ${P.ratio.toFixed(1)} 倍）`],
        ['曲线特征', sp.calm >= 15 ? `此前 ${sp.calm} 天都很平静：典型的突发事件` : '此前就有一定热度：持续的热点'],
      ]),
      ui.h('div', { class: 'ink2' }, '同一天一起暴涨的词条，把它们连起来就是那天的新闻：'),
      ui.table({
        columns: [{ key: 't', label: '词条' }, { key: 'v', label: '浏览', num: true, fmt: (v) => core.fmtNum(v) }, { key: 'r', label: '倍数', num: true, fmt: (v) => `${v.toFixed(1)}×` }],
        rows: P.co,
      }));
    return res;
  },
};
