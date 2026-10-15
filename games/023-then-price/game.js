// #23 Then Price — what did a dozen eggs cost back then? Scored by % error.
/** Price formatter: 2 decimals normally, 3 for sub-dime prices (electricity). */
export function fmtPrice(v) {
  return `$${v < 0.1 ? v.toFixed(3) : v.toFixed(2)}`;
}
/** Human date from 'YYYY-MM'. */
export const zhMonth = (ym) => `${ym.slice(0, 4)} 年 ${+ym.slice(5)} 月`;

/** Symmetric ratio scoring (0..1): 1.6× too high and 1.6× too low both ≈ 37%. */
export const PRICE_SCALE = Math.log(1.6);
export function priceScore(guess, answer) {
  if (!(guess > 0) || !(answer > 0)) return 0;
  return Math.exp(-Math.abs(Math.log(guess / answer)) / PRICE_SCALE);
}
/** Slider bounds depend only on today's price, never on the answer. */
export const sliderRange = (now) => ({ min: now / 20, max: now * 1.5, initial: now / 2.5 });

/** Facts that explain one item: multiple, annual rate, comparison with CPI. */
export function explainItem(it, cpi, ym) {
  const then = it.s[ym];
  const now = it.s[it.to];
  const mult = now / then;
  const years = (Date.UTC(+it.to.slice(0, 4), +it.to.slice(5) - 1) - Date.UTC(+ym.slice(0, 4), +ym.slice(5) - 1)) / (365.25 * 864e5);
  const cpiMult = cpi[it.to] / cpi[ym];
  const rel = mult / cpiMult;
  return { then, now, mult, cpiMult, rel, annual: years > 0 ? mult ** (1 / years) - 1 : 0, years };
}
const relWord = (rel) => (rel > 1.15 ? '涨得比总体物价快' : rel < 0.87 ? '涨得比总体物价慢' : '和总体物价涨得差不多');

export default {
  meta: {
    num: 23,
    slug: 'then-price',
    title: 'Then Price',
    tagline: '1983 年 3 月一打鸡蛋多少钱？穿越回某个月，猜三样日常商品当年的价格，按百分比误差计分。',
    category: 'money',
    data: 'snapshot',
    howTo: [
      '每天给你一个过去的月份和三样日常商品（蛋奶、肉、蔬果、主食、饮品、能源里各取不同的类别），并告诉你每样商品最新一期的美国平均价。',
      '拖动对数滑杆或直接输入，猜那个月的全国平均零售价（美元，名义价格，未做通胀调整）。',
      '计分看误差比例：猜中得 100 分，高估或低估 1.6 倍约 37 分，高估或低估 3 倍以上接近 0 分。三题各自计分，相加为总分（满分 300）。',
      '提示：先估计这段时间总体物价涨了多少，再想这样商品比总体涨得快还是慢——揭晓后会用同期 CPI 对照给你看。',
    ],
    scoring: '每题 100·exp(−|ln(猜测÷实际)| ÷ ln 1.6)，高估和低估对称；三题相加，满分 300。',
    sources: [
      { name: 'BLS Average Price Data（经 FRED 镜像下载）', url: 'https://www.bls.gov/regions/mid-atlantic/data/averageretailfoodandenergyprices_usandmidwest_table.htm', note: 'U.S. city average，序列如 APU0000708111（鸡蛋）' },
      { name: 'FRED 序列示例：鸡蛋', url: 'https://fred.stlouisfed.org/series/APU0000708111' },
      { name: 'BLS 公共 API：CPI-U 全项目（CUUR0000SA0）', url: 'https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0', note: '用于揭晓时对照总体物价' },
    ],
    dataNote: '价格为美国城市平均零售价（名义价格）。牛奶（加仑）自 1995 年、碎牛肉自 1984 年才有数据，因此早期月份不会出现；各商品「最新一期」可能不是同一个月，题目里会分别标明。BLS 在 2025 年 10 月因停摆缺数据，该月不会出题。数据为快照：想法里没有「当天」的要求，题目是历史月份，因此没有接入实时接口（BLS 公共 API 可跨域，但每天只能查询 25 次，且历史价格本身不会变化）。',
  },

  puzzle({ data, pick }) {
    const e = pick(data.pool);
    return { ym: e.ym, keys: e.items };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const rows = p.keys.map((k) => {
      const it = data.items[k];
      return { k, it, ...explainItem(it, data.cpi, p.ym) };
    });
    ctx.log('then-price', p.ym, rows.map((r) => `${r.k}:${r.then}->${r.now}`).join(' '));

    ctx.stage.append(ui.panel({ kicker: '穿越回去', title: zhMonth(p.ym) },
      ui.h('p', { class: 'ink2' }, `三样东西，猜它们在 ${zhMonth(p.ym)} 的美国全国平均零售价。每样商品最新一期的价格已经告诉你，名义价格，没有扣除通胀。`)));

    const results = [];
    for (const r of rows) {
      const rg = sliderRange(r.now);
      const res = await ctx.estimate({
        title: r.it.name,
        prompt: ui.h('div', { class: 'ink2' }, `${zhMonth(r.it.to)}：`, ui.h('b', { class: 'mono' }, `${fmtPrice(r.now)} ${r.it.per}`), `。${zhMonth(p.ym)} 呢？`),
        answer: r.then,
        min: rg.min,
        max: rg.max,
        log: true,
        step: 0.001,
        initial: rg.initial,
        format: fmtPrice,
        scoring: priceScore,
      });
      results.push(res);
    }

    const out = ctx.combine(results);
    const pctOff = (g, a) => `${g >= a ? '高' : '低'} ${Math.round(Math.abs(g - a) / a * 100)}%`;
    const cpiLine = Object.keys(data.cpi).filter((ym) => ym >= p.ym).map((ym) => ({ d: new Date(ym + '-01'), v: (data.cpi[ym] / data.cpi[p.ym]) * 100 }));
    const chart = await ui.plot((Plot, c) => ({
      height: 240,
      x: { label: null },
      y: { type: 'log', label: '价格指数（当月 = 100）', grid: true },
      color: { legend: true, domain: [...rows.map((r) => r.it.name), '总体物价 CPI'], range: [...c.series.slice(0, rows.length), c.muted] },
      marks: [
        Plot.line(rows.flatMap((r) => Object.entries(r.it.s)
          .filter(([ym]) => ym >= p.ym)
          .map(([ym, v]) => ({ d: new Date(ym + '-01'), v: (v / r.then) * 100, n: r.it.name }))), { x: 'd', y: 'v', stroke: 'n' }),
        Plot.line(cpiLine, { x: 'd', y: 'v', stroke: () => '总体物价 CPI', strokeDasharray: '4 3', strokeWidth: 2 }),
      ],
    }));
    out.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({
        columns: [
          { key: 'n', label: '商品' }, { key: 'g', label: '你的猜测', num: true }, { key: 't', label: `${p.ym} 实际`, num: true },
          { key: 'e', label: '偏差', num: true }, { key: 'x', label: '至今涨', num: true },
        ],
        rows: rows.map((r, i) => ({ n: r.it.name, g: fmtPrice(results[i].guess), t: fmtPrice(r.then), e: pctOff(results[i].guess, r.then), x: `×${r.mult.toFixed(1)}` })),
      }),
      chart,
      ...rows.map((r) => ui.h('div', { class: 'small ink2' },
        ui.h('b', null, r.it.name), `：${zhMonth(p.ym)} ${fmtPrice(r.then)} → ${zhMonth(r.it.to)} ${fmtPrice(r.now)}，涨了 ×${r.mult.toFixed(1)}（年均 ${(r.annual * 100).toFixed(1)}%）；同期总体物价（CPI）涨 ×${r.cpiMult.toFixed(1)}，所以它${relWord(r.rel)}。`)),
      ui.h('div', { class: 'small muted' }, `窍门：先用「最新价 ÷ 总体物价涨幅」得到一个基准价，再按商品特性上下修正——能源和咖啡波动大，鸡蛋受禽流感冲击大，面粉、糖这类主食涨得比总体慢。`));
    return out;
  },
};
