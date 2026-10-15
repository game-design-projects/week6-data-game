// #24 Old Menu — historic NYPL menu: a restaurant, a year, an anchor price; estimate three other dishes.
export const usd = (v) => (v < 1 ? `${Math.round(v * 100)}¢` : `$${v.toFixed(2)}`);
// slider range by era (so the slider itself never reveals the answer, yet stays usable)
export const rangeFor = (y) => (y < 1930 ? { min: 0.02, max: 10 } : y < 1960 ? { min: 0.05, max: 25 } : { min: 0.1, max: 60 });
// price in today's dollars, or null before 1913 (no CPI series)
export const modern = (price, y, cpi) => (cpi && cpi[y] ? price * cpi[y] : null);
const money = (v) => (v >= 100 ? `$${Math.round(v)}` : `$${v.toFixed(2)}`);

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
      '依次估三道菜的价格（对数滑杆，每一格约是上一格的固定倍数，也可直接输入）。每份菜单都是美元标价。',
      '肉类、海鲜、正餐主菜通常比面包、配菜、甜点贵得多：用参照价和菜的“档次”来换算。若有「今天的美元」折算，可借它体会当年一块钱的购买力。',
    ],
    scoring: '每道菜按猜测与真实价格的倍数差打分（对数尺度）：差 1.25 倍约 76 分，差 2 倍约 42 分，差 10 倍约 6 分；三道相加，满分 300。',
    sources: [
      { name: 'NYPL “What’s on the Menu?” 数据集', url: 'https://menus.nypl.org/data', note: '2023-03-16 快照，Menu / MenuPage / MenuItem / Dish 四张表' },
      { name: 'US CPI-U 月度指数（datasets/cpi-us，源自 BLS）', url: 'https://github.com/datasets/cpi-us', note: '1913 年起；用来折算成今天的美元' },
    ],
    dataNote: '从约 1.7 万份菜单里筛出美元计价（或美国地点）、1880–1990 年、有 9 道以上标价食物的菜单，每份取 4 道菜：1 道中档菜作参照，另 3 道从便宜到最贵各取一道。酒水因按瓶/按杯计价不统一而剔除，只留食物。价格为菜单原文（美元），未做人工校对；今天的美元用 CPI 折算，1913 年以前没有 CPI 序列，不折算。',
  },

  puzzle({ data, pick }) {
    return { menu: pick(data.menus), cpi: data.cpi, cpiBase: data.cpiBase };
  },

  async play(ctx, { menu, cpi, cpiBase }) {
    const { ui } = ctx;
    const [anchor, ...targets] = menu.d;
    const norm = (t) => String(t || '').trim().toLowerCase();
    const f = cpi && cpi[menu.y];
    ctx.log('menu', menu.id, menu.who, menu.y);
    ctx.stage.append(
      ui.panel({ kicker: `${menu.y} 年`, title: menu.who },
        ui.kv([
          ...(menu.where && norm(menu.where) !== norm(menu.who) ? [['地点', menu.where]] : []),
          ['场合', menu.ev || '日常菜单'],
          ['年份', `${menu.y}（距今 ${2026 - menu.y} 年）`],
          ['物价', f ? `那年的 $1 约等于今天的 $${f.toFixed(2)}` : '1913 年以前没有 CPI 数据，无法折算'],
          ['参照', ui.h('span', {}, `${anchor[0]} = `, ui.h('b', { class: 'mono' }, usd(anchor[1])))],
        ])));

    const { min, max } = rangeFor(menu.y);
    const rs = [];
    for (let i = 0; i < targets.length; i++) {
      const [name, price] = targets[i];
      const r = await ctx.estimate({
        title: `第 ${i + 1}/3 道：${name}`,
        prompt: `${menu.y} 年，同一份菜单上 ${anchor[0]} 卖 ${usd(anchor[1])}。这道卖多少？`,
        answer: price, min, max, log: true, step: 0.01, initial: anchor[1],
        format: usd, scoring: 'log', scale: 0.35,
      });
      ctx.log('estimate', name, price, r.guess);
      rs.push(r);
    }
    const res = ctx.combine(rs);
    const hi = targets.reduce((a, b) => (b[1] > a[1] ? b : a));
    const lo = targets.reduce((a, b) => (b[1] < a[1] ? b : a));
    const cols = [{ key: 'n', label: '菜' }, { key: 'p', label: '价格', num: true }, { key: 'r', label: '相对参照', num: true }, { key: 'k', label: '菜单内排位', num: true }];
    if (f) cols.push({ key: 'm', label: '今天约', num: true });
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({
        columns: cols,
        rows: menu.d.map(([n, p, pct], i) => ({
          n: i ? n : `${n}（参照）`, p: usd(p), r: i ? `×${(p / anchor[1]).toFixed(2)}` : '×1',
          k: `贵过 ${pct}%`, m: f ? money(p * f) : '',
        })),
      }),
      ui.callout(`这份菜单共有 ${menu.n} 道标价食物。${hi[0]}（${usd(hi[1])}）是 ${lo[0]}（${usd(lo[1])}）的 ${(hi[1] / lo[1]).toFixed(1)} 倍：`
        + `参照菜 ${anchor[0]} 在菜单里贵过 ${anchor[2]}% 的菜，所以比它排位高的主菜、肉类、海鲜价格更高，排位低的配菜、面包、甜点更低。`
        + (f ? `折成今天的美元，参照菜约 ${money(anchor[1] * f)}，估价时可以先想“今天这道菜多少钱”再除以 ${f.toFixed(1)}。` : ''),
        'good'));
    return res;
  },
};
