// #25 Unlabeled — a macro time series with the axes removed and recessions shaded.
// Name the indicator (typed, from a list of 15), then date the 15-year window.
export const WIN = 180; // months shown
export const MIN_YEAR = 1948; // earliest window start, so one shared slider range fits every indicator
const STEP = 15; // months between candidate windows (not a multiple of 12, so start months vary)

export const monthKey = (start, off) => { const [y, m] = start.split('-').map(Number); const t = y * 12 + m - 1 + off; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; };

/** Candidate windows: every series, every 15 months, starting no earlier than MIN_YEAR. Pure helper. */
export function windows(data) {
  const out = [];
  for (const s of data.series) {
    for (let off = 0; off + WIN <= s.vals.length; off += STEP) if (monthKey(s.start, off).y >= MIN_YEAR) out.push({ id: s.id, off });
  }
  return out;
}
/** Shared slider range so the range itself does not reveal the indicator. */
export function yearRange(data) {
  let hi = MIN_YEAR;
  for (const w of windows(data)) { const s = data.series.find((x) => x.id === w.id); hi = Math.max(hi, monthKey(s.start, w.off).y); }
  return [MIN_YEAR, hi];
}
/** 0..100 for the year guess: exact = 100, 6 years off ≈ 37. */
export const yearScore = (guess, answer) => Math.round(100 * Math.exp(-Math.abs(guess - answer) / 6));
/** 0..50 for the indicator: 1st guess 50, 2nd 33, 3rd 17, miss 0. */
export const nameScore = (n, won, max = 3) => (won ? Math.round((50 * (max - n + 1)) / max) : 0);
export const recAt = (rec, y, m) => {
  const [ry, rm] = rec.start.split('-').map(Number);
  return rec.vals[(y - ry) * 12 + (m - rm)] === '1';
};
export const fmtV = (v) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : String(Math.round(v * 10) / 10));
const ym = (k) => `${k.y} 年 ${k.m} 月`;

/** Everything the view and the result card need about one puzzle window. Pure. */
export function windowInfo(data, p) {
  const s = data.series.find((x) => x.id === p.id);
  const vals = s.vals.slice(p.off, p.off + WIN);
  const pts = vals.map((v, i) => { const k = monthKey(s.start, p.off + i); return { i, v, k, rec: recAt(data.rec, k.y, k.m) }; });
  const spans = [];
  for (const q of pts) {
    if (!q.rec) continue;
    const last = spans.at(-1);
    if (last && last.x2 === q.i) { last.x2 = q.i + 1; last.end = q.k; } else spans.push({ x1: q.i, x2: q.i + 1, start: q.k, end: q.k });
  }
  let hi = pts[0]; let lo = pts[0];
  for (const q of pts) { if (q.v > hi.v) hi = q; if (q.v < lo.v) lo = q; }
  // net move across each recession that starts inside the window
  const moves = spans.filter((sp) => sp.x1 > 0).map((sp) => pts[sp.x2 - 1].v - pts[sp.x1 - 1].v);
  const up = moves.filter((d) => d > 0).length;
  return { s, pts, spans, hi, lo, up, down: moves.length - up, nMoves: moves.length };
}

export default {
  meta: {
    num: 25,
    slug: 'unlabeled',
    title: 'Unlabeled',
    tagline: '去掉坐标轴的美国宏观曲线，只留下衰退期阴影。先说出是什么指标，再判断是哪个年代。',
    category: 'money',
    data: 'snapshot',
    howTo: [
      '图里是一条 15 年的美国宏观经济月度曲线，没有刻度和单位，灰色竖条是 NBER 认定的衰退期。',
      '第一步：在输入框里打字，从 15 个候选指标里选出它（支持中文名和 FRED 代码）。最多猜 3 次，每猜错一次解锁一条线索：类型、数值范围、数据起点。',
      '第二步：猜这段曲线从哪一年开始。用大事件定位：1970s 通胀、1981 年利率顶点、2008 年危机、2020 年疫情。',
      '计分：指标 50 分（第 1 次猜中 50、第 2 次 33、第 3 次 17），年份 50 分（每差约 6 年降到约三分之一）。',
    ],
    scoring: '指标 50 × (4 − 猜测次数) / 3，加上年份 50 × e^(−年份误差/6)。',
    sources: [
      { name: 'FRED（圣路易斯联储）', url: 'https://fred.stlouisfed.org/', note: 'UNRATE、CPIAUCSL、FEDFUNDS、GS10、INDPRO、PAYEMS、HOUST、UMCSENT、M2SL、DEXJPUS、GDPC1、TOTALSA、MORTGAGE30US、CIVPART、PSAVERT' },
      { name: 'NBER 衰退日期（FRED: USREC）', url: 'https://fred.stlouisfed.org/series/USREC' },
    ],
    dataNote: '数据为快照：FRED 的 CSV 接口没有 CORS 头，浏览器无法直接取数，所以由 build/ 脚本离线下载。日度/周度数据取月均值，季度 GDP 按月补齐（曲线呈阶梯），价格与产出类指标换算为同比变化。2025 年 10 月联邦停摆造成数据缺口，UNRATE、CPI 等序列截止到缺口之前；消费者信心指数始于 1978 年。题目窗口起点不早于 1948 年。',
  },

  puzzle({ data, pick }) {
    const w = pick(windows(data));
    const s = data.series.find((x) => x.id === w.id);
    const a = monthKey(s.start, w.off);
    return { id: s.id, off: w.off, year: a.y, month: a.m };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const info = windowInfo(data, p);
    const { s, pts, spans } = info;
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

    const options = data.series.map((x) => ({ id: x.id, label: x.zh, aliases: [x.id, x.id.toLowerCase()] }));
    ctx.stage.append(ui.h('div', { class: 'small muted', style: { margin: '-4px 4px 4px' } }, `候选指标（共 ${options.length} 个）：${data.series.map((x) => x.zh).join('、')}`));
    const unit = s.unit === '%' ? '%' : ` ${s.unit}`;
    const r1 = await ctx.guess({
      title: '这条曲线是什么指标？',
      options, answer: p.id, maxGuesses: 3,
      placeholder: '输入指标名或代码…',
      cluesTitle: '指标线索',
      clues: [
        s.yoy ? '类型：同比变化率（与 12 个月前相比的百分比）。' : '类型：水平值，不是变化率。',
        `数值范围：最低 ${fmtV(info.lo.v)}${unit}，最高 ${fmtV(info.hi.v)}${unit}。`,
        `这个指标最早的数据始于 ${s.start.slice(0, 4)} 年。`,
      ],
      scoring: (n, won) => nameScore(n, won),
      max: 50,
    });

    const [lo, hi] = yearRange(data);
    const r2 = await ctx.estimate({
      title: '这段曲线从哪一年开始？',
      prompt: `指标是「${s.zh}」。15 年的窗口，估一下起点年份。`,
      answer: p.year, min: lo, max: hi, step: 1, initial: Math.round((lo + hi) / 2),
      format: (v) => `${Math.round(v)} 年`,
      scoring: yearScore,
    });

    const res = ctx.combine([
      { ...r1, score: r1.score, max: 50 },
      { ...r2, score: r2.score / 2, max: 50 },
    ]);
    const recs = spans.map((sp) => (sp.start.y === sp.end.y ? `${sp.start.y}` : `${sp.start.y}–${sp.end.y}`)).join('、') || '无';
    const behave = info.nMoves ? `；${info.nMoves} 次衰退里，曲线 ${info.up} 次上升、${info.down} 次下降` : '';
    res.detail = ui.kv([
      ['指标', `${s.zh}（FRED: ${s.id}）${s.yoy ? '，同比变化' : ''}`],
      ['时间段', `${ym(pts[0].k)} 至 ${ym(pts.at(-1).k)}（你猜 ${Math.round(r2.guess)} 年，答案 ${p.year} 年）`],
      ['这段曲线的特征', `最高 ${fmtV(info.hi.v)}${unit}（${ym(info.hi.k)}），最低 ${fmtV(info.lo.v)}${unit}（${ym(info.lo.k)}）${behave}`],
      ['窗口内的衰退', `${spans.length} 次（${recs}）`],
      ['怎么认出来', s.tip],
    ]);
    return res;
  },
};
