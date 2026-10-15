// #20 Cuisine Mix — a ZIP code's restaurant cuisine mix; pin where it is in NYC.
export const pct = (v, n) => Math.round((1000 * v) / n) / 10;

// Chinese gloss for the DOHMH cuisine labels (the English label stays the data label).
export const ZH = {
  American: '美式', Chinese: '中餐', 'Coffee/Tea': '咖啡茶饮', Pizza: '披萨', 'Latin Amer.': '拉美', Mexican: '墨西哥', Japanese: '日料',
  Italian: '意大利', 'Bakery/Dessert': '烘焙甜点', Chicken: '炸鸡', Caribbean: '加勒比', Donuts: '甜甜圈', 'Juice/Smoothies': '果汁冰沙',
  Hamburgers: '汉堡', 'Asian/Asian Fusion': '亚洲融合', Spanish: '西班牙', 'Sandwiches/Salads': '三明治沙拉', Korean: '韩餐',
  'Frozen Desserts': '冷饮甜品', Thai: '泰餐', 'Jewish/Kosher': '犹太洁食', Indian: '印度', Mediterranean: '地中海', 'Tex-Mex': '德州墨西哥',
  'Middle Eastern': '中东', French: '法餐', Seafood: '海鲜', 'Bagels/Pretzels': '贝果', 'New American': '新美式', Irish: '爱尔兰',
  Greek: '希腊', 'Eastern European': '东欧', 'Southeast Asian': '东南亚', Fusion: '融合', Peruvian: '秘鲁', Steakhouse: '牛排',
  'Bottled Beverages': '瓶装饮料', African: '非洲', Bangladeshi: '孟加拉', Turkish: '土耳其', Vegan: '纯素', 'Soul Food': '灵魂美食',
  Vegetarian: '素食', Barbecue: '烧烤', Continental: '欧陆', Hawaiian: '夏威夷', 'Pancakes/Waffles': '松饼', Russian: '俄餐', Tapas: '塔帕斯',
  Australian: '澳洲', Filipino: '菲律宾', Brazilian: '巴西', 'Chinese/Japanese': '中日', Pakistani: '巴基斯坦', German: '德餐', Hotdogs: '热狗',
  'New French': '新派法餐', Californian: '加州', Creole: '克里奥尔', Ethiopian: '埃塞俄比亚', Polish: '波兰', 'Chinese/Cuban': '中古',
  Soups: '汤', Portuguese: '葡萄牙',
};
export const zh = (k) => (ZH[k] ? `${k} ${ZH[k]}` : k);

export const NYC_BOUNDS = [[40.49, -74.27], [40.92, -73.68]];

export default {
  meta: {
    num: 20,
    slug: 'cuisine-mix',
    title: 'Cuisine Mix',
    tagline: '某个邮编区的餐厅菜系构成长什么样？读出它的“口味指纹”，在纽约地图上标出这个街区。',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      '图里是某个邮编区内餐厅的菜系占比（橙色条），空心圆点是全市平均占比，条比圆点长得多的就是这里的“特色”。',
      '中餐和面包店扎堆多半是法拉盛、日落公园一带；犹太洁食、墨西哥、牙买加/加勒比、意大利……各有自己的“地盘”；咖啡、日料、牛排多的常在曼哈顿和布鲁克林的热闹区。',
      '在地图上点出这个邮编区的位置（地图不显示地名）。距离越近分越高。',
    ],
    scoring: '100 × e^(−距离/3 km)：正中 100 分，差约 3 km 约 37 分，差 10 km 以上基本为 0。街区位置取该邮编内餐厅坐标的中位数。',
    sources: [
      { name: 'NYC DOHMH Restaurant Inspection Results', url: 'https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j', note: '每家餐厅取其记录中的菜系与邮编统计' },
    ],
    dataNote: '数据为 NYC Open Data（DOHMH 餐厅检查记录）的快照，约 2.65 万家有坐标且有菜系的餐厅（含近年已歇业者的记录），统计餐厅数 ≥ 100 的 92 个邮编区。“Other”“Not Listed”等无信息的菜系已剔除；几个近义的三明治/沙拉类合并。“街区”取邮编区而非自定义社区。该数据集每日更新，但菜系构成变化很慢，所以这里用快照而不是实时拉取。',
  },

  puzzle({ data, pick }) {
    const z = pick(data.zips);
    return { zip: z, cityShare: data.cityShare, n: data.n };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const z = p.zip;
    const rows = z.mix.slice(0, 10).map(([k, v]) => ({ k, share: pct(v, z.n), city: p.cityShare[k] == null ? null : Math.round(p.cityShare[k] * 10) / 10 }))
      .map((r) => ({ ...r, label: `${r.k}  ${r.share}%` }));
    ctx.log('zip', z.zip, z.boro, z.n, 'top', rows[0].k, 'lift', JSON.stringify(z.lift));
    const chart = await ui.plot((Plot, c) => ({
      height: 40 + rows.length * 30, marginLeft: 150, marginRight: 16,
      x: { label: '占本区餐厅 %', grid: true },
      y: { label: null, domain: rows.map((r) => r.label) },
      marks: [
        Plot.barX(rows, { y: 'label', x: 'share', fill: c.accent }),
        Plot.dot(rows.filter((r) => r.city != null), { y: 'label', x: 'city', r: 5, stroke: c.ink, strokeWidth: 2, fill: c.paper }),
      ],
    }));
    ctx.stage.append(ui.panel({ kicker: `${z.n} 家餐厅`, title: '这个街区的菜系构成' }, chart,
      ui.h('div', { class: 'small muted', style: { marginTop: '8px' } }, '○ 空心圆点 = 全市平均占比；条越超出圆点，越是这里的特色。（左侧百分比 = 该菜系占本区餐厅的比例）')));

    const res = await ctx.pin({
      answer: { lat: z.lat, lng: z.lng, label: `${z.zip} · ${z.boro}` },
      view: { bounds: NYC_BOUNDS },
      scale: 3,
      title: '它在哪里？',
    });
    const top = rows[0];
    const liftTxt = z.lift.length
      ? z.lift.map(([k, l, v]) => { return `${zh(k)} 占 ${pct(v, z.n)}%，是全市平均（${Math.round(p.cityShare[k] * 10) / 10}%）的 ${l} 倍`; }).join('；')
      : '没有哪个菜系明显高于全市平均：这是个“典型纽约”的混合区，主要靠最大菜系与咖啡/披萨等常见类别判断';
    res.detail = ui.kv([
      ['邮编', `${z.zip}（${z.boro}）`],
      ['它的“指纹”', liftTxt],
      ['最大菜系', `${zh(top.k)} ${top.share}%（全市 ${top.city ?? '<0.1'}%）`],
      ['怎么推理', z.lift.length ? `先找条远超圆点的菜系（${zh(z.lift[0][0])}），它往往对应特定的社区；再看地图上哪个${z.boro}的街区符合。` : '没有强特色时，先排除有明显族裔特色的区，再在剩下的区里按咖啡/日料等“潮区”特征猜。'],
    ]);
    return res;
  },
};
