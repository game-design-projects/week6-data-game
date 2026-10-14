// #37 AQI Rank — rank 5 cities by their daily-mean PM2.5 using only the prior two weeks as a clue.
export const mean = (xs) => { const a = xs.filter((x) => x != null); return a.length ? a.reduce((p, q) => p + q, 0) / a.length : null; };
/** WHO 2021 PM2.5 24h guideline = 15 µg/m³; US EPA AQI bands for 24h PM2.5. */
export const band = (v) => (v <= 9 ? '优' : v <= 35.4 ? '良' : v <= 55.4 ? '轻度污染' : v <= 125.4 ? '中度污染' : '重度污染');

export default {
  meta: {
    num: 37, slug: 'aqi-rank', title: 'AQI Rank',
    tagline: '5 座城市，按某一天的 PM2.5 从高到低排序。线索只有过去两周的走势。',
    category: 'science', data: 'snapshot',
    howTo: [
      '每座城市给出前 14 天的 PM2.5 均值、前一天的值和走势图（µg/m³，越高越脏）。',
      '拖动或用 ↑↓ 把 5 座城市按「目标日」的日均 PM2.5 从高到低排好，最多 3 次提交。',
      '空气污染有惯性，但也会被一场风或雨瞬间冲走：注意走势里的突变。',
    ],
    scoring: '按位置答对的比例计分，用的次数越少分越高。',
    sources: [{ name: 'Open-Meteo Air Quality API（Copernicus CAMS）', url: 'https://open-meteo.com/en/docs/air-quality-api', note: 'OpenAQ 需要 API Key，故改用同类的免 Key 数据' }],
    dataNote: 'PM2.5 为 CAMS 大气成分模型再分析/预报的逐小时值（非地面监测站读数），取 UTC 日均。数据为抓取快照，最近 92 天。',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return { t: p.t, c: p.c, date: data.dates[p.t] };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const rows = p.c.map((ci) => {
      const prev = data.pm[ci].slice(p.t - 14, p.t);
      return { ci, zh: data.cities[ci].zh, en: data.cities[ci].en, prev, avg: mean(prev), last: prev[13], val: data.pm[ci][p.t] };
    });
    ctx.log('puzzle', p.date, rows.map((r) => `${r.en}:${r.val}`).join(' '));
    const sparks = await Promise.all(rows.map((r) => ui.plot((Plot, c) => ({
      marks: [Plot.lineY(r.prev.map((v, i) => ({ i, v })), { x: 'i', y: 'v', stroke: c.accent, strokeWidth: 2 }), Plot.dot([{ i: 13, v: r.last }], { x: 'i', y: 'v', fill: c.accent })],
    }), { height: 60, width: 150, axis: false })));
    ctx.stage.append(ui.panel({ kicker: '线索', title: `目标日：${p.date}` },
      ui.h('p', { class: 'ink2' }, '下面是各城市目标日之前 14 天的日均 PM2.5（µg/m³）。目标日的值是隐藏的。'),
      ui.grid(150, ...rows.map((r, i) => ui.h('div', { class: 'ds-stack' }, ui.h('b', r.zh), sparks[i],
        ui.h('div', { class: 'small mono muted' }, `均值 ${r.avg.toFixed(0)} · 前一天 ${r.last.toFixed(0)}`))))));
    const res = await ctx.order({
      items: rows.map((r) => ({ id: r.en, label: r.zh, sub: `前14天均值 ${r.avg.toFixed(0)} · 前一天 ${r.last.toFixed(0)}`, value: r.val })),
      direction: 'desc', attempts: 3, title: `${p.date} 谁的空气最脏？`, topLabel: 'PM2.5 最高', bottomLabel: '最低',
      format: (v) => `${v.toFixed(1)} µg/m³`,
    });
    const sorted = rows.slice().sort((a, b) => b.val - a.val);
    const surprise = rows.slice().sort((a, b) => Math.abs(Math.log(b.val / b.avg)) - Math.abs(Math.log(a.val / a.avg)))[0];
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({ columns: [{ key: 'zh', label: '城市' }, { key: 'val', label: '目标日', num: true }, { key: 'avg', label: '前14天均值', num: true }, { key: 'b', label: '等级' }],
        rows: sorted.map((r) => ({ zh: r.zh, val: r.val.toFixed(1), avg: r.avg.toFixed(1), b: band(r.val) })) }),
      ui.callout(`${surprise.zh} 偏离自己的两周均值最多（${surprise.val.toFixed(0)} vs ${surprise.avg.toFixed(0)}）。均值是好起点，但风雨和逆温会让单日大幅偏离。`));
    return res;
  },
};
