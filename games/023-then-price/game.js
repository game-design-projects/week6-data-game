// #23 Then Price — what did a dozen eggs cost back then? Scored by % error.
/** Price formatter: 2 decimals normally, 3 for sub-dime prices (electricity). */
export function fmtPrice(v) {
  return `$${v < 0.1 ? v.toFixed(3) : v.toFixed(2)}`;
}
/** Human month from 'YYYY-MM'. */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtMonth = (ym) => `${MON[+ym.slice(5) - 1]} ${ym.slice(0, 4)}`;

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
const relWord = (rel) => (rel > 1.15 ? 'has risen faster than overall prices' : rel < 0.87 ? 'has risen slower than overall prices' : 'has kept pace with overall prices');

export default {
  meta: {
    num: 23,
    slug: 'then-price',
    title: 'Then Price',
    tagline: 'What did a dozen eggs cost in March 1983? Travel back to a past month and guess the price of three everyday items, scored by percent error.',
    category: 'money',
    data: 'snapshot',
    howTo: [
      'Each day you get a past month and three everyday items (each from a different category: dairy and eggs, meat, produce, staples, drinks, energy), plus the latest US average price of each.',
      'Drag the log slider or type a number to guess that month\'s national average retail price (US dollars, nominal, not adjusted for inflation).',
      'Scoring is by error ratio: 100 points for a perfect guess, about 37 for being 1.6× too high or too low, and close to 0 for 3× or more off. Each question is scored separately and the three add up to 300.',
      'Hint: first estimate how much prices overall have risen since then, then ask whether this item rose faster or slower. After the reveal you will see it compared with CPI over the same period.',
    ],
    scoring: 'Each question: 100·exp(−|ln(guess ÷ actual)| ÷ ln 1.6), symmetric for over- and under-guesses. Three questions add up to 300.',
    sources: [
      { name: 'BLS Average Price Data (downloaded via FRED)', url: 'https://www.bls.gov/regions/mid-atlantic/data/averageretailfoodandenergyprices_usandmidwest_table.htm', note: 'U.S. city average; series such as APU0000708111 (eggs)' },
      { name: 'FRED series example: eggs', url: 'https://fred.stlouisfed.org/series/APU0000708111' },
      { name: 'BLS public API: CPI-U all items (CUUR0000SA0)', url: 'https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0', note: 'used to compare with overall prices in the reveal' },
    ],
    dataNote: 'Prices are US city average retail prices (nominal). Milk (gallon) data starts in 1995 and ground beef in 1984, so early months never include them. Each item\'s "latest" reading may fall in a different month, and each is labeled separately. BLS has no data for October 2025 because of the shutdown, so that month never comes up. This is a snapshot: the puzzles are historical months and historical prices never change, so there is no live feed (the BLS public API allows cross-origin calls but only 25 queries a day).',
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

    ctx.stage.append(ui.panel({ kicker: 'Back in time', title: fmtMonth(p.ym) },
      ui.h('p', { class: 'ink2' }, `Three items: guess their US national average retail prices in ${fmtMonth(p.ym)}. The latest price of each is given, in nominal dollars with no inflation adjustment.`)));

    const results = [];
    for (const r of rows) {
      const rg = sliderRange(r.now);
      const res = await ctx.estimate({
        title: r.it.name,
        prompt: ui.h('div', { class: 'ink2' }, `${fmtMonth(r.it.to)}: `, ui.h('b', { class: 'mono' }, `${fmtPrice(r.now)} ${r.it.per}`), `. What about ${fmtMonth(p.ym)}?`),
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
    const pctOff = (g, a) => `${Math.round(Math.abs(g - a) / a * 100)}% ${g >= a ? 'high' : 'low'}`;
    const cpiLine = Object.keys(data.cpi).filter((ym) => ym >= p.ym).map((ym) => ({ d: new Date(ym + '-01'), v: (data.cpi[ym] / data.cpi[p.ym]) * 100 }));
    const chart = await ui.plot((Plot, c) => ({
      height: 240,
      x: { label: null },
      y: { type: 'log', label: 'Price index (that month = 100)', grid: true },
      color: { legend: true, domain: [...rows.map((r) => r.it.name), 'Overall prices (CPI)'], range: [...c.series.slice(0, rows.length), c.muted] },
      marks: [
        Plot.line(rows.flatMap((r) => Object.entries(r.it.s)
          .filter(([ym]) => ym >= p.ym)
          .map(([ym, v]) => ({ d: new Date(ym + '-01'), v: (v / r.then) * 100, n: r.it.name }))), { x: 'd', y: 'v', stroke: 'n' }),
        Plot.line(cpiLine, { x: 'd', y: 'v', stroke: () => 'Overall prices (CPI)', strokeDasharray: '4 3', strokeWidth: 2 }),
      ],
    }));
    out.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({
        columns: [
          { key: 'n', label: 'Item' }, { key: 'g', label: 'Guess', num: true }, { key: 't', label: 'Actual', num: true },
          { key: 'e', label: 'Off', num: true },
        ],
        rows: rows.map((r, i) => ({ n: r.it.name, g: fmtPrice(results[i].guess), t: fmtPrice(r.then), e: pctOff(results[i].guess, r.then) })),
      }),
      chart,
      ...rows.map((r) => ui.h('div', { class: 'small ink2' },
        ui.h('b', null, r.it.name), `: ${fmtMonth(p.ym)} ${fmtPrice(r.then)} → ${fmtMonth(r.it.to)} ${fmtPrice(r.now)}, up ×${r.mult.toFixed(1)} (${(r.annual * 100).toFixed(1)}% a year). Over the same period overall prices (CPI) rose ×${r.cpiMult.toFixed(1)}, so it ${relWord(r.rel)}.`)),
      ui.h('div', { class: 'small muted' }, `Trick: start from "latest price ÷ overall price rise" as a baseline, then adjust for the item. Energy and coffee swing a lot, eggs are hit hard by avian flu, and staples like flour and sugar rise more slowly than prices overall.`));
    return out;
  },
};
