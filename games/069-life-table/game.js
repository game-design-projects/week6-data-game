// #69 Life Table — a 40-year-old in country X, year Y: what's the chance of reaching 80?
/** Survival 40→80 as a percentage from lx values (pure; tested). */
export const survival = (l40, l80) => +((l80 / l40) * 100).toFixed(1);

/** Anchor countries shown as references (never the target itself). */
export const ANCHORS = ['JPN', 'USA', 'IND', 'NGA'];
export const anchorsFor = (cc) => {
  const list = ANCHORS.filter((k) => k !== cc);
  return list.length < ANCHORS.length ? [...list, 'BRA'] : list;
};

/** One row of the pool by (cc, sex, year). */
export const findRow = (data, cc, s, y) => data.rows.find((r) => r.cc === cc && r.s === s && r.y === y);

/** Per-puzzle explanation of which pattern in the numbers gives the answer away (pure; tested). */
export function explain(r) {
  const lifeAfter40 = r.e40 + 40;
  const parts = [];
  if (r.u5 >= 40) parts.push(`${r.u5} of every 1,000 newborns do not reach age 5, which drags life expectancy at birth (${r.e0} years) down a lot; but people who reach 40 live to about ${lifeAfter40.toFixed(0)} on average, ${(lifeAfter40 - r.e0).toFixed(0)} years more than life expectancy at birth. `);
  else if (r.u5 >= 12) parts.push(`Under-5 mortality of ${r.u5} per 1,000 also pulls life expectancy at birth (${r.e0} years) down a bit; people who reach 40 live to about ${lifeAfter40.toFixed(0)} on average, ${(lifeAfter40 - r.e0).toFixed(0)} years higher. `);
  else parts.push(`Child deaths are already rare (only ${r.u5} per 1,000 before age 5), so life expectancy at birth (${r.e0} years) and the average age at death for 40-year-olds (about ${lifeAfter40.toFixed(0)}) differ by only ${(lifeAfter40 - r.e0).toFixed(0)} years. What matters is middle-age and old-age mortality. `);
  parts.push(lifeAfter40 >= 80
    ? `A 40-year-old lives past 80 on average, so most people (${r.p}%) clear the age-80 line.`
    : `A 40-year-old lives to only about ${lifeAfter40.toFixed(0)} on average, ${(80 - lifeAfter40).toFixed(0)} years short of 80, so only ${r.p}% reach 80.`);
  return parts.join('');
}

export default {
  meta: {
    num: 69,
    slug: 'life-table',
    title: 'Life Table',
    tagline: 'What are the odds that a 40-year-old man or woman in a given country and year reaches 80? Use life expectancy and other clues to estimate the percentage.',
    category: 'society',
    data: 'snapshot',
    howTo: [
      'Today you get a country, a year (1970, 1990, 2010 or 2023) and a sex. Estimate the chance (0-100%) that a 40-year-old that year lives to 80.',
      'Clues: life expectancy at birth, under-5 mortality, and reference values for Japan, the US, India and Nigeria for the same year and sex. Low life expectancy at birth is often dragged down by child deaths and does not mean middle-aged people die just as young.',
      'You get two tries, and after the first one you are told whether you were too high or too low.',
    ],
    scoring: 'Scored on the error of your last try: 0 points off is full marks, and every 12 percentage points off cuts the score to about a third. A second try scores 90% of that.',
    sources: [
      { name: 'UN World Population Prospects 2024 — Abridged Life Table (Medium variant)', url: 'https://population.un.org/wpp/downloads?folder=Standard%20Projections&group=Mortality' },
    ],
    dataNote: 'These are UN Population Division estimates for each country and year (1970, 1990, 2010, 2023), not an observed cohort follow-up. The probability is l80 ÷ l40 from the life table, the number alive at exactly age 80 divided by the number alive at exactly 40 (lx is the survivors at exactly that age, not an approximation). Small non-sovereign territories are removed.',
  },

  puzzle({ data, pick, rng }) {
    const r = pick(data.rows);
    return { cc: r.cc, s: r.s, y: r.y };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const { rows, countries } = ctx.data;
    const r = findRow(ctx.data, p.cc, p.s, p.y);
    const nm = (cc) => countries[cc].name;
    const name = nm(p.cc);
    const sexTxt = p.s === 'F' ? 'women' : 'men';
    ctx.log('puzzle', p.cc, p.s, p.y, r.p);

    const anchors = anchorsFor(p.cc).map((k) => findRow(ctx.data, k, p.s, p.y)).filter(Boolean);
    ctx.stage.append(ui.panel({ kicker: 'Today\'s puzzle', title: `${p.y} · ${name} · ${sexTxt}` },
      ui.grid(130,
        ui.stat({ label: 'Life expectancy at birth (years)', value: r.e0.toFixed(1), big: true }),
        ui.stat({ label: 'Under-5 mortality (per 1,000)', value: r.u5.toFixed(1), big: true })),
      ui.h('div', { class: 'small muted', style: { margin: '10px 0 4px' } }, `Reference (${p.y}, same sex):`),
      ui.table({
        columns: [{ key: 'n', label: 'Country' }, { key: 'e', label: 'Life exp.', num: true }, { key: 'u', label: 'U5 per 1,000', num: true }, { key: 'p', label: '40→80', num: true }],
        rows: anchors.map((a) => ({ n: nm(a.cc), e: `${a.e0.toFixed(1)}`, u: `${a.u5.toFixed(0)}`, p: `${a.p}%` })),
      })));

    const res = await ctx.estimate({
      answer: r.p, min: 0, max: 100, step: 0.5, initial: 50,
      format: (v) => `${core.fmtNum(v, 1)}%`,
      attempts: 2, scoring: 'abs', scale: 12, tolerance: 1.5,
      title: `${name}, ${p.y}, ${sexTxt}: chance a 40-year-old reaches 80`,
    });

    // reveal chart: every country, same year and sex — life expectancy vs. 40→80 survival
    const peers = rows.filter((x) => x.y === p.y && x.s === p.s);
    const chart = await ui.plot((Plot, c) => ({
      marks: [
        Plot.dot(peers.filter((x) => x.cc !== p.cc), { x: 'e0', y: 'p', r: 3, fill: c.muted, fillOpacity: 0.5 }),
        Plot.dot([r], { x: 'e0', y: 'p', r: 6, fill: c.accent, stroke: c.ink }),
        Plot.text([r], { x: 'e0', y: 'p', text: () => name, dy: -12, fill: c.ink }),
      ],
      x: { label: 'Life expectancy at birth (years)', domain: [30, 90] },
      y: { label: '40→80 survival (%)', domain: [0, 90] },
    }), { height: 240 });

    res.detail = ui.stack(
      ui.kv([
        ['Answer', `${r.p}%`],
        ['Life exp. at birth', `${r.e0.toFixed(1)} years`],
        ['Years left at 40', `${r.e40.toFixed(1)} years (living to about ${(r.e40 + 40).toFixed(0)} on average)`],
        ['Newborns reaching 40', `${r.s40}%`],
        ['The pattern', explain(r)],
        ['Sex gap', `${p.s === 'F' ? 'Men' : 'Women'} in the same country and year: ${findRow(ctx.data, p.cc, p.s === 'F' ? 'M' : 'F', p.y).p}%`],
      ]),
      ui.h('div', { class: 'small muted' }, `All countries in ${p.y}, same sex: the higher the life expectancy, the higher the 40→80 survival, but not proportionally.`),
      chart);
    return res;
  },
};
