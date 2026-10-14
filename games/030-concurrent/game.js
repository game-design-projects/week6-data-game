// #30 Concurrent — five 24-hour curves, five Wikipedia language editions of one game's article.
// Substitution: Steam publishes no hourly player history, so the curves are hourly Wikipedia
// page views (readers of a game's article follow the same sleep/evening rhythm as its players).

export const LANGS = {
  en: ['英语', -5, '北美为主'], ja: ['日语', 9, '日本'], ko: ['韩语', 9, '韩国'], zh: ['中文', 8, '中国/台湾'],
  ru: ['俄语', 3, '莫斯科'], de: ['德语', 1, '德国/中欧'], fr: ['法语', 1, '法国/中欧'], es: ['西班牙语', -3, '西班牙 + 拉美'],
  pt: ['葡萄牙语', -3, '巴西'], it: ['意大利语', 1, '意大利'], id: ['印尼语', 7, '雅加达'], tr: ['土耳其语', 3, '土耳其'],
  vi: ['越南语', 7, '越南'], th: ['泰语', 7, '泰国'], pl: ['波兰语', 1, '波兰'], ar: ['阿拉伯语', 3, '中东'],
  nl: ['荷兰语', 1, '荷兰'], sv: ['瑞典语', 1, '瑞典'], uk: ['乌克兰语', 3, '乌克兰'], fa: ['波斯语', 3.5, '伊朗'],
  cs: ['捷克语', 1, '捷克'], hu: ['匈牙利语', 1, '匈牙利'],
};

/** Local clock label for a UTC hour at an offset, e.g. localHour(13.5, 9) -> "22:30". */
export function localHour(utc, off) {
  const h = (((utc + off) % 24) + 24) % 24;
  return `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;
}

/** Same-slot score of a match result: kept pure for tests. */
export function peakShare(share) { return Math.max(...share); }

export default {
  meta: {
    num: 30, slug: 'concurrent', title: 'Concurrent', category: 'money', data: 'snapshot',
    tagline: '五条 24 小时热度曲线，分别来自五种语言的维基百科里的游戏词条。靠时区峰值把曲线配给语言。',
    howTo: [
      '横轴是 UTC 0–24 点。每条曲线是某个语言版本词条一天里每小时的浏览占比，不显示绝对数量。',
      '读者大多在当地下午到晚上浏览，凌晨 3–6 点是最低谷。把 UTC 时间加上该语种主要使用地的时差，找出哪条曲线的谷底落在当地凌晨。',
      '把每条曲线连到对应的语言。有 3 次机会，每次提交会标出哪些配对是对的。',
    ],
    scoring: '按配对正确数与尝试次数计分。',
    sources: [
      { name: 'Wikimedia hourly pageview dumps', url: 'https://dumps.wikimedia.org/other/pageviews/2026/2026-09/', note: '2026-09-15 UTC 全天 24 个小时文件' },
      { name: 'Wikipedia langlinks API', url: 'https://www.mediawiki.org/wiki/API:Langlinks', note: '各语言版本的游戏词条标题' },
    ],
    dataNote: 'Steam 官方 API 只提供「此刻」的在线人数，SteamDB 等有小时历史的站点屏蔽脚本访问，所以这里改用维基百科词条的逐小时浏览量作为「在线节奏」的真实替代。数据来自 2026-09-15（周二）一天，每个谜题随机取 36 款游戏词条合计（单个词条的小时流量太小、曲线不平滑），再按全天总量归一化。',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return { games: p.games, langs: Object.keys(p.curves), curves: p.curves, day: data.day };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const order = ctx.rng.shuffle([...p.langs]);
    const cur = order.map((l) => p.curves[l]);
    const yMax = Math.ceil(Math.max(...cur.map((c) => peakShare(c.share))) + 0.5);
    ctx.log('puzzle', p.games.length, p.langs.join(','));
    const bodies = await Promise.all(order.map((l, i) => ui.plot((Plot, c) => ({
      height: 120, width: 300, marginLeft: 34, marginBottom: 22,
      x: { domain: [0, 23], ticks: [0, 6, 12, 18], tickFormat: (h) => `${String(h).padStart(2, '0')}`, label: null },
      y: { domain: [0, yMax], ticks: 2, label: null, tickFormat: (v) => `${v}%` },
      marks: [
        Plot.areaY(cur[i].share.map((v, h) => ({ h, v })), { x: 'h', y: 'v', fill: c.series[i % c.series.length], fillOpacity: 0.2, curve: 'basis' }),
        Plot.lineY(cur[i].share.map((v, h) => ({ h, v })), { x: 'h', y: 'v', stroke: c.series[i % c.series.length], strokeWidth: 2, curve: 'basis' }),
        Plot.ruleX([12], { stroke: c.muted, strokeOpacity: 0.3 }),
      ],
    }))));
    ctx.stage.append(ui.panel({ kicker: `${p.day} · UTC`, title: `${p.games.length} 款热门游戏词条的五个语言版本` },
      ui.h('p', { class: 'small muted' }, '纵轴为该小时占全天浏览量的百分比；横轴是 UTC 小时。曲线的位置越靠右，读者所在时区越靠西。')));
    const res = await ctx.match({
      left: order.map((l, i) => ({ id: l, body: bodies[i] })),
      right: [...p.langs].sort().map((l) => ({ id: l, label: `${LANGS[l][0]}版（${LANGS[l][2]}）` })),
      answer: Object.fromEntries(order.map((l) => [l, l])),
      attempts: 3, title: '把曲线配给语言',
    });
    res.detail = ui.table({
      columns: [{ key: 'lang', label: '语言' }, { key: 'peak', label: 'UTC 峰值', num: true }, { key: 'loc', label: '当地时间', num: true }, { key: 'low', label: 'UTC 谷底', num: true }],
      rows: p.langs.map((l) => {
        const c = p.curves[l], [name, off] = LANGS[l];
        const low = c.share.indexOf(Math.min(...c.share));
        return { lang: name, peak: `${String(Math.floor(c.peak)).padStart(2, '0')}:30`, loc: `${localHour(c.peak, off)}（UTC${off >= 0 ? '+' : ''}${off}）`, low: `${String(low).padStart(2, '0')}:00` };
      }),
    });
    res.detail = ui.h('div', {}, ui.h('p', { class: 'small' }, '规律：每种语言的谷底都落在当地凌晨，高峰在当地下午到晚上；换算成 UTC 后，时区越靠东，曲线整体越靠左。'), res.detail,
      ui.h('p', { class: 'small muted' }, `词条篮子：${p.games.slice(0, 8).join('、')} 等 ${p.games.length} 款。`));
    return res;
  },
};
