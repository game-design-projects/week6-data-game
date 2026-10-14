// #23 Then Price — what did a dozen eggs cost back then? Scored by % error.
/** Price formatter: 2 decimals normally, 3 for sub-dime prices (electricity). */
export function fmtPrice(v) {
  return `$${v < 0.1 ? v.toFixed(3) : v.toFixed(2)}`;
}
/** Human date from 'YYYY-MM'. */
export const zhMonth = (ym) => `${ym.slice(0, 4)} 年 ${+ym.slice(5)} 月`;

export default {
  meta: {
    num: 23,
    slug: 'then-price',
    title: 'Then Price',
    tagline: '1983 年 3 月一打鸡蛋多少钱？猜三样东西当年的价格，按百分比误差计分。',
    category: 'money',
    data: 'snapshot',
    howTo: [
      '每天给你一个过去的月份和三样日常商品，每样会告诉你今天（最新月份）的美国平均价。',
      '拖动对数滑杆或直接输入，猜那个月的全国平均价（美元）。',
      '按百分比误差计分：偏差 0% 得 100 分，偏 35% 约 37 分。三题平均为总分。',
      '提示：通胀不是均匀的，鸡蛋、汽油、咖啡的涨幅各不相同。',
    ],
    scoring: '每题 100·exp(−百分比误差/35%)，三题取平均。',
    sources: [
      { name: 'BLS Average Price Data（经 FRED 镜像）', url: 'https://www.bls.gov/regions/mid-atlantic/data/averageretailfoodandenergyprices_usandmidwest_table.htm', note: 'U.S. city average，序列如 APU0000708111（鸡蛋）' },
      { name: 'FRED CSV 下载', url: 'https://fred.stlouisfed.org/series/APU0000708111' },
    ],
    dataNote: '价格为美国城市平均零售价，未做通胀调整。牛奶（加仑）自 1995 年、碎牛肉自 1984 年才有数据，因此对应月份不会出现。',
  },

  puzzle({ data, pick }) {
    const e = pick(data.pool);
    return { ym: e.ym, keys: e.items };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const now = data.asOf;
    const rows = p.keys.map((k) => {
      const it = data.items[k];
      return { k, it, then: it.s[p.ym], now: it.s[it.to] };
    });
    ctx.log('then-price', p.ym, rows.map((r) => `${r.k}:${r.then}->${r.now}`).join(' '));

    ctx.stage.append(ui.panel({ kicker: '穿越回去', title: zhMonth(p.ym) },
      ui.h('p', { class: 'ink2' }, `三样东西，猜它们在 ${zhMonth(p.ym)} 的美国全国平均零售价。今天（${zhMonth(now)}）的价格已经告诉你。`)));

    const results = [];
    for (const r of rows) {
      const res = await ctx.estimate({
        title: `${r.it.name}`,
        prompt: ui.h('div', { class: 'ink2' }, `${zhMonth(now)}：`, ui.h('b', { class: 'mono' }, `${fmtPrice(r.now)} ${r.it.per}`), `。${zhMonth(p.ym)} 呢？`),
        answer: r.then,
        min: r.now / 60,
        max: r.now * 1.2,
        log: true,
        step: 0.001,
        initial: r.now / 4,
        format: fmtPrice,
        scoring: 'pct',
        scale: 0.35,
      });
      results.push(res);
    }

    const out = ctx.combine(results);
    const pctOff = (g, a) => `${Math.round(Math.abs(g - a) / a * 100)}%`;
    const chart = await ui.plot((Plot, c) => ({
      height: 240,
      x: { label: null },
      y: { type: 'log', label: '价格指数（当月 = 100）', grid: true },
      color: { legend: true, domain: rows.map((r) => r.it.name), range: c.series },
      marks: [
        Plot.line(rows.flatMap((r) => Object.entries(r.it.s)
          .filter(([ym]) => ym >= p.ym)
          .map(([ym, v]) => ({ d: new Date(ym + '-01'), v: (v / r.then) * 100, n: r.it.name }))), { x: 'd', y: 'v', stroke: 'n' }),
      ],
    }));
    out.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({
        columns: [
          { key: 'n', label: '商品' }, { key: 'g', label: '你的猜测', num: true }, { key: 't', label: `${p.ym} 实际`, num: true },
          { key: 'e', label: '偏差', num: true }, { key: 'x', label: '至今涨', num: true },
        ],
        rows: rows.map((r, i) => ({ n: r.it.name, g: fmtPrice(results[i].guess), t: fmtPrice(r.then), e: pctOff(results[i].guess, r.then), x: `×${(r.now / r.then).toFixed(1)}` })),
      }),
      chart,
      ui.h('div', { class: 'small muted' }, '规律：食品大多涨 2–5 倍，汽油、咖啡波动更大；先用“今天价格 ÷ 总体涨幅”做锚点，再按商品特性上下修正。'));
    return out;
  },
};
