// #97 Real or Synthetic — four unlabeled curves, three are computer-made look-alikes. Find the real one.
export const TELLS = {
  ar1: '高斯模型的波动大小始终均匀，没有真实数据里“一阵平静、一阵剧烈”的波动聚集，也很少有突然的大跳。',
  shuffle: '打乱后每月涨跌的分布和真实一样，但趋势、惯性消失了——曲线看起来像抖动的噪声，缺少持续的上升或下跌段。',
  block: '分块重组保留了 6 个月内的惯性，但块与块的衔接处常出现不自然的拐折。',
  phase: '随机相位保留了整体的起伏节奏，却把波动变成了“完美正态”：没有极端的暴涨暴跌，起伏均匀得过分。',
};

/** Deterministic option order: real curve lands in a seeded slot. */
export function layout(pz, rng) {
  const items = [{ real: true, v: pz.real }, ...pz.decoys.map((d) => ({ real: false, v: d.v, m: d.m }))];
  const order = rng.shuffle(items);
  return { order, correct: order.findIndex((x) => x.real) };
}

export default {
  meta: {
    num: 97,
    slug: 'real-or-synthetic',
    title: 'Real or Synthetic',
    tagline: '四条走势图，三条是电脑按真实数据特征“伪造”的。找出真的那一条。',
    category: 'literacy',
    data: 'computed',
    howTo: [
      '每天 3 题。每题给出四条没有标注的 72 个月走势图（已缩放到同一范围）。',
      '其中一条是真实的经济或气候数据，另外三条由算法根据它的统计特征伪造：高斯模型、打乱顺序、分块重组或随机相位。',
      '点选你认为真实的那条。看真实数据特有的“波动聚集”“突然跳变”“持续趋势”。',
      '答完后会告诉你真实序列是什么、每条伪造品用的什么方法、破绽在哪。',
    ],
    scoring: '每题答对得 1 分，满分 3 分。随机乱猜的期望只有 0.75 分。',
    sources: [
      { name: 'NOAA / NASA 全球温度距平、莫纳罗亚 CO₂', url: 'https://github.com/datasets/global-temp' },
      { name: 'EIA 原油与天然气价格', url: 'https://github.com/datasets/oil-prices' },
      { name: 'Shiller 标普 500 / 美国 CPI / 10 年期国债 / 美联储汇率 / 黄金', url: 'https://github.com/datasets' },
      { name: 'FRED（美联储圣路易斯分行，同源数据）', url: 'https://fred.stlouisfed.org/' },
    ],
    dataNote: '真实序列来自公开 GitHub 镜像（datasets 组织）中的 NOAA、EIA、Shiller、美联储等月度数据，取 72 个月窗口。伪造序列在 build/ 中离线生成：用真实窗口的月度变化（均值、方差、自相关）拟合 AR(1)、打乱、分块重组、随机相位四种代理数据法，再累加还原为走势。FRED 直连不稳定，故改用镜像。',
  },

  puzzle({ data, day }) {
    // interleave series round-robin so consecutive pool entries come from different series
    const bySeries = new Map();
    for (const q of data.puzzles) (bySeries.get(q.s) || bySeries.set(q.s, []).get(q.s)).push(q);
    const lists = [...bySeries.values()], flat = [];
    for (let k = 0; flat.length < data.puzzles.length; k++) for (const l of lists) if (l[k]) flat.push(l[k]);
    const n = flat.length, ids = [];
    for (let i = 0; i < 3; i++) ids.push(flat[(((day * 3 + i) % n) + n) % n].id);
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
          x: { axis: null }, y: { axis: null, domain: [0, 100] },
          marks: [Plot.lineY(lay.order[k].v, { stroke: c.accent, strokeWidth: 2 })],
        }), { axis: false });
        options.push({ label: 'ABCD'[k], body });
      }
      const list = lay.order.map((o, k) => `${'ABCD'[k]}：${o.real ? '真实' : ctx.data.methods[o.m]}`).join('　');
      const tells = [...new Set(lay.order.filter((o) => !o.real).map((o) => o.m))].map((m) => `${ctx.data.methods[m]}：${TELLS[m]}`);
      rounds.push({
        prompt: `第 ${i + 1} 题：哪一条是真实数据？`,
        options, correct: lay.correct,
        explain: `真实的是 ${'ABCD'[lay.correct]}：${meta.name}（${pz.from} 至 ${pz.to}）。${list}`,
      });
      ctx.log('round', i + 1, pz.s, pz.from, 'real =', 'ABCD'[lay.correct]);
    }
    const res = await ctx.rounds({ rounds, minWidth: 150 });
    res.detail = ui.h('div', { class: 'ds-stack' },
      ...pzs.map((pz, i) => {
        const meta = ctx.data.series[pz.s];
        const ms = [...new Set(pz.decoys.map((d) => d.m))];
        return ui.kv([
          [`第 ${i + 1} 题`, `${meta.name}，${pz.from} 至 ${pz.to}（${meta.unit}，来源 ${meta.src}）`],
          ['伪造品破绽', ms.map((m) => `${ctx.data.methods[m]}：${TELLS[m]}`).join('　')],
        ]);
      }),
      ui.callout('通用诀窍：真实数据常有“波动聚集”（平静期之后是剧烈期）、突然的大跳、以及持续的趋势；伪造品的起伏往往过于均匀。', 'good'));
    return res;
  },
};
