// #25 Unlabeled — a macro time series with the axes removed and recessions shaded.
// Name the indicator, then date the 15-year window.
const WIN = 180; // months shown

/** Candidate windows: every series, every 2 years (24 months). Pure helper. */
export function windows(data) {
  const out = [];
  for (const s of data.series) for (let off = 0; off + WIN <= s.vals.length; off += 24) out.push({ id: s.id, off });
  return out;
}
export const monthKey = (start, off) => { const [y, m] = start.split('-').map(Number); const t = y * 12 + m - 1 + off; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; };
/** 0..100 for the year guess: exact = 100, 6 years off ≈ 37. */
export const yearScore = (guess, answer) => Math.round(100 * Math.exp(-Math.abs(guess - answer) / 6));
export const recAt = (rec, y, m) => {
  const [ry, rm] = rec.start.split('-').map(Number);
  return rec.vals[(y - ry) * 12 + (m - rm)] === '1';
};

export default {
  meta: {
    num: 25,
    slug: 'unlabeled',
    title: 'Unlabeled',
    tagline: '去掉坐标轴的美国宏观曲线，只留下衰退期阴影。先认出是什么指标，再判断是哪个年代。',
    category: 'money',
    data: 'snapshot',
    howTo: [
      '图里是一条 15 年的美国宏观经济月度曲线，没有刻度和单位，灰色竖条是官方认定的衰退期（NBER）。',
      '第一步：从 4 个候选里认出这是哪个指标。看它在衰退阴影里怎么动：失业率上冲、利率下调、工业产出下跌。',
      '第二步：猜这段曲线从哪一年开始。用大事件定位：1970s 通胀、1981 年利率顶点、2008 年危机、2020 年疫情。',
      '计分：指标 50 分（答对才有），年份 50 分，每差约 6 年降到约三分之一。',
    ],
    scoring: '指标 50 分 + 50 × e^(−年份误差/6)。',
    sources: [
      { name: 'FRED（圣路易斯联储）', url: 'https://fred.stlouisfed.org/', note: 'UNRATE、CPIAUCSL、FEDFUNDS、GS10、INDPRO、PAYEMS、HOUST、UMCSENT、M2SL、DEXJPUS、GDPC1、TOTALSA、MORTGAGE30US、CIVPART、PSAVERT' },
      { name: 'NBER 衰退日期（FRED: USREC）', url: 'https://fred.stlouisfed.org/series/USREC' },
    ],
    dataNote: '日度/周度数据取月均值，季度 GDP 按月补齐，价格与产出类指标换算为同比变化。2025 年 10 月联邦停摆造成部分数据缺口，相关序列截止到缺口之前。',
  },

  puzzle({ data, pick }) {
    const w = pick(windows(data));
    const s = data.series.find((x) => x.id === w.id);
    const a = monthKey(s.start, w.off);
    const decoys = data.series.filter((x) => x.id !== s.id).map((x) => x.id);
    return { id: s.id, off: w.off, year: a.y, month: a.m, decoyOrder: decoys };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const s = data.series.find((x) => x.id === p.id);
    const vals = s.vals.slice(p.off, p.off + WIN);
    const pts = vals.map((v, i) => {
      const { y, m } = monthKey(s.start, p.off + i);
      return { i, v, rec: recAt(data.rec, y, m) };
    });
    const spans = [];
    for (const q of pts) {
      if (!q.rec) continue;
      const last = spans.at(-1);
      if (last && last.x2 === q.i) last.x2 = q.i + 1; else spans.push({ x1: q.i, x2: q.i + 1 });
    }
    ctx.log('puzzle', p.id, p.year, 'recessions', spans.length);

    const chart = await ui.plot((Plot, c) => ({
      height: 260,
      marginLeft: 8, marginRight: 8, marginBottom: 8, marginTop: 8,
      x: { axis: null, domain: [0, WIN] },
      y: { axis: null, grid: false },
      marks: [
        Plot.rectX(spans, { x1: 'x1', x2: 'x2', fill: c.rule, fillOpacity: 0.55 }),
        Plot.lineY(pts, { x: 'i', y: 'v', stroke: c.accent, strokeWidth: 2 }),
      ],
    }), { axis: false });
    ctx.stage.append(ui.panel({ kicker: '线索', title: '没有标签的曲线' }, chart,
      ui.h('div', { class: 'small muted' }, `15 年 · 每个点是一个月 · 灰色竖条 = 衰退期（${spans.length} 次）`)));

    // distractors: the 3 decoys shuffled by the daily rng, so the options are fixed per day
    const names = new Map(data.series.map((x) => [x.id, x.zh]));
    const decoys = p.decoyOrder.slice().sort((a, b) => ((a + p.id).split('').reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7)) - ((b + p.id).split('').reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7))).slice(0, 3);
    const ids = ctx.rng.shuffle([p.id, ...decoys]);
    const r1 = await ctx.rounds({
      rounds: [{ prompt: '这条曲线是什么指标？', options: ids.map((id) => ({ label: names.get(id) })), correct: ids.indexOf(p.id), explain: s.tip }],
      minWidth: 160,
    });

    const first = Math.ceil((s.vals.length ? Number(s.start.slice(0, 4)) : 1950));
    const lastStart = monthKey(s.start, s.vals.length - WIN).y;
    const r2 = await ctx.estimate({
      title: '这段曲线从哪一年开始？',
      prompt: '15 年的窗口，估一下起点年份。',
      answer: p.year, min: first, max: lastStart, step: 1, initial: Math.round((first + lastStart) / 2),
      format: (v) => `${Math.round(v)} 年`,
      scoring: yearScore,
    });

    const res = ctx.combine([
      { ...r1, score: r1.score * 50, max: 50 },
      { ...r2, score: r2.score / 2, max: 50 },
    ]);
    res.detail = ui.kv([
      ['指标', `${s.zh}（FRED: ${s.id}）${s.yoy ? '，同比变化' : ''}`],
      ['时间段', `${p.year} 年 ${p.month} 月起的 15 年`],
      ['怎么认出来', s.tip],
      ['衰退次数', `${spans.length} 次灰色阴影（NBER 官方认定）`],
    ]);
    return res;
  },
};
