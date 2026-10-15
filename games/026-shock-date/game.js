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
  const list = s.slice(0, 3).map((x) => `${x.name} ${x.move} (${x.z}× normal)`).join(', ');
  return `Day ${pz.ans}: ${strong.length >= 2 ? `${strong.length} lines jumped on the same day by more than 3× their usual wobble` : 'several lines jumped sharply on the same day'}. ${list}. `
    + `${lead.name} moved the most. No other day in the window had a bigger combined jump across all four lines. Look for the day the lines break together, not for one line's slow trend.`;
}

export default {
  meta: {
    num: 26,
    slug: 'shock-date',
    title: 'Shock Date',
    tagline: 'Four market lines, one hidden date: which day did the shock hit?',
    category: 'money',
    data: 'snapshot',
    howTo: [
      'Four real market lines (stock indexes, the VIX, Treasury yields, oil, gold or exchange rates) cover 50 trading days. The x-axis shows only "day number", never calendar dates.',
      'A major historical event landed on one of those 50 days. Find the day several lines break at once: a real shock moves different assets together.',
      'Pick a day with the slider or by typing. You get 2 tries; the second comes with an earlier/later hint (10% penalty).',
      'Scoring: 100 points for the exact day, falling to about a third for every 3 trading days off.',
    ],
    scoring: '100 × e^(−days off / 3); the second try costs 10%.',
    sources: [
      { name: 'FRED: VIX, Treasury yields, WTI crude, exchange rates', url: 'https://fred.stlouisfed.org/', note: 'VIXCLS, DGS10, DGS2, DGS3MO, DCOILWTICO, DEXUSEU, DEXJPUS, DEXUSUK, DEXSZUS, DEXCHUS daily data' },
      { name: 'Yahoo Finance: S&P 500, Nasdaq, gold futures', url: 'https://finance.yahoo.com/quote/%5EGSPC/history/', note: '^GSPC, ^IXIC, GC=F daily closes (FRED only carries the last ten years of stock indexes)' },
    ],
    dataNote: 'The pool holds 65 historical shocks, one per day. Each event date is the first trading day the market reacted. For each puzzle we pick the 4 series that moved most that day relative to their previous 60 days, and place the 50-day window at a random offset so the answer is never a fixed day. The shock day is guaranteed to be the biggest combined jump in the window, and only events where at least two series clearly jump are kept. Event titles and blurbs are hand-written, not scraped. Holiday gaps are filled with the previous day\'s value. Snapshot through Sep 30, 2026; it does not update live.',
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
      const lab = s.kind === 'pct' ? `${s.name} (start = 100)` : `${s.name} (change from start, pp)`;
      const chart = await ui.plot((Plot, c) => ({
        height: ch,
        marginLeft: 44,
        marginBottom: 24,
        x: { label: null, ticks: [1, 10, 20, 30, 40, 50], grid: true },
        y: { label: null, grid: true, nice: true },
        marks: [
          Plot.lineY(rows, { x: 'day', y: 'y', stroke: c.accent, strokeWidth: 2 }),
          ...extra(Plot, c, rows),
          Plot.tip(rows, Plot.pointerX({ x: 'day', y: 'y', title: (d) => `Day ${d.day}\n${d.y}` })),
        ],
      }), { height: ch, width: cw });
      return ui.h('div', ui.h('div', { class: 'small mono ink2' }, lab), chart);
    };

    const cells = [];
    for (const s of sers) cells.push(await chartFor(s));
    ctx.stage.append(ui.panel({ kicker: `${pz.n} trading days · dates hidden`, title: 'Four lines, one shock' },
      ui.h('div', { class: 'ds-grid', style: { '--min': '300px' } }, ...cells)));

    const res = await ctx.estimate({
      title: 'Which day did the shock hit?',
      prompt: `Find the day several lines break together, from 1 to ${pz.n}.`,
      answer: pz.ans, min: 1, max: pz.n, step: 1, initial: 25,
      format: (v) => `Day ${Math.round(v)}`,
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
        ['Event', ev.label],
        ['Date', `${ev.date} (window ${pz.from} to ${pz.to}; the answer was day ${pz.ans})`],
        ['Background', ev.why],
      ]),
      ui.h('div', { class: 'ds-grid', style: { '--min': '280px' } }, ...marked),
      ui.h('div', { class: 'small muted' }, `Solid line = answer${gday !== pz.ans ? '; dashed line = your last guess' : ''}.`),
      ui.table({
        columns: [{ key: 'name', label: 'Series' }, { key: 'move', label: 'Move that day', num: true }, { key: 'z', label: '× usual move', num: true }],
        rows: sers.map((s) => ({ name: s.name, move: s.move, z: `${s.z}×` })),
      }),
      ui.h('div', { class: 'small' }, explain(pz)),
    );
    return res;
  },
};
