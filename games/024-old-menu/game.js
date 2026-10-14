// #24 Old Menu — historic NYPL menu: a restaurant, a year, an anchor price; estimate three other dishes.
const usd = (v) => (v < 1 ? `${Math.round(v * 100)}¢` : `$${v.toFixed(2)}`);

export default {
  meta: {
    num: 24,
    slug: 'old-menu',
    title: 'Old Menu',
    tagline: '一张百年前的菜单：给你餐厅、年份和一道菜的价格，猜另外三道菜卖多少钱。',
    category: 'money',
    data: 'snapshot',
    howTo: [
      '看清餐厅、地点和年份，菜单上先给出一道菜的真实价格作为参照。',
      '依次估三道菜的价格（对数滑杆，每一格约是上一格的固定倍数）。',
      '酒水、肉类、正餐通常比小菜和甜点贵得多：用参照价和菜的“档次”来换算。',
    ],
    scoring: '每道菜按猜测与真实价格的倍数差打分：差 1.5 倍内接近满分，差 10 倍以上几乎 0 分；三道取平均。',
    sources: [
      { name: 'NYPL “What’s on the Menu?” 数据集', url: 'https://menus.nypl.org/data', note: '2023-03-16 快照，Menu / MenuPage / MenuItem / Dish 四张表' },
    ],
    dataNote: '从约 1.7 万份菜单里筛出美元计价、1880–1990 年、有 12 道以上标价的菜单，并对每份菜单按价格分位挑出 4 道菜。价格为菜单原文，未做通胀调整。',
  },

  puzzle({ data, pick }) {
    return { menu: pick(data.menus) };
  },

  async play(ctx, { menu }) {
    const { ui } = ctx;
    const [anchor, ...targets] = menu.d;
    ctx.log('menu', menu.id, menu.who, menu.y);
    ctx.stage.append(
      ui.panel({ kicker: `${menu.y} 年`, title: menu.who },
        ui.kv([
          ...(menu.where && menu.where.toLowerCase() !== menu.who.toLowerCase() ? [['地点', menu.where]] : []),
          ['场合', menu.ev || '日常菜单'],
          ['年份', `${menu.y}（距今 ${2026 - menu.y} 年）`],
          ['参照', ui.h('span', {}, `${anchor[0]} = `, ui.h('b', { class: 'mono' }, usd(anchor[1])))],
        ])));

    const rs = [];
    for (let i = 0; i < targets.length; i++) {
      const [name, price] = targets[i];
      const r = await ctx.estimate({
        title: `第 ${i + 1}/3 道：${name}`,
        prompt: `${menu.y} 年「${menu.who}」，${anchor[0]} 卖 ${usd(anchor[1])}。这道多少钱？`,
        answer: price, min: 0.02, max: 100, log: true, step: 0.01, initial: anchor[1],
        format: usd, scoring: 'log', scale: 0.45,
      });
      ctx.log('estimate', name, price, r.guess);
      rs.push(r);
    }
    const res = ctx.combine(rs);
    const hi = targets.reduce((a, b) => (b[1] > a[1] ? b : a));
    const lo = targets.reduce((a, b) => (b[1] < a[1] ? b : a));
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({
        columns: [{ key: 'n', label: '菜' }, { key: 'p', label: '价格', num: true }, { key: 'r', label: '相对参照', num: true }],
        rows: menu.d.map(([n, p], i) => ({ n: i ? n : `${n}（参照）`, p: usd(p), r: i ? `×${(p / anchor[1]).toFixed(2)}` : '×1' })),
      }),
      ui.callout(`这份菜单共有 ${menu.n} 道标价菜品。最贵的 ${hi[0]} 是最便宜的 ${lo[0]} 的 ${(hi[1] / lo[1]).toFixed(1)} 倍：价差来自菜的档次（酒水、肉类、正餐 vs 小菜、甜点）：先判断档次，再套参照价。`));
    return res;
  },
};
