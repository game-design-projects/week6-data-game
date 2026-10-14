// #14 311 — a ZIP code's 311 complaint mix; pin where in NYC it is.
export default {
  meta: {
    num: 14,
    slug: '311',
    title: '311',
    tagline: '给出纽约某个邮编区一整年的 311 投诉构成，在地图上标出这个街区。',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      '图里是 2025 年某个邮编区最常见的 311 投诉类型占比，灰色刻度是全市平均。',
      '找“比全市高得多”的类型：流动摊贩和露营多在中城，供暖投诉多在老公寓区，非法停车和堵车库多在外围居民区。',
      '在地图上点出这个邮编区的位置。你有 2 次机会，第一次偏了会提示方向。',
      '按距离计分，越近分越高。',
    ],
    scoring: '100 × e^(−距离/3 km)，第二次尝试扣 10%。',
    sources: [
      { name: 'NYC Open Data · 311 Service Requests from 2020 to Present', url: 'https://data.cityofnewyork.us/resource/erm2-nwe9.json', note: '2025 全年，按邮编聚合' },
    ],
    dataNote: '“位置”取该邮编区所有投诉坐标的平均值；只保留全年投诉量超过 4,000 条的邮编区。',
  },

  puzzle({ data, pick }) {
    return { zip: pick(data.zips).zip };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const z = ctx.data.zips.find((x) => x.zip === p.zip);
    ctx.log('zip', z.zip, z.borough);
    const rows = z.top.map(([t, pct, avg]) => ({ t, pct, avg }));
    const chart = await ui.plot((Plot, c) => ({
      height: 300, marginLeft: 150, marginRight: 30,
      x: { label: '占该区全部投诉 %', grid: true },
      y: { label: null, domain: rows.map((r) => r.t) },
      marks: [
        Plot.barX(rows, { y: 't', x: 'pct', fill: c.accent }),
        Plot.text(rows, { y: 't', x: 'pct', text: (r) => `${r.pct}%`, dx: 4, textAnchor: 'start', fill: c.ink }),
        Plot.tickX(rows.filter((r) => r.avg != null), { y: 't', x: 'avg', stroke: c.ink, strokeWidth: 2 }),
      ],
    }), { axis: true });
    ctx.stage.append(ui.panel({ kicker: `2025 年 · 共 ${core.fmtNum(z.total)} 条投诉`, title: '这个邮编区在抱怨什么' }, chart,
      ui.h('div', { class: 'small muted' }, '黑色竖线 = 全市平均占比。')));

    const res = await ctx.pin({
      answer: { lat: z.lat, lng: z.lng, label: `邮编 ${z.zip}` },
      view: { center: [40.71, -73.97], zoom: 10 },
      scale: 3,
      attempts: 2,
      title: '它在纽约的哪里？',
      hint: (km, bearing) => `差 ${km.toFixed(1)} km，再往${['北', '东北', '东', '东南', '南', '西南', '西', '西北'][Math.round(bearing / 45) % 8]}找找`,
    });
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['邮编', z.zip], ['行政区', z.borough]]),
      ui.h('div', '它最“反常”的投诉（占比是全市的几倍）：'),
      ui.table({ columns: [{ key: 't', label: '类型' }, { key: 'x', label: '倍数', num: true }], rows: z.lift.map(([t, x]) => ({ t, x: `${x}×` })) }));
    return res;
  },
};
