// #74 Star History — weekly new-star curve of a famous GitHub repo; guess the repo.

const norm = (t) => (t || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Normalised forms of the repo name and the owner (also without a trailing "js") that must never be visible. */
export function nameKeys(full) {
  const [owner, repo] = full.split('/');
  const keys = new Set();
  for (const w of [repo, owner]) {
    const n = norm(w);
    for (const v of [n, n.replace(/js$/, '')]) if (v.length >= 3) keys.add(v);
  }
  return [...keys];
}

/** Hide the repo's own name / owner inside text — also across spaces ("web UI"), and inside longer words. */
export function redact(text, full) {
  const src = text || '';
  const keys = nameKeys(full);
  const words = [...src.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ s: m.index, e: m.index + m[0].length, n: norm(m[0]) }));
  let out = '';
  let pos = 0;
  for (let i = 0; i < words.length;) {
    if (words[i].s < pos) { i++; continue; }
    let hit = -1;
    let joined = '';
    for (let j = i; j < Math.min(words.length, i + 6) && hit < 0; j++) {
      joined += words[j].n;
      if (keys.includes(joined)) hit = j;
    }
    if (hit < 0 && keys.some((k) => k.length >= 4 && words[i].n.includes(k))) hit = i;
    if (hit < 0) { i++; continue; }
    out += src.slice(pos, words[i].s) + '▇▇▇';
    pos = words[hit].e;
    i = hit + 1;
  }
  return out + src.slice(pos);
}

/** Does this topic tag give the repo away? */
export function topicLeaks(topic, full) {
  const n = norm(topic);
  return nameKeys(full).some((k) => n === k || (k.length >= 4 && n.includes(k)));
}

/** Shape stats of a weekly series: peak week, peak vs median, share of stars in the top 3 weeks, early-vs-late trend. */
export function shape(s) {
  const sorted = [...s].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 1;
  const peak = Math.max(...s);
  const total = s.reduce((a, b) => a + b, 0);
  const top3 = sorted.slice(-3).reduce((a, b) => a + b, 0);
  const q = Math.max(1, Math.floor(s.length / 4));
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const trend = avg(s.slice(-q)) / Math.max(1, avg(s.slice(0, q)));
  return { peak, peakIdx: s.indexOf(peak), median, ratio: peak / median, top3Share: top3 / total, total, trend };
}

/** Log-axis ticks at 1-2-5 steps. */
export function logTicks(lo, hi) {
  const t = [];
  for (let p = Math.pow(10, Math.floor(Math.log10(Math.max(lo, 1)))); p <= hi; p *= 10) for (const m of [1, 2, 5]) if (p * m >= lo && p * m <= hi) t.push(p * m);
  return t;
}

/** Explanation of which pattern in the series identifies the repo. */
export function pattern(st) {
  const bits = [];
  if (st.top3Share > 0.3) bits.push('少数几周贡献了大部分涨星——典型的 Hacker News / 社交媒体爆发');
  else if (st.ratio < 2.5) bits.push('曲线非常平稳——老牌项目的长尾增长');
  else bits.push('涨势起伏适中，有持续关注也有阶段性高峰');
  if (st.trend > 1.5) bits.push(`后四分之一时段的周均涨星是前四分之一的 ${st.trend.toFixed(1)} 倍，仍在升温`);
  else if (st.trend < 0.5) bits.push(`后四分之一时段的周均涨星只有前四分之一的 ${(st.trend * 100).toFixed(0)}%，热度在消退`);
  else bits.push('前后热度大致持平');
  return bits.join('；') + '。';
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
      '图里是某个热门仓库在 2023-02 至 2024-05 共 68 周里每周新增的 star 数（纵轴是对数刻度），解锁线索 2 后还能看到累计曲线。',
      '从列表里选仓库来猜，最多 6 次；每猜错一次多解锁一条线索（累计曲线、语言与创建年份、话题、描述、总 star 数）。',
      '猜错时会告诉你：语言是否相同、创建年份比答案早（↑）还是晚（↓），以及你猜的仓库在这 68 周的涨星量是答案的几倍。',
      '提示：尖峰通常是登上 Hacker News 或发布大版本；一路上扬的多是 AI 新项目；平稳长尾是老牌经典项目。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'GH Archive（WatchEvent），经 ClickHouse 公开 playground 的 github_events 表', url: 'https://www.gharchive.org/' },
      { name: 'GitHub REST API（仓库元数据：语言、创建时间、话题、总 star）', url: 'https://docs.github.com/rest/search/search#search-repositories' },
    ],
    dataNote: 'GitHub 的 stargazers 接口（REST 与 GraphQL）已对该账号返回 404 / totalCount 0，拿不到逐个 star 的时间戳，无法还原从创建起的完整增长曲线，因此改用 GH Archive 的 WatchEvent（即点 star 事件）按周汇总。该镜像表在 2024-06 至 2025-08 之间缺数据，故曲线取 2023-02-06 至 2024-05-26 共 68 周。该镜像 2025-09 之后虽有数据，但每周事件总量从 80 万逐步降到 10 万以下，疑似不完整，不予采用；创建时间早于窗口的仓库，累计曲线从窗口起点（0）算起。总 star 数、语言、话题为 2026-10 抓取的快照。未做实时加载：GitHub 无密钥接口限流 60 次/小时且无 stargazers 时间戳，ClickHouse 镜像滞后且不完整。',
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

    const lo = Math.max(1, Math.min(...ans.s) * 0.6);
    const hi = st.peak * 1.3;
    const chart = await ui.plot((Plot, c) => ({
      height: 260,
      marginLeft: 48,
      y: { type: 'log', label: '每周新增 star', grid: true, ticks: logTicks(lo, hi), tickFormat: '~s', domain: [lo, hi] },
      x: { label: null },
      marks: [Plot.areaY(rows, { x: 'd', y: 'v', y1: lo, fill: c.accent, fillOpacity: 0.18 }), Plot.lineY(rows, { x: 'd', y: 'v', stroke: c.accent, strokeWidth: 2 }), Plot.tip(rows, Plot.pointerX({ x: 'd', y: 'v' }))],
    }));
    let run = 0;
    const cum = ans.s.map((v, i) => ({ d: dates[i], v: (run += v) }));
    const cumChart = await ui.plot((Plot, c) => ({
      height: 170,
      marginLeft: 48,
      y: { label: '窗口内累计新增 star', grid: true, tickFormat: '~s', domain: [0, ans.total] },
      x: { label: null },
      marks: [Plot.areaY(cum, { x: 'd', y: 'v', fill: c.accent, fillOpacity: 0.18 }), Plot.lineY(cum, { x: 'd', y: 'v', stroke: c.accent, strokeWidth: 2 }), Plot.tip(cum, Plot.pointerX({ x: 'd', y: 'v' }))],
    }));

    const topics = ans.topics.filter((t) => !topicLeaks(t, ans.id));
    const clues = [
      chart,
      ui.stack(`这 ${ans.s.length} 周里共新增 ${core.fmtNum(ans.total)} 个 star；最高的一周 ${core.fmtNum(st.peak)} 个，是中位周的 ${st.ratio.toFixed(1)} 倍。下图是同一段时间的累计曲线：`, cumChart),
      `主要语言：${ans.lang || '（无）'}；创建于 ${ans.created.slice(0, 4)} 年。`,
      topics.length ? `GitHub 话题标签（与名字相同的已隐藏）：${topics.join('、')}` : '这个仓库没有可公开的话题标签。',
      `项目描述（名字已涂掉）：${redact(ans.desc, ans.id) || '（无）'}`,
      `如今累计 star 数在 ${bucket(ans.stars)} 之间。`,
    ];

    const res = await ctx.guess({
      options: repos.map((r) => ({ id: r.id, label: r.id, hint: r.lang || '', aliases: [r.id.split('/')[1]] })),
      answer: ans.id,
      maxGuesses: 6,
      title: '这是哪个仓库？',
      placeholder: '输入仓库名或 owner/repo …',
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

    res.detail = ui.kv([
      ['答案', `${ans.id}（${ans.lang || '—'}，${ans.created.slice(0, 4)} 年创建）`],
      ['简介', ans.desc || '—'],
      ['最高的一周', `${ctx.data.weeks[st.peakIdx]} 起，+${core.fmtNum(st.peak)} star（中位周 ${core.fmtNum(st.median)}）`],
      ['曲线形状', `最高周 / 中位周 = ${st.ratio.toFixed(1)}；前三周占 ${(st.top3Share * 100).toFixed(0)}%。${pattern(st)}`],
      ['累计 star', `${core.fmtNum(ans.stars)}（其中这 ${ans.s.length} 周新增 ${core.fmtNum(ans.total)}）`],
    ]);
    return res;
  },
};
