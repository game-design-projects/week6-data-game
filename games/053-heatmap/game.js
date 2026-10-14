// #53 Heatmap — a series' per-episode IMDb ratings as a season x episode heatmap; name the show.

/** Colour bucket for a rating (also used by tests). */
export function bucket(r) { return r >= 9 ? 4 : r >= 8.5 ? 3 : r >= 8 ? 2 : r >= 7 ? 1 : 0; }

/** Replace words of the show title inside an episode title. */
export function redactTitle(text, show) {
  const words = show.title.split(/[\s:,'’-]+/).filter((w) => w.length > 3 && !/^(the|and|with)$/i.test(w));
  let out = text;
  for (const w of words) out = out.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '▇▇▇');
  return out;
}

export default {
  meta: {
    num: 53,
    slug: 'heatmap',
    title: 'Heatmap',
    tagline: '一部剧每一集的 IMDb 评分，排成「季 × 集」热力图。看高低起伏，猜剧名。',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      '热力图每一行是一季，每一格是一集，颜色越亮评分越高，灰格是评分人数太少的集。',
      '从列表里选剧名来猜，最多 6 次。每猜错一次解锁一条新线索：类型、年代、集数、最高和最低分的集名……',
      '看形状：一路下滑说明口碑崩塌，末季飙红多半是大结局，每季结尾都很亮说明爱做季终集大事件。',
      '第 1 次猜中 100 分，之后每多一次少约 17 分。',
    ],
    scoring: '第 n 次猜中得 100·(7−n)/6 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'IMDb Non-Commercial Datasets', url: 'https://developer.imdb.com/non-commercial-datasets/', note: 'title.basics / title.episode / title.ratings' },
    ],
    dataNote: '数据来自 IMDb 公开数据集的快照，仅收录评分人数很多、至少 2 季、至少 20 集有评分的 120 部热门剧。评分会随时间微调。',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.shows).id };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const shows = ctx.data.shows;
    const ans = shows.find((s) => s.id === p.id);
    ctx.log('answer', ans.title, ans.eps.length);

    const cells = ans.eps.map(([s, e, r, t]) => ({ s, e, r, t, k: bucket(r) }));
    const labels = ['< 7', '7–8', '8–8.5', '8.5–9', '≥ 9'];
    const heat = await ui.plot((Plot, c) => ({
      height: Math.min(360, 40 + new Set(cells.map((x) => x.s)).size * 26),
      marginLeft: 40,
      padding: 0.1,
      x: { label: null, ticks: [1, 5, 10, 15, 20, 25], tickSize: 0 },
      y: { label: null, tickFormat: (s) => `S${s}`, tickSize: 0 },
      color: { domain: [0, 1, 2, 3, 4], range: [c.bad, c.miss, c.near, c.hit, c.accent], legend: false },
      marks: [
        Plot.cell(cells, { x: 'e', y: 's', fill: 'k', rx: 2, title: (x) => `S${x.s}E${x.e} · ${x.r}` }),
        Plot.text(cells, { x: 'e', y: 's', text: (x) => x.r.toFixed(1), fontSize: 8, fill: c.ink, fillOpacity: 0.7 }),
      ],
    }));
    const legend = ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '10px', marginTop: '6px', flexWrap: 'wrap' } },
      ...['--bad', '--miss', '--near', '--hit', '--accent'].map((v, i) => ui.h('span', ui.h('span', { style: { color: `var(${v})` } }, '■'), ' ' + labels[i])));

    const seasons = new Set(cells.map((x) => x.s)).size;
    const best = cells.reduce((a, b) => (b.r > a.r ? b : a));
    const worst = cells.reduce((a, b) => (b.r < a.r ? b : a));
    const first = cells.filter((x) => x.s === cells[0].s), last = cells.filter((x) => x.s === cells[cells.length - 1].s);
    const avg = (xs) => xs.reduce((a, x) => a + x.r, 0) / xs.length;
    const decade = Math.floor(ans.start / 10) * 10;
    const clues = [
      ui.h('div', heat, legend),
      `${seasons} 季，共 ${cells.length} 集有评分。第一季均分 ${avg(first).toFixed(1)}，最后一季均分 ${avg(last).toFixed(1)}。`,
      `类型：${ans.genres.join(' / ')}。首播于 ${decade} 年代。${ans.end ? '已完结。' : '仍未标记完结。'}`,
      `评分最高的一集 ${best.r}（S${best.s}E${best.e}）：“${redactTitle(best.t, ans)}”`,
      `评分最低的一集 ${worst.r}（S${worst.s}E${worst.e}）：“${redactTitle(worst.t, ans)}”`,
      `剧名以 “${ans.title[0]}” 开头，共 ${ans.title.length} 个字符。`,
    ];

    const res = await ctx.guess({
      options: shows.map((s) => ({ id: s.id, label: s.title, hint: String(s.start) })),
      answer: ans.id,
      maxGuesses: 6,
      title: '这是哪部剧？',
      placeholder: '输入剧名…',
      clues,
      cluesTitle: '热力图和线索',
      columns: ['首播', '总分'],
      near: (g, a) => Math.abs(g.start - a.start) <= 2,
      feedback: (g, a) => {
        const gs = shows.find((s) => s.id === g.id), as = shows.find((s) => s.id === a.id);
        const yr = gs.start === as.start ? 'hit' : Math.abs(gs.start - as.start) <= 3 ? 'near' : undefined;
        const rt = Math.abs(gs.rating - as.rating) < 0.2 ? 'hit' : Math.abs(gs.rating - as.rating) < 0.5 ? 'near' : undefined;
        return [
          { text: `${gs.start} ${gs.start < as.start ? '↑' : gs.start > as.start ? '↓' : ''}`, state: yr, num: true },
          { text: `${gs.rating} ${gs.rating < as.rating ? '↑' : gs.rating > as.rating ? '↓' : ''}`, state: rt, num: true },
        ];
      },
    });
    ctx.log('result', res.score);

    const trend = avg(last) - avg(first);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['答案', `${ans.title}（${ans.start}${ans.end ? '–' + ans.end : '–'}）`],
        ['IMDb 总评分', `${ans.rating} · ${core.fmtCompact(ans.votes)} 人评分`],
        ['最高一集', `S${best.s}E${best.e} “${best.t}” ${best.r}`],
        ['最低一集', `S${worst.s}E${worst.e} “${worst.t}” ${worst.r}`],
        ['走势', trend < -0.5 ? `口碑下滑：首季 ${avg(first).toFixed(1)} → 末季 ${avg(last).toFixed(1)}` : trend > 0.3 ? `越拍越好：首季 ${avg(first).toFixed(1)} → 末季 ${avg(last).toFixed(1)}` : `全程稳定：首季 ${avg(first).toFixed(1)} → 末季 ${avg(last).toFixed(1)}`],
      ]));
    return res;
  },
};
