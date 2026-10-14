// #79 Front Page — guess the Hacker News score of four stories from one day.
export default {
  meta: {
    num: 79, slug: 'front-page', title: 'Front Page',
    tagline: '一天里四条 Hacker News 帖子，只看标题、域名和评论数，猜它们各拿了多少分。',
    category: 'tech', data: 'snapshot',
    howTo: [
      '每天抽一天的 HN 帖子（至少 15 分以上），按分数分布挑出 4 条：爆款、热门、中等、普通。',
      '对每条帖子拖动对数刻度滑块，猜它最终的点赞分数。',
      '线索：评论数通常是分数的 0.3~1 倍；Show HN 和小众域名偏低，大公司新闻、安全事件和 AI 偏高。',
    ],
    scoring: '每条按对数误差计分：差 2 倍约 37 分，猜对约 100 分；四条取平均。',
    sources: [{ name: 'Hacker News Search API (Algolia)', url: 'https://hn.algolia.com/api' }],
    dataNote: '快照：构建时从 Algolia HN API 抓取最近 80 个 UTC 日里 ≥15 分的帖子，每天挑 4 条；分数为抓取时的最终值。',
  },

  puzzle({ data, pick }) {
    const d = pick(data.days);
    return { date: d.date, stories: d.stories };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    ctx.log('day', p.date);
    const rs = [];
    for (const [i, s] of p.stories.entries()) {
      const box = ui.h('div');
      ctx.stage.append(box);
      box.append(ui.panel({ kicker: `第 ${i + 1} / ${p.stories.length} 条 · ${p.date}`, title: s.title },
        ui.row(ui.badge(s.domain || '文字帖（无外链）'), ui.badge(`${s.comments} 条评论`, 'accent'), ui.badge(`UTC ${s.hour}:00 发布`))));
      const r = await ctx.estimate({
        container: box, answer: s.points, min: 10, max: 3000, log: true, initial: 100, step: 1,
        unit: '分', format: (v) => core.fmtNum(Math.round(v)), scoring: 'log', scale: 0.3,
        title: '它拿了多少分？',
      });
      ctx.log('story', s.id, s.points, r.guess);
      rs.push(r);
    }
    const res = ctx.combine(rs);
    res.detail = ui.table({
      columns: [{ key: 'title', label: '帖子' }, { key: 'points', label: '分数', num: true }, { key: 'comments', label: '评论', num: true }, { key: 'ratio', label: '评论/分', num: true }, { key: 'guess', label: '你的猜测', num: true }],
      rows: p.stories.map((s, i) => ({ ...s, ratio: (s.comments / s.points).toFixed(2), guess: core.fmtNum(Math.round(rs[i].guess)) })),
    });
    return res;
  },
};
