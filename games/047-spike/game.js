// #47 Spike — the hottest-rising English Wikipedia article of a day, shown as a nameless pageview curve.
// Each wrong guess reveals another article that spiked the same day.
// Live: load() rebuilds the puzzle for (puzzle date − 2 days) from the Wikimedia Pageviews API; data.json is the fallback.

const API = 'https://wikimedia.org/api/rest_v1/metrics/pageviews';
const MIN_VIEWS = 40000; // a day's spike must reach this many views to count
const MIN_RATIO = 3; // ... and be at least this many times the previous-3-day level
const CO_RATIO = 2.2;
const NSFW = /porn|sex|xxx|nude|erotic|fetish|hentai|onlyfans/i;

/** Pages that are never puzzles (and never options): special pages, lists, years, adult content. */
export function isBad(a) {
  return /:/.test(a) || a === 'Main_Page' || a === '-' || /^\./.test(a) || /^Deaths_in_|^List_of_/.test(a) || /^\d{4}$/.test(a) || NSFW.test(a);
}

/** Top-list JSON from the API → Map(article → views), in rank order. */
export function topMap(json) {
  return new Map((json?.items?.[0]?.articles ?? []).map((x) => [x.article, x.views]));
}

/** Every article of day `cur` with ≥ 40k views, ranked by views ÷ mean of the 3 previous days. prev = [Map, Map, Map]. */
export function rankSpikes(prev, cur) {
  const floors = prev.map((m) => Math.min(...m.values()));
  const spikes = [];
  let rank = 0;
  for (const [a, v] of cur) {
    rank++;
    if (isBad(a) || v < MIN_VIEWS) continue;
    const base = prev.reduce((s, m, i) => s + (m.get(a) ?? floors[i]), 0) / 3;
    spikes.push({ a, v, rank, ratio: v / base, exact: prev.every((m) => m.has(a)) });
  }
  return spikes.sort((x, y) => y.ratio - x.ratio);
}

const stamp = (iso) => `${iso.replaceAll('-', '')}00`;
const shift = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const topUrl = (day) => `${API}/top/en.wikipedia/all-access/${day.replaceAll('-', '/')}`;
export const seriesUrl = (article, day) => `${API}/per-article/en.wikipedia/all-access/user/${encodeURIComponent(article)}/daily/${stamp(shift(day, -20))}/${stamp(day)}`;

/** Per-article JSON → 21 daily user views ending on `day`, or null if incomplete / not a real (human) spike. */
export function checkSeries(json, day) {
  const items = json?.items;
  if (!Array.isArray(items) || items.length !== 21) return null;
  for (let i = 0; i < 21; i++) {
    if (items[i].timestamp !== stamp(shift(day, i - 20)) || !Number.isFinite(items[i].views)) return null;
  }
  const series = items.map((x) => x.views);
  const base = series.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
  if (series[20] < MIN_VIEWS / 2 || series[20] < MIN_RATIO * Math.max(base, 1)) return null; // bot traffic in the all-access list
  return series;
}

const norm = (t) => t.toLowerCase().replace(/\s*\(.*\)$/, '');

/** One puzzle object from a ranked spike list, the chosen index and its series. */
export function makePuzzle(day, spikes, idx, series) {
  const w = spikes[idx];
  if (!w || w.ratio < MIN_RATIO) return null;
  const title = w.a.replaceAll('_', ' ');
  const wn = norm(title);
  const co = spikes
    .filter((s, i) => i !== idx && s.ratio >= CO_RATIO && !norm(s.a.replaceAll('_', ' ')).includes(wn) && !wn.includes(norm(s.a.replaceAll('_', ' '))))
    .slice(0, 5)
    .map((c) => ({ t: c.a.replaceAll('_', ' '), v: c.v, r: +c.ratio.toFixed(1) }));
  if (co.length < 3) return null;
  return { date: day, title, id: w.a, views: w.v, ratio: +w.ratio.toFixed(1), exact: w.exact, rank: w.rank, series, co };
}

/** Pure: 4 top-list JSONs (day−3 … day) + a lookup of per-article JSON → puzzle. First candidate with a valid series wins. */
export function toPuzzle(day, topJsons, seriesFor, tries = 4) {
  const maps = topJsons.map(topMap);
  const spikes = rankSpikes(maps.slice(0, 3), maps[3]);
  for (let i = 0; i < Math.min(tries, spikes.length); i++) {
    const series = checkSeries(seriesFor(spikes[i].a), day);
    if (!series) continue;
    const p = makePuzzle(day, spikes, i, series);
    if (p) return p;
  }
  return null;
}

/** Shape of the surge: how many days of calm before the spike, and the jump factor. */
export function describeSpike(series) {
  const last = series.at(-1);
  const prior = series.slice(0, -1);
  const base = prior.reduce((a, b) => a + b, 0) / prior.length;
  const calm = prior.filter((v) => v < base * 2).length;
  return { last, base: Math.round(base), factor: base > 0 ? last / base : 0, calm, prior: series.at(-2), peak: Math.max(...prior) };
}

/** Score for solving on guess n of 6 (0 if lost). */
export const scoreFor = (n, won) => (won ? Math.round((100 * (7 - n)) / 6) : 0);

export default {
  meta: {
    num: 47,
    slug: 'spike',
    title: 'Spike',
    tagline: '两天前维基百科浏览量暴涨最猛的词条，只给你一条没有名字的曲线。猜错一次，揭示一篇同一天一起暴涨的词条。',
    category: 'words',
    data: 'live',
    howTo: [
      '图里是英文维基百科某个词条 21 天的每日浏览量（对数坐标），最后一天是暴涨日，日期已告诉你。今天的谜题取两天前那一天：那时榜单已定稿，全球玩家看到的是同一条曲线。',
      '从列表里选词条来猜，最多 6 次（列表是近期热门词条，不只是答案候选）。每猜错一次，揭示一篇同一天也在暴涨的词条；你猜的词条若也在暴涨，会标成黄色。',
      '线索是互相关联的：同一天暴涨的往往是同一件事里的人、球队、作品。把它们拼起来，想想那天发生了什么。',
      '曲线形状也有信息：平静后陡升多半是突发新闻；曲线本来就高，则是持续热点。',
    ],
    scoring: '第 1 次猜中 100 分，第 2 次 83，第 3 次 67，第 4 次 50，第 5 次 33，第 6 次 17，没猜中 0 分。',
    sources: [
      { name: 'Wikimedia Pageviews API：每日热门榜（top）', url: 'https://wikimedia.org/api/rest_v1/#/Pageviews%20data/get_metrics_pageviews_top__project___access___year___month___day_', note: 'en.wikipedia，all-access，每天前 1000 名' },
      { name: 'Wikimedia Pageviews API：单篇词条每日浏览（per-article）', url: 'https://wikimedia.org/api/rest_v1/#/Pageviews%20data/get_metrics_pageviews_per_article__project___access___agent___article___granularity___start___end_', note: '曲线为真人（user）流量' },
    ],
    dataNote: '实时数据：打开页面时，浏览器直接向 Wikimedia 取「谜题日期前两天」的每日榜单，并选出当天「浏览量 ÷ 前三天平均」最高的词条（当天 ≥ 4 万次，剔除首页、特殊页、Deaths in … 和 List of … 等），再取它 21 天的真人浏览曲线；若曲线不能证明是真人流量暴涨（机器人流量），顺延到下一名。前三天不在前 1000 名的词条，按当时榜单第 1000 名的浏览量估计基线，所以榜单倍数是保守估计。取数失败时回退到 data.json 里 2026-07 至 10 月的存档谜题。「同日暴涨」线索来自含机器人流量的全访问榜单，个别条目可能是爬虫造成的。',
  },

  puzzle({ data, pick }) {
    return data.live ?? pick(data.puzzles);
  },

  async load(ctx) {
    const day = ctx.core.addDays(ctx.date, -2);
    const days = [-3, -2, -1, 0].map((k) => ctx.core.addDays(day, k));
    ctx.log('live: fetching top lists', days[0], '…', day);
    const tops = await Promise.all(days.map((d) => ctx.fetchJSON(topUrl(d), { timeout: 8000 })));
    const maps = tops.map(topMap);
    if (maps.some((m) => m.size < 500)) throw new Error('top list incomplete');
    const spikes = rankSpikes(maps.slice(0, 3), maps[3]);
    const cache = {};
    const cands = spikes.slice(0, 4);
    const got = await Promise.all(cands.map((s) => ctx.fetchJSON(seriesUrl(s.a, day), { timeout: 8000 })));
    cands.forEach((s, i) => { cache[s.a] = got[i]; });
    const live = toPuzzle(day, tops, (a) => cache[a]);
    if (!live) throw new Error('no valid spike for ' + day);
    const opts = new Set(ctx.data.options);
    for (const m of maps) for (const [a] of [...m].slice(0, 300)) if (!isBad(a)) opts.add(a.replaceAll('_', ' '));
    for (const c of live.co) opts.add(c.t);
    opts.add(live.title);
    ctx.log('live ok', live.date, live.title, `x${live.ratio}`);
    return { ...ctx.data, live, options: [...opts].sort() };
  },

  async play(ctx, P) {
    const { ui, core } = ctx;
    const sp = describeSpike(P.series);
    const start = new Date(Date.parse(`${P.date}T00:00:00Z`) - 20 * 86400000);
    const rows = P.series.map((v, i) => ({ date: new Date(start.getTime() + i * 86400000), v }));
    ctx.log('puzzle', P.date, P.title, `x${P.ratio}`);

    const lo = Math.max(1, Math.min(...P.series) * 0.6);
    const hi = Math.max(...P.series) * 1.5;
    const ticks = [10, 30, 100, 300, 1e3, 3e3, 1e4, 3e4, 1e5, 3e5, 1e6, 3e6, 1e7].filter((t) => t >= lo * 1.3 && t <= hi);
    const chart = await ui.plot((Plot, c) => ({
      height: 240,
      marginLeft: 52,
      marginBottom: 32,
      x: { type: 'utc', tickFormat: '%m-%d', label: null, ticks: 5 },
      y: { type: 'log', domain: [lo, hi], grid: true, label: null, ticks, tickFormat: (v) => core.fmtCompact(v) },
      marks: [
        Plot.areaY(rows, { x: 'date', y: 'v', y1: lo, fill: c.accent, fillOpacity: 0.15 }),
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
      scoring: scoreFor,
      feedback: (g) => (g.id === P.title
        ? [{ text: '就是它', state: 'hit' }]
        : coSet.has(g.id) ? [{ text: `是 · ${coSet.get(g.id).r.toFixed(1)}×`, state: 'near', num: true }] : [{ text: '否', state: 'miss' }]),
      onGuess: (opt, { correct }) => ctx.log('guess', opt.id, correct),
    });

    const shape = sp.calm >= 15
      ? `暴涨前 ${sp.calm} 天都低于日均的 2 倍，前一天只有 ${core.fmtNum(sp.prior)} 次，然后一天内冲到 ${core.fmtNum(sp.last)} 次：平地起飞，典型的突发事件（新闻、赛事、讣告、新作发布）。`
      : `这条曲线本来就不平静（此前 20 天里最高 ${core.fmtNum(sp.peak)} 次），暴涨日在此基础上又抬高到 ${core.fmtNum(sp.last)} 次：更像持续热点上的新一波。`;
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['答案', ui.h('a', { href: `https://en.wikipedia.org/wiki/${encodeURIComponent(P.id)}`, target: '_blank', rel: 'noopener' }, P.title)],
        ['日期', P.date],
        ['当天浏览', `${core.fmtNum(sp.last)} 次真人浏览，约为此前 20 天日均的 ${sp.factor.toFixed(1)} 倍；按榜单口径（对比前三天）是 ${P.ratio.toFixed(1)} 倍，当天全站第 ${P.rank} 名`],
        ['曲线特征', shape],
        ['怎么推出来', `同一天一起暴涨的还有 ${P.co.map((c) => c.t).join('、')}。它们彼此相关的那件事，就是「${P.title}」当天暴涨的原因。`],
      ]),
      ui.table({
        columns: [{ key: 't', label: '同日暴涨词条' }, { key: 'v', label: '浏览', num: true, fmt: (v) => core.fmtNum(v) }, { key: 'r', label: '倍数', num: true, fmt: (v) => `${v.toFixed(1)}×` }],
        rows: P.co,
      }));
    return res;
  },
};
