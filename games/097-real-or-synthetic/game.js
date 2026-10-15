export const ROUNDS = 5;
export const TELLS = {
  ar1: '高斯模型的波动大小始终均匀，缺少真实数据里“一阵平静、一阵剧烈”的波动聚集。',
  shuffle: '打乱后每月涨跌的分布与真实一样，但趋势和惯性被抹掉，曲线更像抖动的噪声。',
  block: '分块重组保留了 6 个月内的惯性，但块与块的衔接处会出现不自然的拐折。',
  phase: '随机相位保留了整体起伏的节奏，却把波动变成“完美正态”，极端的暴涨暴跌被磨平。',
};

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const steps = (x) => x.slice(1).map((v, i) => v - x[i]);
function corr(a, b) {
  const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? n / Math.sqrt(da * db) : 0;
}
/** Shape statistics of one 0–100 curve. jump = biggest one-month move (% of range); mom = lag-1 autocorrelation of
 *  monthly steps (momentum); clust = autocorrelation of |step| (volatility clustering). */
export function stats(v) {
  const d = steps(v), ad = d.map(Math.abs);
  return {
    jump: Math.max(...ad),
    mom: corr(d.slice(1), d.slice(0, -1)),
    clust: corr(ad.slice(1), ad.slice(0, -1)),
  };
}
const FEATS = {
  jump: { fmt: (x) => `${x.toFixed(1)}%`, up: '真实曲线里出现了更大的单月跳变，真实市场常有突然的暴涨暴跌，算法生成的起伏更温和', down: '真实曲线的单月跳变反而更小，伪造品里出现了更突兀的大跳', name: '最大单月变动（占全程）' },
  mom: { fmt: (x) => x.toFixed(2), up: '真实曲线的涨跌更有惯性，涨了之后更可能继续涨，曲线呈连续的上升段与下降段，而伪造品来回抖动', down: '真实曲线的月度涨跌更“松散”，伪造品里反而出现了更连贯的趋势段', name: '涨跌惯性（相邻月变动的相关系数）' },
  clust: { fmt: (x) => x.toFixed(2), up: '真实曲线的波动呈“聚集”：剧烈的月份往往扎堆出现，平静期与动荡期分明，伪造品的波动则起伏均匀', down: '这一题真实曲线的波动聚集并不明显，伪造品的波动反而更成团', name: '波动聚集度（相邻月变动幅度的相关系数）' },
};
/** Which statistic separates the real curve from the decoys most, and a sentence about this particular puzzle. */
export function giveaway(pz) {
  const all = [pz.real, ...pz.decoys.map((d) => d.v)].map(stats);
  let best = null;
  for (const k of Object.keys(FEATS)) {
    const vals = all.map((s) => s[k]), m = mean(vals), sd = Math.sqrt(mean(vals.map((v) => (v - m) ** 2))) || 1e-9;
    const dev = (vals[0] - mean(vals.slice(1))) / sd;
    if (!best || Math.abs(dev) > Math.abs(best.dev)) best = { k, dev, real: vals[0], fakes: vals.slice(1) };
  }
  const f = FEATS[best.k];
  return {
    ...best,
    text: `${f.name}：真实 ${f.fmt(best.real)}，三条伪造品分别为 ${best.fakes.map(f.fmt).join(' / ')}。${best.dev > 0 ? f.up : f.down}。`,
  };
}

/** Deterministic option order: real curve lands in a seeded slot. */
export function layout(pz, rng) {
  const items = [{ real: true, v: pz.real }, ...pz.decoys.map((d) => ({ real: false, v: d.v, m: d.m }))];
  const order = rng.shuffle(items);
  return { order, correct: order.findIndex((x) => x.real) };
}
const ymAdd = (ym, k) => { const [y, m] = ym.split('-').map(Number), t = y * 12 + m - 1 + k; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };

export default {
  meta: {
    num: 97,
    slug: 'real-or-synthetic',
    title: 'Real or Synthetic',
    tagline: '四条走势图，三条是算法按真实数据特征“伪造”的。找出真的那一条。',
    category: 'literacy',
    data: 'computed',
    howTo: [
      '每天 5 题。每题给出四条没有标注的 72 个月走势图（已缩放到同一高度范围），题目覆盖原油、股市、汇率、气温等不同领域。',
      '其中一条是真实的经济或气候数据，另外三条由算法根据它的统计特征伪造：AR(1) 高斯模型、打乱涨跌顺序、分块重组、随机相位。',
      '点选你认为真实的那条。可以留意真实数据常有的“波动聚集”“突然的大跳”和“持续的趋势”。',
      '答完后会揭晓真实序列的名称与时间段、每条伪造品的方法，并用这道题的实际数字告诉你破绽在哪。',
    ],
    scoring: '每题答对得 1 分，满分 5 分。纯靠乱猜平均只有 1.25 分，能稳定拿到 3 分以上说明你看得出真数据的“毛病”。',
    sources: [
      { name: 'NOAA / NASA 全球月温度距平（datasets/global-temp）', url: 'https://github.com/datasets/global-temp' },
      { name: 'NOAA GML 莫纳罗亚 CO₂（datasets/co2-ppm）', url: 'https://github.com/datasets/co2-ppm' },
      { name: 'EIA 布伦特、WTI 原油价格（datasets/oil-prices）', url: 'https://github.com/datasets/oil-prices' },
      { name: 'EIA 亨利港天然气价格（datasets/natural-gas）', url: 'https://github.com/datasets/natural-gas' },
      { name: 'Shiller 标普 500 指数、分红、盈利（datasets/s-and-p-500）', url: 'https://github.com/datasets/s-and-p-500' },
      { name: '美国 CPI（datasets/cpi-us）', url: 'https://github.com/datasets/cpi-us' },
      { name: '黄金价格（datasets/gold-prices）', url: 'https://github.com/datasets/gold-prices' },
      { name: '美国 10 年期国债收益率（datasets/bond-yields-us-10y）', url: 'https://github.com/datasets/bond-yields-us-10y' },
      { name: '美联储 H.10 汇率（datasets/exchange-rates）', url: 'https://github.com/datasets/exchange-rates' },
    ],
    dataNote: '真实序列取自上述公开 GitHub 镜像（datasets 组织）里的 NOAA、NASA、EIA、Shiller、美联储等月度数据，每题取一个 72 个月窗口（价格类取对数后再处理）。伪造序列在 build/ 中离线生成：以真实窗口的月度变化为素材，用 AR(1)、打乱、分块重组、随机相位四种代理数据法重建走势，所以伪造品是“计算生成”的，不是真实数据。原题建议的 FRED 的 CSV 接口没有跨域许可，浏览器无法直接读取，且该题并不要求当日新数据，因此使用离线快照。选题时已剔除过于平滑、一眼就能认出的窗口（如部分 CPI、黄金）。',
  },

  puzzle({ data, day }) {
    // data.puzzles is pre-ordered at build time so any 5 consecutive entries come from 5 different series
    const n = data.puzzles.length, ids = [];
    for (let i = 0; i < ROUNDS; i++) ids.push(data.puzzles[((((day - 1) * ROUNDS + i) % n) + n) % n].id);
    return { ids };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const byId = new Map(ctx.data.puzzles.map((x) => [x.id, x]));
    const pzs = p.ids.map((i) => byId.get(i));
    const lays = pzs.map((pz) => layout(pz, ctx.rng));
    const rounds = [];
    for (let i = 0; i < pzs.length; i++) {
      const pz = pzs[i], lay = lays[i], meta = ctx.data.series[pz.s];
      const options = [];
      for (let k = 0; k < 4; k++) {
        const body = await ui.plot((Plot, c) => ({
          height: 110, width: 150, margin: 4,
          x: { axis: null }, y: { axis: null, domain: [-3, 103] },
          marks: [Plot.lineY(lay.order[k].v, { stroke: c.ink, strokeWidth: 2 })],
        }), { axis: false });
        options.push({ label: 'ABCD'[k], body });
      }
      const letter = 'ABCD'[lay.correct];
      const list = lay.order.map((o, k) => `${'ABCD'[k]} ${o.real ? '真实' : ctx.data.methods[o.m]}`).join(' · ');
      rounds.push({
        prompt: `第 ${i + 1} 题：哪一条是真实数据？`,
        options, correct: lay.correct,
        explain: ui.h('span', {}, `真实的是 ${letter}：${meta.name}，${pz.from} 至 ${pz.to}。`, ui.h('br'), list),
      });
      ctx.log('round', i + 1, pz.s, pz.from, 'real =', letter);
    }
    const res = await ctx.rounds({ rounds, minWidth: 150 });
    const blocks = [];
    for (let i = 0; i < pzs.length; i++) {
      const pz = pzs[i], meta = ctx.data.series[pz.s], g = giveaway(pz);
      const ms = [...new Set(pz.decoys.map((d) => d.m))];
      const chart = await ui.plot((Plot, c) => ({
        height: 150, marginLeft: 8, marginBottom: 22,
        x: { label: null, ticks: 4, tickFormat: (k) => ymAdd(pz.from, Math.round(k)) },
        y: { axis: null, domain: [-3, 103] },
        marks: [
          ...pz.decoys.map((d, j) => Plot.lineY(d.v, { stroke: c.series[(j + 1) % c.series.length], strokeOpacity: 0.55, strokeWidth: 1.2 })),
          Plot.lineY(pz.real, { stroke: c.accent, strokeWidth: 2.6 }),
        ],
      }));
      blocks.push(ui.panel({ kicker: `第 ${i + 1} 题`, title: meta.name, plain: true },
        ui.kv([
          ['数据', `${pz.from} 至 ${pz.to} · ${meta.unit} · 来源 ${meta.src}`],
          ['这题的破绽', g.text],
          ['伪造方法', ms.map((m) => `${ctx.data.methods[m]}：${TELLS[m]}`).join('')],
        ]),
        chart,
        ui.h('div', { class: 'ds-muted', style: { fontSize: '12px' } }, '粗线为真实数据，细线为三条伪造品（均缩放到 0–100）。')));
    }
    res.detail = ui.h('div', { class: 'ds-stack' }, ...blocks,
      ui.callout('通用诀窍：真实数据常有“波动聚集”（平静期之后是剧烈期）、突然的大跳和持续的趋势；伪造品的起伏往往过于均匀，或过于抖动。', 'good'));
    return res;
  },
};
