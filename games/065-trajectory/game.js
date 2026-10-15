// #65 Trajectory — a country's 200-year path on the income x life-expectancy chart; name it.
const REGION = { africa: 'Africa', americas: 'the Americas', asia: 'Asia', europe: 'Europe' };

/** Largest single-step drop in life expectancy (pts are [year, income, lex]). */
export function worstDip(pts) {
  let best = { drop: 0, year: pts[0][0] };
  for (let i = 1; i < pts.length; i++) {
    const drop = pts[i - 1][2] - pts[i][2];
    if (drop > best.drop) best = { drop: Math.round(drop * 10) / 10, year: pts[i][0] };
  }
  return best;
}
export const at = (pts, year) => pts.reduce((b, p) => (Math.abs(p[0] - year) < Math.abs(b[0] - year) ? p : b));
/** Year life expectancy first passed `lex`, or null. */
export function firstAbove(pts, lex) { const p = pts.find((q) => q[2] >= lex); return p ? p[0] : null; }

/** Pattern summary used in the result card: takeoff year, life-expectancy gain, income growth. */
export function pattern(pts) {
  const a = pts[0], z = pts[pts.length - 1];
  const up = pts.find((q) => q[1] >= a[1] * 2);
  return { takeoff: up ? up[0] : null, incomeX: z[1] / a[1], lexGain: Math.round((z[2] - a[2]) * 10) / 10, dip: worstDip(pts), start: a, end: z };
}

/** Puzzle-specific explanation of what made this trajectory recognisable. */
export function why(name, p) {
  const x = p.incomeX >= 10 ? Math.round(p.incomeX) : p.incomeX.toFixed(1);
  const parts = [`${name} started 1800 at $${Math.round(p.start[1]).toLocaleString('en-US')} a year with a life expectancy of ${p.start[2]}; by 2015 income had grown about ${x}\u00d7 and life expectancy had risen ${p.lexGain} years. `];
  parts.push(p.takeoff && p.takeoff > 1800 ? `Income doubled around ${p.takeoff}. ` : 'There is no clear takeoff point where income doubled. ');
  if (p.dip.drop >= 3) parts.push(`The sharp drop around ${p.dip.year} (\u2212${p.dip.drop} years) is the most striking feature, usually a war, famine or epidemic.`);
  else if (p.dip.drop >= 1) parts.push(`There is a small setback around ${p.dip.year} (\u2212${p.dip.drop} years).`);
  else parts.push('The path is mostly smooth, with no clear setback.');
  return parts.join('');
}

export default {
  meta: {
    num: 65,
    slug: 'trajectory',
    title: 'Trajectory',
    tagline: 'A country\'s 200-year path across the income \u00d7 life expectancy chart. Read the route and name the country.',
    category: 'society',
    data: 'snapshot',
    howTo: [
      'The horizontal axis is income per person (log scale, adjusted for purchasing power and inflation), the vertical axis is life expectancy at birth, and the line is one country\'s path from 1800 to 2015.',
      'Pick a country from the list, up to 6 guesses. Every miss unlocks a new clue.',
      'Each guess shows its continent, how many times its 2015 income differs from the answer\'s, and the gap in life expectancy.',
      'Hint: wars, famines and civil wars knock gaps downward in the path; early takeoffs belong to the first industrializers.',
    ],
    scoring: '100 points for a first-try hit, about 17 fewer for each extra guess, 0 if you miss all six.',
    sources: [
      { name: 'Gapminder World (GDP per capita, PPP, inflation-adjusted)', url: 'https://github.com/open-numbers/ddf--gapminder--gapminder_world' },
      { name: 'Gapminder life expectancy (life_expectancy_years)', url: 'https://www.gapminder.org/data/documentation/gd004/' },
    ],
    dataNote: 'The data are Gapminder\'s historical estimates; values around 1800 are mostly extrapolated. One point is taken every 2 years (plus 2015), and only the 184 countries with complete data for 1800\u20132015 are kept; Gapminder\'s two series end in 2015. Gapminder\'s newer income series uses a different basis (2021 dollars) and has no matching life expectancy, so it is not mixed in.',
  },

  puzzle({ data, pick }) {
    return { cc: pick(data.countries).cc };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const by = new Map(ctx.data.countries.map((c) => [c.cc, c]));
    const ans = by.get(p.cc);
    const pts = ans.pts;
    const last = pts[pts.length - 1];
    const dip = worstDip(pts);
    ctx.log('answer', ans.cc, 'dip', dip);

    const marks = [];
    for (const q of pts.filter((r) => r[0] % 10 === 0 || r[0] === 2015)) {
      const m = marks[marks.length - 1];
      if (!m || Math.hypot((Math.log10(q[1]) - Math.log10(m.i)) * 60, (q[2] - m.l) * 0.9) > 15 || q[0] === 2015) marks.push({ y: String(q[0]), i: q[1], l: q[2] });
    }
    const chart = await ui.plot((Plot, c) => ({
      height: 320,
      marginLeft: 40,
      x: { type: 'log', label: 'Income per person, $ (log) \u2192', domain: [100, 200000], ticks: [100, 300, 1000, 3000, 10000, 30000, 100000], tickFormat: (v) => (v >= 1000 ? `${v / 1000}k` : v) },
      y: { label: '\u2191 Life expectancy (years)', domain: [0, 90], grid: true },
      marks: [
        Plot.line(pts, { x: (q) => q[1], y: (q) => q[2], stroke: c.accent, strokeWidth: 2 }),
        Plot.dot(marks, { x: 'i', y: 'l', fill: c.ink, r: 3 }),
        Plot.text(marks, { x: 'i', y: 'l', text: 'y', dy: -9, fill: c.ink2, fontSize: 11 }),
      ],
    }));

    const keyYears = [1800, 1850, 1900, 1950, 2000, 2015];
    const table = ui.table({
      columns: [{ key: 'y', label: 'Year' }, { key: 'i', label: 'Income $', num: true }, { key: 'l', label: 'Life expectancy', num: true }],
      rows: keyYears.map((y) => { const q = at(pts, y); return { y, i: ctx.core.fmtNum(q[1]), l: q[2] }; }),
    });
    const clues = [
      chart,
      `It is in ${REGION[ans.region] || 'somewhere in the world'}.`,
      ui.h('div', 'Numbers for key years:', table),
      dip.drop >= 1 ? `Its biggest one-step fall in life expectancy came around ${dip.year}: down ${dip.drop} years at once.` : 'Its life expectancy hardly ever fell noticeably.',
      `The country name starts with \u201c${ans.name[0]}\u201d.`,
    ];

    const options = ctx.data.countries.map((c) => ({ id: c.cc, label: c.name, aliases: [c.cc, ...(c.alt ? [c.alt] : [])] }));
    const res = await ctx.guess({
      options,
      answer: ans.cc,
      maxGuesses: 6,
      title: 'Which country does this path belong to?',
      placeholder: 'Type a country, e.g. Peru\u2026',
      clues,
      cluesTitle: 'Path and clues',
      columns: ['Region', 'Income', 'Life exp.'],
      near: (g, a) => by.get(g.id).region === by.get(a.id).region,
      feedback: (g) => {
        const gc = by.get(g.id), gl = gc.pts[gc.pts.length - 1];
        if (gc.cc === ans.cc) return [{ text: REGION[gc.region], state: 'hit' }, { text: '🎯', state: 'hit' }, { text: '0', state: 'hit', num: true }];
        const ratio = last[1] / gl[1], dl = last[2] - gl[2];
        return [
          { text: REGION[gc.region] || '—', state: gc.region === ans.region ? 'near' : undefined },
          { text: `${ratio >= 1 ? '↑' : '↓'} ${ratio >= 1 ? ratio.toFixed(1) : (1 / ratio).toFixed(1)}×`, num: true, state: Math.abs(Math.log(ratio)) < 0.3 ? 'near' : undefined },
          { text: `${dl >= 0 ? '+' : ''}${dl.toFixed(1)}`, num: true, state: Math.abs(dl) < 2 ? 'near' : undefined },
        ];
      },
    });

    const t70 = firstAbove(pts, 70);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['Answer', ans.name],
        ['1800', `$${ctx.core.fmtNum(pts[0][1])}, life expectancy ${pts[0][2]}`],
        ['2015', `$${ctx.core.fmtNum(last[1])}, life expectancy ${last[2]}`],
        ['First reached 70', t70 ? `${t70}` : 'not yet'],
        ['Biggest setback', dip.drop >= 1 ? `${dip.year}: \u2212${dip.drop} years` : 'none to speak of'],
      ]),
      ui.callout(why(ans.name, pattern(pts)), 'good'),
      ui.h('div', { class: 'small muted' }, 'Reading tip: the further up and right the start, the earlier the industrialization; a sudden plunge usually means a war, famine or epidemic.'));
    return res;
  },
};
