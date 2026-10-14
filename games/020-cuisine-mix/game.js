// #20 Cuisine Mix — a ZIP code's restaurant cuisine mix; pin where it is in NYC.
export const pct = (v, n) => Math.round((1000 * v) / n) / 10;

export default {
  meta: {
    num: 20,
    slug: 'cuisine-mix',
    title: 'Cuisine Mix',
    tagline: '某个街区的餐厅菜系构成长什么样？读出它的“口味指纹”，在纽约地图上标出这个街区。',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      '图里是某个邮编区内餐厅的菜系占比（条形），竖线是全市平均水平。',
      '找出比平均高得多的菜系：中餐和面包店扎堆是法拉盛/日落公园，犹太餐、墨西哥、牙买加、意大利……各有自己的“地盘”。咖啡馆和日料多的往往是曼哈顿和布鲁克林的潮区。',
      '在地图上点出这个街区的位置。距离越近分越高。',
    ],
    scoring: '100 × e^(−距离/3 km)：正中 100 分，差约 3 km 约 37 分。',
    sources: [
      { name: 'NYC DOHMH Restaurant Inspection Results', url: 'https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j', note: '每家餐厅按最近记录的菜系与邮编统计；街区位置取该邮编内餐厅坐标的中位数' },
    ],
    dataNote: '只统计在检查记录中有坐标的餐厅（约 2.7 万家），且餐厅数 ≥ 120 的邮编。菜系名称为 DOHMH 原文。',
  },

  puzzle({ data, pick }) {
    const z = pick(data.zips);
    return { zip: z, cityTop: data.cityTop, n: data.n };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const z = p.zip;
    const cityAvg = new Map(p.cityTop);
    const rows = z.mix.slice(0, 8).map(([k, v]) => ({ k, share: pct(v, z.n), city: cityAvg.get(k) ?? null }));
    ctx.log('zip', z.zip, z.boro, z.n, 'top', rows[0].k);
    const chart = await ui.plot((Plot, c) => ({
      height: 300, marginLeft: 120, marginRight: 36,
      x: { label: '占本区餐厅 %', grid: true },
      y: { label: null, domain: rows.map((r) => r.k) },
      marks: [
        Plot.barX(rows, { y: 'k', x: 'share', fill: c.accent }),
        Plot.text(rows, { y: 'k', x: 'share', text: (r) => `${r.share}%`, dx: 4, textAnchor: 'start', fill: c.ink }),
        Plot.tickX(rows.filter((r) => r.city != null), { y: 'k', x: 'city', stroke: c.ink, strokeWidth: 2, strokeDasharray: '2 2' }),
      ],
    }));
    ctx.stage.append(ui.panel({ kicker: `${z.n} 家餐厅`, title: '这个街区的菜系构成' }, chart,
      ui.h('div', { class: 'small muted', style: { marginTop: '8px' } }, '┆ 竖线 = 全市平均占比（仅前 8 大菜系有标注）')));

    const res = await ctx.pin({
      answer: { lat: z.lat, lng: z.lng, label: `${z.zip} · ${z.boro}` },
      view: { center: [40.72, -73.95], zoom: 10 },
      scale: 3,
      title: '它在哪里？',
    });
    res.detail = ui.kv([
      ['邮编', `${z.zip}（${z.boro}）`],
      ['最突出的特色', z.lift.length ? z.lift.map(([k, l]) => `${k} 是全市均值的 ${l}×`).join('；') : '没有明显偏好'],
      ['最大菜系', `${rows[0].k} ${rows[0].share}%`],
    ]);
    return res;
  },
};
