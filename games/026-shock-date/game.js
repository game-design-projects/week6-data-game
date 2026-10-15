// #26 Shock Date — four market series around a hidden shock; find the day it hit.

/** Rebase a series for display: pct series → index (start = 100); yields → change in pp from start. */
export function rebase(s) {
  return s.v.map((x) => (s.kind === 'pct' ? +((x / s.base) * 100).toFixed(2) : +(x - s.base).toFixed(3)));
}

/** Points for a guess `g` (1-based day) vs answer `a`: exact = 100, ~37 at `scale` days off. */
export function dayScore(g, a, scale = 3) {
  return Math.round(100 * Math.exp(-Math.abs(g - a) / scale));
}

/** Pattern text for the result card, specific to this puzzle (uses the per-series z-scores from the build). */
export function explain(pz) {
  const s = [...pz.series].sort((a, b) => b.z - a.z);
  const strong = s.filter((x) => x.z >= 3);
  const lead = s[0];
  const list = s.slice(0, 3).map((x) => `${x.name} ${x.move}（平时的 ${x.z}×）`).join('、');
  return `第 ${pz.ans} 天，${strong.length >= 2 ? `${strong.length} 条曲线同日跳动超过平时波动的 3 倍` : '多条曲线同日明显跳动'}：${list}。`
    + `最强的是${lead.name}。窗口里其它任何一天，四条曲线加起来的跳动都没有这一天大——找“同一天一起断层”的位置，而不是某条曲线自己的缓慢趋势。`;
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
      '图里是 4 条真实的市场曲线（股指、VIX、美债收益率、油价、黄金或汇率），覆盖 50 个交易日，横轴只标“第几天”，不给日历日期。',
      '某个历史重大事件就发生在这 50 天里的某一天。找出几条曲线同时出现“断层”的那一天——真正的冲击会让不同资产同日一起跳动。',
      '输入或拖动选择第几天，共 2 次机会，第 2 次会提示偏早还是偏晚（扣 10%）。',
      '计分：猜中当天 100 分，每差约 3 个交易日分数降到约三分之一。',
    ],
    scoring: '100 × e^(−相差天数/3)，第二次机会扣 10%。',
    sources: [
      { name: 'FRED：VIX、美债收益率、WTI 原油、汇率', url: 'https://fred.stlouisfed.org/', note: 'VIXCLS, DGS10, DGS2, DGS3MO, DCOILWTICO, DEXUSEU, DEXJPUS, DEXUSUK, DEXSZUS, DEXCHUS 日度数据' },
      { name: 'Yahoo Finance：标普 500、纳斯达克、黄金期货', url: 'https://finance.yahoo.com/quote/%5EGSPC/history/', note: '^GSPC, ^IXIC, GC=F 日度收盘价（FRED 只提供近十年的股指）' },
    ],
    dataNote: '题库为 65 个历史冲击事件，每天一个。事件日期取为冲击后第一个反映到市场上的交易日；每道题取当天波动相对前 60 日平时波动最大的 4 条曲线，窗口位置每题随机（答案不固定在某一天），并且保证窗口内这一天是四条曲线合计跳动最大的一天。只保留至少有两条曲线明显跳动的事件。事件名称与说明由人工整理，不是抓取的数据。节假日缺失值按前一日补齐。数据为快照（到 2026-09-30），不会实时更新。',
  },

  puzzle({ data, pick }) {
    const pz = pick(data.puzzles);
    return { pz, ev: data.events[pz.ev] };
  },

  async play(ctx, { pz, ev }) {
    const { ui } = ctx;
    ctx.log('puzzle', ev.date, pz.series.map((s) => s.id).join(','), 'answer day', pz.ans);
    const sers = pz.series.map((s) => ({ ...s, y: rebase(s) }));
    const narrow = innerWidth < 700;
    const cw = narrow ? Math.max(240, Math.min(innerWidth, 760) - 72) : 340;
    const ch = narrow ? 130 : 160;

    const chartFor = async (s, extra = () => []) => {
      const rows = s.y.map((y, i) => ({ day: i + 1, y }));
      const lab = s.kind === 'pct' ? `${s.name}（起点 = 100）` : `${s.name}（较起点变化，百分点）`;
      const chart = await ui.plot((Plot, c) => ({
        height: ch,
        marginLeft: 44,
        marginBottom: 24,
        x: { label: null, ticks: [1, 10, 20, 30, 40, 50], grid: true },
        y: { label: null, grid: true, nice: true },
        marks: [
          Plot.lineY(rows, { x: 'day', y: 'y', stroke: c.accent, strokeWidth: 2 }),
          ...extra(Plot, c, rows),
          Plot.tip(rows, Plot.pointerX({ x: 'day', y: 'y', title: (d) => `第 ${d.day} 天\n${d.y}` })),
        ],
      }), { height: ch, width: cw });
      return ui.h('div', ui.h('div', { class: 'small mono ink2' }, lab), chart);
    };

    const cells = [];
    for (const s of sers) cells.push(await chartFor(s));
    ctx.stage.append(ui.panel({ kicker: `${pz.n} 个交易日 · 日期已隐藏`, title: '四条曲线，一次冲击' },
      ui.h('div', { class: 'ds-grid', style: { '--min': '300px' } }, ...cells)));

    const res = await ctx.estimate({
      title: '冲击发生在第几天？',
      prompt: `找出几条曲线同时断层的那一天，范围 1–${pz.n}。`,
      answer: pz.ans, min: 1, max: pz.n, step: 1, initial: 25,
      format: (v) => `第 ${Math.round(v)} 天`,
      attempts: 2,
      scoring: (g, a) => dayScore(Math.round(g), a) / 100,
      tolerance: 0,
    });
    ctx.log('result', res.guess, res.score);

    const gday = Math.round(res.guess);
    const marked = [];
    for (const s of sers) {
      marked.push(await chartFor(s, (Plot, c, rows) => [
        Plot.ruleX([pz.ans], { stroke: c.hit ?? c.accent, strokeWidth: 2 }),
        ...(gday !== pz.ans ? [Plot.ruleX([gday], { stroke: c.muted, strokeDasharray: '4 3' })] : []),
      ]));
    }

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['事件', ev.label],
        ['日期', `${ev.date}（窗口 ${pz.from} 至 ${pz.to}，答案是第 ${pz.ans} 天）`],
        ['背景', ev.why],
      ]),
      ui.h('div', { class: 'ds-grid', style: { '--min': '280px' } }, ...marked),
      ui.h('div', { class: 'small muted' }, `实线 = 答案${gday !== pz.ans ? '，虚线 = 你的最后一次猜测' : ''}。`),
      ui.table({
        columns: [{ key: 'name', label: '曲线' }, { key: 'move', label: '当天变动', num: true }, { key: 'z', label: '相当于平时的 × 倍', num: true }],
        rows: sers.map((s) => ({ name: s.name, move: s.move, z: `${s.z}×` })),
      }),
      ui.h('div', { class: 'small' }, explain(pz)),
    );
    return res;
  },
};
