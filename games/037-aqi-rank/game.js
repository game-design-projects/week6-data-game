// #37 AQI Rank — rank 5 cities by yesterday's daily-mean PM2.5, using only the prior two weeks as a clue.
import { mean, band, addDays, toLive, validSet } from './shape.js';
export { mean, band, addDays, toLive, validSet };

const API = 'https://air-quality-api.open-meteo.com/v1/air-quality';

/** Heuristic baseline: how many of the 5 positions a ranking by `key` gets right. */
export const heuristicHits = (rows, key) => {
  const truth = rows.slice().sort((a, b) => b.val - a.val).map((r) => r.en);
  return rows.slice().sort((a, b) => b[key] - a[key]).filter((r, i) => r.en === truth[i]).length;
};

export default {
  meta: {
    num: 37, slug: 'aqi-rank', title: 'AQI Rank',
    tagline: '5 座城市，按昨天的 PM2.5 从高到低排序。线索只有此前两周的走势。',
    category: 'science', data: 'live',
    howTo: [
      '每座城市给出此前 14 天的 PM2.5 走势（统一纵轴，可直接比较高低）、两周均值和「前一天」的值，单位 µg/m³，越高越脏。',
      '拖动或用 ↑↓ 把 5 座城市按「目标日」（昨天，UTC）的日均 PM2.5 从高到低排好，最多提交 3 次，每次会告诉你几个位置对了。',
      '空气污染有惯性，但风、雨、沙尘会让单日大幅偏离均值：注意走势末端的突变。',
    ],
    scoring: '排对：100 / 67 / 33 分（第 1 / 2 / 3 次提交排对）；3 次都没排对，按最后一次的正确位置数得 0–30 分。',
    sources: [{ name: 'Open-Meteo Air Quality API（Copernicus CAMS）', url: 'https://open-meteo.com/en/docs/air-quality-api', note: '免 Key、支持 CORS；OpenAQ v3 需要 API Key 且无 CORS，故改用' }],
    dataNote: '每天打开页面时，浏览器直接向 Open-Meteo 请求 50 座城市最近 15 天的逐小时 PM2.5（CAMS 大气成分模型的分析/预报值，不是地面监测站读数），取 UTC 日均；目标日 = 谜题日期的前一天，所有玩家拿到同一组数据。5 座城市由日期确定性抽取，并要求相邻城市相差 ≥ 20%。网络失败时回退到 data.json 里 2026-07 至 2026-10 的快照谜题（此时目标日为快照中的某一天）。',
  },

  puzzle({ data, pick, rng }) {
    const L = data.live;
    if (L) {
      for (let k = 0; k < 400; k++) {
        const set = rng.sample(L.cities, 5);
        if (validSet(set)) return { live: true, date: L.date, cities: set.map(({ en, zh, prev, val }) => ({ en, zh, prev, val })) };
      }
    }
    const p = pick(data.puzzles);
    return { live: false, date: data.dates[p.t], cities: p.c.map((ci) => ({ en: data.cities[ci].en, zh: data.cities[ci].zh, prev: data.pm[ci].slice(p.t - 14, p.t), val: data.pm[ci][p.t] })) };
  },

  async load(ctx) {
    const day = addDays(ctx.date, -1);
    const cs = ctx.data.cities;
    const url = `${API}?latitude=${cs.map((c) => c.lat).join(',')}&longitude=${cs.map((c) => c.lng).join(',')}&hourly=pm2_5&start_date=${addDays(day, -14)}&end_date=${day}&timezone=UTC`;
    ctx.log('live request', day);
    const raw = await ctx.fetchJSON(url, { timeout: 15000 });
    const live = toLive(raw, day, cs);
    ctx.log('live ok', day, live.cities.length, 'cities');
    return { ...ctx.data, live };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const rows = p.cities.map((c) => {
      const avg = mean(c.prev);
      return { ...c, avg, last: c.prev[13] };
    });
    ctx.log('puzzle', p.date, p.live ? 'live' : 'snapshot', rows.map((r) => `${r.en}:${r.val}`).join(' '));
    const ymax = Math.max(...rows.flatMap((r) => r.prev.filter((v) => v != null))) * 1.08;
    const sparks = await Promise.all(rows.map((r) => ui.plot((Plot, c) => ({
      marks: [
        Plot.lineY(r.prev.map((v, i) => ({ i, v })).filter((d) => d.v != null), { x: 'i', y: 'v', stroke: c.accent, strokeWidth: 2 }),
        Plot.dot([{ i: 13, v: r.last }], { x: 'i', y: 'v', fill: c.accent }),
      ],
      x: { domain: [0, 13] }, y: { domain: [0, ymax] },
    }), { height: 64, width: 130, axis: false })));
    ctx.stage.append(ui.panel({ kicker: p.live ? '线索 · 实时数据' : '线索 · 快照数据', title: `目标日：${p.date}` },
      ui.h('p', { class: 'ink2' }, `下面是各城市目标日之前 14 天的日均 PM2.5（µg/m³，所有走势共用 0–${Math.round(ymax)} 的纵轴，圆点是前一天）。目标日的值是隐藏的。`),
      ui.grid(130, ...rows.map((r, i) => ui.h('div', { class: 'ds-stack' }, ui.h('b', r.zh), sparks[i],
        ui.h('div', { class: 'small mono muted' }, ui.h('div', `均值 ${r.avg.toFixed(0)}`), ui.h('div', `前一天 ${r.last.toFixed(0)}`)))))));
    const res = await ctx.order({
      items: rows.map((r) => ({ id: r.en, label: r.zh, sub: `前 14 天均值 ${r.avg.toFixed(0)} · 前一天 ${r.last.toFixed(0)}`, value: r.val })),
      direction: 'desc', attempts: 3, title: `${p.date} 谁的空气最脏？`, topLabel: 'PM2.5 最高', bottomLabel: '最低',
      format: (v) => `${v.toFixed(1)} µg/m³`,
    });
    const sorted = rows.slice().sort((a, b) => b.val - a.val);
    const mover = rows.slice().sort((a, b) => Math.abs(Math.log(b.val / b.avg)) - Math.abs(Math.log(a.val / a.avg)))[0];
    const pct = Math.round(Math.abs(mover.val / mover.avg - 1) * 100);
    const hAvg = heuristicHits(rows, 'avg'), hLast = heuristicHits(rows, 'last');
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({ columns: [{ key: 'zh', label: '城市' }, { key: 'val', label: '目标日', num: true }, { key: 'avg', label: '两周均值', num: true }, { key: 'last', label: '前一天', num: true }, { key: 'b', label: '等级（EPA）' }],
        rows: sorted.map((r) => ({ zh: r.zh, val: r.val.toFixed(1), avg: r.avg.toFixed(1), last: r.last.toFixed(1), b: band(r.val) })) }),
      ui.callout(`答案：${sorted.map((r) => r.zh).join(' > ')}。最脏的是${sorted[0].zh}（${sorted[0].val.toFixed(1)}），最干净的是${sorted[4].zh}（${sorted[4].val.toFixed(1)}）。`, 'good'),
      ui.callout(`只按两周均值排能对 ${hAvg}/5 个位置，只按前一天的值排能对 ${hLast}/5 个。${mover.zh}偏离自己的均值最多：目标日 ${mover.val.toFixed(0)}，均值 ${mover.avg.toFixed(0)}，${mover.val > mover.avg ? '高' : '低'}了 ${pct}%——${mover.val > mover.avg ? '走势末端的上扬已是预兆，污染在积累' : '风或降水清洗了空气，污染被冲走'}。`));
    return res;
  },
};
