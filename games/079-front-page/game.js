// #79 Front Page — guess the Hacker News score of four stories from one day (live: 2 UTC days ago).
const QUANTILES = [0, 0.04, 0.2, 0.55]; // top hit, hot, middle, ordinary
const MEDIAN_RATIO = 0.53; // median comments/points over the pool of picked stories
const MIN_HITS = 12;
const API = 'https://hn.algolia.com/api/v1/search';

// Algolia search response for ONE UTC day (points >= 15) -> puzzle day. Pure, shared with build/build.mjs.
export function toDay(raw, date) {
  const hits = (raw?.hits ?? [])
    .filter((h) => h && typeof h.title === 'string' && h.title.trim().length >= 4 && Number.isFinite(h.points) && h.points >= 15)
    .map((h) => ({ ...h, title: h.title.replace(/\s+/g, ' ').trim() }))
    .sort((a, b) => b.points - a.points || Number(a.objectID) - Number(b.objectID));
  const n = hits.length;
  if (n < MIN_HITS) return null;
  const idx = [...new Set(QUANTILES.map((q) => Math.min(n - 1, Math.round(q * n))))];
  if (idx.length !== QUANTILES.length) return null;
  const sorted = hits.map((h) => h.points);
  const median = sorted[n >> 1];
  const stories = idx.map((i) => {
    const h = hits[i];
    let domain = null;
    try { domain = h.url ? new URL(h.url).hostname.replace(/^www\./, '') : null; } catch { domain = null; }
    return {
      id: Number(h.objectID), title: h.title, domain,
      points: h.points, comments: h.num_comments || 0,
      hour: new Date(h.created_at_i * 1000).getUTCHours(),
      rank: i + 1,
    };
  });
  return { date, n, median, stories };
}

export function apiUrl(date) {
  const t0 = Date.parse(`${date}T00:00:00Z`) / 1000;
  const q = encodeURIComponent(`created_at_i>=${t0},created_at_i<${t0 + 86400},points>=15`);
  return `${API}?tags=story&numericFilters=${q}&hitsPerPage=1000&attributesToRetrieve=title,url,points,num_comments,created_at_i,objectID&attributesToHighlight=`;
}

export default {
  meta: {
    num: 79, slug: 'front-page', title: 'Front Page',
    tagline: '一天里四条 Hacker News 帖子，只看标题、域名和评论数，猜它们各拿了多少分。',
    category: 'tech', data: 'live',
    howTo: [
      '每天取 HN 两个 UTC 日之前的那一天（此时分数已基本定型），在 ≥15 分的帖子里按排名挑 4 条：当日榜首、热门、中等、普通，顺序随机。',
      '对每条帖子拖动对数刻度滑块（或直接输入），猜它最终的点赞分数。',
      '线索：评论数大约是分数的 0.3~0.8 倍（中位数 0.5）；评论远多于此是争议帖，远少于此多半是小众链接或 Show HN。顶部会告诉你当天有多少条帖子过了 15 分、中位数是多少。',
    ],
    scoring: '每条按对数误差计分：差 2 倍约 37 分，猜对 100 分；四条相加，满分 400。',
    sources: [
      { name: 'Hacker News Search API (Algolia)', url: 'https://hn.algolia.com/api', note: '实时请求，带 CORS，无需密钥' },
      { name: 'Hacker News', url: 'https://news.ycombinator.com/' },
    ],
    dataNote: '实时：打开页面时向 Algolia HN 搜索 API 请求两个 UTC 日之前（即 24 小时以上、分数已基本不再变化）的全部 ≥15 分帖子，再按排名挑 4 条，所以所有玩家看到同一道题。请求失败时回退到构建时抓取的 120 天快照（build/fetch.mjs）。',
  },

  async load(ctx) {
    const date = ctx.core.addDays(ctx.date, -2);
    const raw = await ctx.fetchJSON(apiUrl(date), { timeout: 9000 });
    const live = toDay(raw, date);
    ctx.log('live day', date, live ? `${live.n} hits` : 'too few hits');
    return live ? { ...ctx.data, live } : null;
  },

  puzzle({ data, pick, rng }) {
    const d = data.live ?? pick(data.days);
    return { date: d.date, n: d.n, median: d.median, stories: rng.shuffle([...d.stories]) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    ctx.log('day', p.date, 'n', p.n);
    const max = Math.max(3000, Math.ceil((Math.max(...p.stories.map((s) => s.points)) * 1.5) / 500) * 500);
    ctx.stage.append(ui.callout(`HN ${p.date}（UTC）· 当天共 ${p.n} 条帖子拿到 ≥15 分，中位数 ${p.median} 分。下面 4 条来自这一天，顺序已打乱。`));
    const rs = [];
    for (const [i, s] of p.stories.entries()) {
      const box = ui.h('div');
      ctx.stage.append(box);
      box.append(ui.panel({ kicker: `第 ${i + 1} / ${p.stories.length} 条`, title: s.title },
        ui.row(ui.badge(s.domain || '文字帖（无外链）'), ui.badge(`${core.fmtNum(s.comments)} 条评论`, 'accent'), ui.badge(`UTC ${s.hour}:00 发布`))));
      const r = await ctx.estimate({
        container: box, answer: s.points, min: 10, max, log: true, initial: Math.min(p.median * 2, max), step: 1,
        unit: '分', format: (v) => core.fmtNum(Math.round(v)), scoring: 'log', scale: 0.3,
        title: '它拿了多少分？',
      });
      ctx.log('story', s.id, s.points, r.guess);
      rs.push(r);
    }
    const res = ctx.combine(rs);
    const rows = p.stories.map((s, i) => {
      const byComments = Math.round(s.comments / MEDIAN_RATIO);
      const off = Math.max(byComments, s.points) / Math.max(1, Math.min(byComments, s.points));
      return {
        title: s.title, rank: `${s.rank}/${p.n}`, points: s.points, comments: s.comments,
        ratio: (s.comments / s.points).toFixed(2), byComments: `${core.fmtNum(byComments)}（×${off.toFixed(1)}）`,
        guess: core.fmtNum(Math.round(rs[i].guess)),
      };
    });
    res.detail = ui.stack(
      ui.table({
        columns: [
          { key: 'title', label: '帖子' }, { key: 'rank', label: '名次', num: true }, { key: 'points', label: '分数', num: true },
          { key: 'comments', label: '评论', num: true },
          { key: 'byComments', label: '评论反推', num: true }, { key: 'guess', label: '你猜', num: true },
        ],
        rows,
      }),
      ui.h('p', { class: 'ds-muted' }, `提示：评论数 ÷ ${MEDIAN_RATIO}（样本中位比值）是个不错的起点，括号里是它与真实分数的倍数差。评论/分明显高于 0.8 的是争议帖，低于 0.3 的往往是安静的外链或 Show HN。`),
    );
    return res;
  },
};
