// #27 H-1B — guess the base salary on a real LCA (H-1B) filing from job, employer and city.
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s\-/(])([a-z])/g, (m, a, b) => a + b.toUpperCase());

const money = (v) => '$' + Math.round(v).toLocaleString('en-US');
const pctDiff = (a, b) => Math.round((a / b - 1) * 100);
const signed = (p) => (p >= 0 ? '+' : '−') + Math.abs(p) + '%';

/** Where a salary sits inside a cell's quartiles — for teaching text. */
export function where(sal, c) {
  if (sal < c.p25) return 'below the 25th percentile for this job in this city';
  if (sal > c.p75) return 'above the 75th percentile for this job in this city';
  return 'within the middle 50% for this job in this city';
}

/** Puzzle-specific explanation of which clue pointed to the answer. Pure. */
export function explain(x, cell, refs) {
  const parts = [];
  if (refs.length) {
    const avg = refs.reduce((s, r) => s + r.med, 0) / refs.length;
    const d = pctDiff(cell.med, avg);
    parts.push(Math.abs(d) < 5
      ? `This city\'s median for the job, ${money(cell.med)}, is close to the reference table\'s average of ${money(avg)}, so the city itself gives no pay-premium clue. `
      : `This city\'s median for the job, ${money(cell.med)}, is ${Math.abs(d)}% ${d > 0 ? 'higher' : 'lower'} than the ${money(avg)} average of the ${refs.length} reference cities. That is the city premium. `);
  }
  const vs = pctDiff(x.sal, cell.med);
  parts.push(Math.abs(vs) < 10
    ? 'This filing is within 10% of the city median. '
    : `This filing is ${Math.abs(vs)}% ${vs > 0 ? 'above' : 'below'} the city median, ${vs > 0 ? 'which looks more like a big company or a senior role' : 'which looks more like a small consultancy or a junior role'}. `);
  if (x.empMed) {
    const e = pctDiff(x.sal, x.empMed);
    parts.push(`${titleCase(x.emp)} has ${x.empN} other ${x.empN === 1 ? 'filing' : 'filings'} in the sample, with a median of ${money(x.empMed)}. This one ${Math.abs(e) < 10 ? 'is close to it, so the employer\'s pay tier is a reliable clue' : (e > 0 ? 'is well above' : 'is well below') + ' it (' + signed(e) + '); the job or city made the difference'}.`);
  } else {
    parts.push('This employer has not enough other filings in the sample, so you have to go by job and city.');
  }
  return parts.join('');
}

const fmtDate = (iso) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+iso.slice(5, 7) - 1]} ${+iso.slice(8)}, ${iso.slice(0, 4)}`;

export default {
  meta: {
    num: 27,
    slug: 'h-1b',
    title: 'H-1B',
    tagline: 'A real H-1B Labor Condition Application (LCA): given the job, employer and city, guess the annual salary it reports.',
    category: 'money',
    data: 'snapshot',
    howTo: [
      'Each day shows one LCA filing from the US Department of Labor\'s public data: job title, employer, work city, filing date, and the employer\'s other filings in the sample.',
      'The reference table lists the median reported wage for the same job in a few other cities: first decide whether this city is pricier or cheaper than those, then look at the employer\'s tier.',
      'Drag the slider (log scale) or type the annual salary you think was reported, then submit to reveal it.',
      'Scored by relative error: 0% off is 100 points, and about 30% off leaves about 37.',
    ],
    scoring: '100 × e^(−|guess − actual| / (0.3 × actual)), roughly by percentage error.',
    sources: [
      { name: 'US DOL OFLC LCA Disclosure Data', url: 'https://www.dol.gov/agencies/eta/foreign-labor/performance' },
      { name: 'h1bdata.info (mirror of public LCA data, filings submitted in 2024)', url: 'https://h1bdata.info/' },
    ],
    dataNote: 'Data come from searches of h1bdata.info, which mirrors the DOL LCA disclosure data (filings submitted in 2024); the DOL site returns 403 to scripts, so it cannot be downloaded directly. It covers 15 job titles × 12 cities, and every median and “employer\'s other filings” figure rests only on the scraped sample, not the full DOL dataset. Only the reported base annual salary is included, not bonuses or stock. That is why this game is a single estimation question rather than separate guesses for employer and city.',
  },

  puzzle({ data, pick, rng }) {
    const x = pick(data.puzzles);
    const others = Object.entries(data.cells[x.q] || {}).filter(([c]) => c !== x.city).map(([city, c]) => ({ city, med: c.med, n: c.n }));
    const refs = rng.sample(others, Math.min(5, others.length)).sort((a, b) => b.med - a.med);
    return { x, refs };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const { x } = p;
    const cell = ctx.data.cells[x.q][x.city];
    ctx.log('puzzle', x.id, x.emp, x.city, x.sal);
    ctx.stage.append(
      ui.panel({ kicker: 'LCA filing', title: titleCase(x.title) },
        ui.kv([
          ['Employer', titleCase(x.emp)],
          ['Work city', titleCase(x.city)],
          ['Filing date', fmtDate(x.date)],
          ['Employer\'s other filings', x.empMed ? `${x.empN} more in the sample, median ${core.fmtMoney(x.empMed)} (other jobs and cities included)` : (x.empN ? `${x.empN} more in the sample (too few for a median)` : 'No other filings in the sample')],
          ['Same job, same city sample', `${cell.n} ${cell.n === 1 ? 'filing' : 'filings'}`],
        ])),
      ui.panel({ kicker: 'Reference', title: `Median reported wage for “${titleCase(x.q)}” in other cities` },
        ui.table({
          columns: [{ key: 'city', label: 'City' }, { key: 'med', label: 'Median', num: true }],
          rows: p.refs.map((r) => ({ city: titleCase(r.city), med: core.fmtMoney(r.med) })),
        })),
    );
    const res = await ctx.estimate({
      title: 'What salary is on this filing?',
      prompt: 'Base annual salary in US dollars, excluding bonuses and stock.',
      answer: x.sal, min: 40000, max: 400000, log: true, step: 1000, initial: 120000,
      format: (v) => core.fmtMoney(v), scoring: 'pct', scale: 0.3,
    });
    res.detail = ui.kv([
      ['Actually reported', core.fmtMoney(x.sal)],
      ['Same job, same city', `Median ${core.fmtMoney(cell.med)} (${core.fmtMoney(cell.p25)} – ${core.fmtMoney(cell.p75)}); this one is ${where(x.sal, cell)}`],
      ['The pattern', explain(x, cell, p.refs)],
      ['Case number', x.id],
    ]);
    return res;
  },
};
