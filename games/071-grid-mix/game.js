// #71 Grid Mix — one day of hourly generation by fuel for a US balancing authority; name the grid.
// Duck curve = solar-heavy west, flat nuclear band = Southeast/Northeast, hydro = Northwest.

export const FUEL_ZH = { coal: '煤', gas: '天然气', nuclear: '核电', oil: '石油', hydro: '水电', solar: '太阳能', wind: '风电', other: '其他' };

/** Per-fuel daily totals, shares and solar peak hour from a puzzle's hourly arrays (values in `unit` MW). */
export function summarize(m, unit = 10) {
  const fuels = Object.keys(m);
  const tot = Object.fromEntries(fuels.map((k) => [k, m[k].reduce((a, b) => a + b, 0) * unit]));
  const all = fuels.reduce((a, k) => a + tot[k], 0) || 1;
  const share = Object.fromEntries(fuels.map((k) => [k, tot[k] / all]));
  const hourly = m[fuels[0]].map((_, i) => fuels.reduce((a, k) => a + m[k][i], 0) * unit);
  const solarPeak = m.solar ? m.solar.indexOf(Math.max(...m.solar)) : -1; // 0-based hour-ending index
  return { tot, share, all, hourly, peak: Math.max(...hourly), mean: all / 24, solarPeak, dominant: fuels.reduce((a, k) => (tot[k] > tot[a] ? k : a), fuels[0]) };
}

export const TZ_ZH = { '-5': '东部时间', '-6': '中部时间', '-7': '山地时间', '-8': '太平洋时间' };
const pct0 = (x) => `${Math.round(x * 100)}%`;
const hh = (i) => `${String(((i % 24) + 24) % 24).padStart(2, '0')}:00`;

/** Puzzle-specific "why it gave itself away" sentences, computed from the hourly arrays and the BA's typical mix. */
export function explain(m, ans, unit = 10) {
  const S = summarize(m, unit);
  const notes = [];
  const typTop = Object.entries(ans.typ ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${FUEL_ZH[k]} ${v}%`).join('、');
  const lo = S.hourly.indexOf(Math.min(...S.hourly)), hi = S.hourly.indexOf(S.peak);
  notes.push(`当天用电（发电）最低在 ${hh(lo)} 前后，约 ${gw(Math.min(...S.hourly))}；最高在 ${hh(hi)} 前后，约 ${gw(S.peak)}，峰谷比 ${(S.peak / Math.min(...S.hourly)).toFixed(2)}。`);
  if (S.share.solar > 0.04) {
    const gasDay = m.gas ? m.gas.slice(10, 15).reduce((a, b) => a + b, 0) : 0;
    const gasEve = m.gas ? m.gas.slice(18, 22).reduce((a, b) => a + b, 0) : 0;
    notes.push(`太阳能占 ${pct0(S.share.solar)}，在 ${hh(S.solarPeak)} 前后达到峰值，傍晚随日落退出${gasEve / 4 > gasDay / 5 * 1.15 ? '，天然气随之抬升——这就是“鸭子曲线”' : ''}。`);
  }
  if (S.share.nuclear > 0.08) {
    const a = m.nuclear, mean = a.reduce((x, y) => x + y, 0) / 24, dev = Math.max(...a.map((v) => Math.abs(v - mean))) / (mean || 1);
    notes.push(`核电占 ${pct0(S.share.nuclear)}${dev < 0.1 ? '，全天几乎是一条平直的带子（基荷）' : '，当天有机组出力变化'}。`);
  }
  if (S.share.hydro > 0.15) notes.push(`水电占 ${pct0(S.share.hydro)}：多水的流域（哥伦比亚河、田纳西河、圣劳伦斯河等）才有这种结构。`);
  if (S.share.wind > 0.12) notes.push(`风电占 ${pct0(S.share.wind)}，夜间通常更强，常见于平原和德州。`);
  if (S.share.coal > 0.3) notes.push(`煤占 ${pct0(S.share.coal)}，典型的中部/东部传统电网。`);
  if (S.share.gas > 0.6) notes.push(`天然气占 ${pct0(S.share.gas)}，结构高度依赖燃气。`);
  if (notes.length === 1) notes.push(`主力是${FUEL_ZH[S.dominant]}（${pct0(S.share[S.dominant])}），结构偏单一，要靠规模和时区来缩小范围。`);
  if (typTop) notes.push(`${ans.name} 的常年平均结构是：${typTop}，和这一天的形状对得上。`);
  return { S, notes };
}

const pct = (x) => `${Math.round(x * 100)}%`;
const gw = (mw) => (mw >= 1000 ? `${(mw / 1000).toFixed(1)} GW` : `${Math.round(mw)} MW`);

export default {
  meta: {
    num: 71,
    slug: 'grid-mix',
    title: 'Grid Mix',
    tagline: '某个美国电网区域一整天、每小时的发电结构。鸭子曲线、水电和核电基荷，都是暴露身份的破绽。',
    category: 'society',
    data: 'snapshot',
    howTo: [
      '图里是某一天（当地时间 0–23 时）每小时的发电量，按燃料堆叠：煤、天然气、核电、水电、太阳能、风电等。',
      '看形状：中午凹下去的“鸭子曲线”说明太阳能多的西部；一条平直的核电底座像东南部或东北部；水电占大头多半在西北。',
      '从列表里选一个电网区域，最多猜 6 次。每猜错一次多解锁一条线索（规模、时区、燃料占比、所在区域……）。',
      '每次猜测会告诉你：区域是否相同、规模比答案大还是小、答案在你猜的地方的东边还是西边。',
    ],
    scoring: '第 1 次猜中 100 分，第 2 次 83 分，之后每多用一次少约 17 分，第 6 次猜中 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'EIA-930 Hourly Electric Grid Monitor（Balance 半年文件）', url: 'https://www.eia.gov/electricity/gridmonitor/', note: '2025-07 至 2026-06 的每小时分燃料净发电量' },
    ],
    dataNote: 'EIA 的 v2 API 需要密钥，而公开的半年 CSV（约 50 MB）没有 CORS 头，浏览器无法直接拉取“昨天”的数据，所以用构建脚本下载的快照（取“调整后”数值，缺失时用原始值）。快照覆盖 2025-07-01 至 2026-10-14，题库由 28 个大型电网区域、各 6 个日期（分散在各个季节）组成，共 168 题；夏令时切换日已排除。图中的纵轴是绝对发电量，所以规模本身也是线索。时区线索给的是标准时间，图中小时为夏令时期间的当地时间。',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return { ba: p.ba, date: p.date };
  },

  async play(ctx, pz) {
    const { ui, core } = ctx;
    const D = ctx.data;
    const p = D.puzzles.find((x) => x.ba === pz.ba && x.date === pz.date);
    const bas = new Map(D.bas.map((b) => [b.id, b]));
    const ans = bas.get(pz.ba);
    const S = summarize(p.m, D.unit);
    ctx.log('puzzle', pz.ba, pz.date, 'dominant', S.dominant);

    const rows = [];
    D.fuels.forEach((k) => p.m[k].forEach((v, h) => rows.push({ fuel: FUEL_ZH[k], h, mw: v * D.unit })));
    const order = D.fuels.map((k) => FUEL_ZH[k]);
    const chart = await ui.plot((Plot, c) => ({
      height: 280,
      marginLeft: 52,
      marginBottom: 34,
      x: { label: null, domain: [0, 23], ticks: [0, 3, 6, 9, 12, 15, 18, 21], tickFormat: (v) => `${v}时` },
      y: { label: null, grid: true, tickFormat: (v) => `${v / 1000} GW` },
      color: { domain: order, range: ['#6f6f6f', c.accent, '#3a86c8', '#8a7f6a', '#2fa6a0', '#f0c020', '#7bc47f', '#b08bd0'], legend: true },
      marks: [Plot.areaY(rows, { x: 'h', y: 'mw', fill: 'fuel', order: order, tip: false }), Plot.ruleY([0])],
    }), { height: 320 });

    const clues = [
      ui.h('div', chart, ui.h('div', { class: 'muted', style: { fontSize: '12px' } }, '横轴：当地时间；纵轴：全网每小时发电量（按燃料堆叠）')),
      `这一天（${pz.date}）全天平均发电 ${gw(S.mean)}，最高一小时 ${gw(S.peak)}。`,
      `时区：${TZ_ZH[ans.off] ?? ''}，标准时间 UTC${ans.off >= 0 ? '+' : '−'}${Math.abs(ans.off)}。`,
      ui.h('div', '全天各燃料占比：', ui.h('div', { class: 'ds-row', style: { flexWrap: 'wrap', gap: '8px', marginTop: '6px' } },
        D.fuels.filter((k) => S.share[k] >= 0.005).sort((a, b) => S.share[b] - S.share[a]).map((k) => ui.badge(`${FUEL_ZH[k]} ${pct(S.share[k])}`)))),
      `所在区域：${ans.area}。`,
      `代码首字母：${ans.id[0]}。`,
    ];

    const res = await ctx.guess({
      options: D.bas.map((b) => ({ id: b.id, label: b.name, hint: b.id, aliases: [b.id, b.area] })),
      answer: ans.id,
      maxGuesses: 6,
      title: '这是哪个电网区域？',
      placeholder: '输入名称或代码（如 CISO）…',
      clues,
      cluesTitle: '发电结构与线索',
      columns: ['区域', '规模', '时区'],
      near: (g, a) => bas.get(g.id).area === bas.get(a.id).area,
      feedback: (g) => {
        const gb = bas.get(g.id);
        if (gb.id === ans.id) return [{ text: '✓', state: 'hit' }, { text: '✓', state: 'hit' }, { text: '✓', state: 'hit' }];
        const ratio = gb.mean / ans.mean;
        const dz = ans.off - gb.off;
        return [
          { text: gb.area === ans.area ? '同区' : '不同', state: gb.area === ans.area ? 'hit' : 'miss' },
          { text: `${ratio > 1 ? '↓ 更小' : '↑ 更大'} ×${(ratio > 1 ? ratio : 1 / ratio).toFixed(1)}`, state: ratio > 0.6 && ratio < 1.6 ? 'near' : undefined, num: true },
          { text: dz === 0 ? '同时区' : `${dz > 0 ? '→ 东' : '← 西'} ${Math.abs(dz)}h`, state: dz === 0 ? 'hit' : undefined, num: true },
        ];
      },
    });

    const { notes } = explain(p.m, ans, D.unit);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['答案', `${ans.name}（${ans.id}）`], ['区域', ans.area], ['日期', pz.date], ['日均发电', gw(S.mean)], ['主力燃料', `${FUEL_ZH[S.dominant]} ${pct(S.share[S.dominant])}`]]),
      ...notes.map((n) => ui.h('div', { class: 'ink2' }, n)));
    return res;
  },
};
