// #26 Shock Date — four FRED market series around a hidden shock; find the day it hit.

/** Rebase a series for display: pct series → index (start = 100); yields → change in pp from start. */
export function rebase(s) {
  return s.v.map((x) => (s.kind === 'pct' ? +((x / s.base) * 100).toFixed(2) : +(x - s.base).toFixed(3)));
}

/** Points for a guess `g` (1-based day) vs answer `a`: exact = 100, ~37 at `scale` days off. */
export function dayScore(g, a, scale = 3) {
  return Math.round(100 * Math.exp(-Math.abs(g - a) / scale));
}

export default {
  meta: {
    num: 26,
    slug: 'shock-date',
    title: 'Shock Date',
    tagline: '四条市场曲线围绕着一个隐藏的日期：哪一天冲击降临？',
    category: 'money',
    data: 'snapshot',
    howTo: [
      '图里是 4 条真实的市场曲线（股指、波动率、利率、油价或汇率），覆盖 50 个交易日，横轴只标“第几天”，不给日历日期。',
      '某个历史重大事件就发生在这 50 天里的某一天。找出几条曲线同时出现“断层”的那一天——真正的冲击会让不同资产同日一起跳动。',
      '输入或拖动选择第几天，共 2 次机会，第 2 次会提示偏早还是偏晚（扣 10%）。',
      '计分：猜中当天 100 分，每差约 3 个交易日分数降到约三分之一。',
    ],
    scoring: '100 × e^(−相差天数/3)，第二次机会扣 10%。',
    sources: [
      { name: 'FRED: S&P 500 / VIX / 美债收益率 / WTI / 汇率', url: 'https://fred.stlouisfed.org/', note: 'SP500, VIXCLS, DGS10, DGS2, DCOILWTICO, DEXUSEU, DEXJPUS 日度数据' },
    ],
    dataNote: '共 30 个历史事件，每个事件按不同的曲线组合与位置出 3 道题。事件日期取为冲击后第一个交易日；构建时只保留至少有一条曲线单日波动超过前 60 日波动 3 倍的事件。FRED 的 SP500 只提供近十年。节假日缺失值按前一日补齐。',
  },

  puzzle({ data, pick }) {
    const pz = pick(data.puzzles);
    return { pz, ev: data.events[pz.ev] };
  },

  async play(ctx, { pz, ev }) {
    const { ui, core } = ctx;
    ctx.log('puzzle', ev.date, pz.series.map((s) => s.id).join(','), 'answer day', pz.ans);
    const sers = pz.series.map((s) => ({ ...s, y: rebase(s) }));

    const cw = innerWidth < 700 ? Math.max(240, Math.min(innerWidth, 760) - 72) : 340;
    const cells = [];
    for (const s of sers) {
      const rows = s.y.map((y, i) => ({ day: i + 1, y }));
      const lab = s.kind === 'pct' ? `${s.name}（起点 = 100）` : `${s.name}（较起点变化，百分点）`;
      const chart = await ui.plot((Plot, c) => ({
        height: 160,
        marginLeft: 44,
        marginBottom: 24,
        x: { label: null, ticks: [1, 10, 20, 30, 40, 50], grid: true },
        y: { label: null, grid: true, nice: true },
        marks: [
          Plot.lineY(rows, { x: 'day', y: 'y', stroke: c.accent, strokeWidth: 2 }),
          Plot.tip(rows, Plot.pointerX({ x: 'day', y: 'y', title: (d) => `第 ${d.day} 天\n${d.y}` })),
        ],
      }), { height: 160, width: cw });
      cells.push(ui.h('div', ui.h('div', { class: 'small mono ink2' }, lab), chart));
    }
    ctx.stage.append(ui.panel({ kicker: `${pz.n} 个交易日 · 日期已隐藏`, title: '四条曲线，一次冲击' },
      ui.h('div', { class: 'ds-grid', style: { '--min': '300px' } }, ...cells)));

    const res = await ctx.estimate({
      title: '冲击发生在第几天？',
      prompt: '找出几条曲线同时断层的那一天，范围 1–50。',
      answer: pz.ans, min: 1, max: pz.n, step: 1, initial: 25,
      format: (v) => `第 ${Math.round(v)} 天`,
      attempts: 2,
      scoring: (g, a) => dayScore(Math.round(g), a) / 100,
      tolerance: 0,
    });
    ctx.log('result', res.guess, res.score);

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['事件', `${ev.label}`],
        ['日期', `${ev.date}（窗口 ${pz.from} 至 ${pz.to}，答案是第 ${pz.ans} 天）`],
        ['背景', ev.why],
      ]),
      ui.table({
        columns: [{ key: 'name', label: '曲线' }, { key: 'move', label: '当天变动', num: true }, { key: 'z', label: '相当于平时的 × 倍', num: true }],
        rows: sers.map((s) => ({ name: s.name, move: s.move, z: `${s.z}×` })),
      }),
      ui.h('div', { class: 'small muted' }, '规律：真正的冲击会让多个资产在同一天一起“跳空”，单条曲线的缓慢趋势则不是线索。'),
    );
    return res;
  },
};
