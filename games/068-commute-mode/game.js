export const MODES = [
  { key: 'transit', label: 'public transit', phrase: 'take public transit', icon: '🚇' },
  { key: 'bike', label: 'biking', phrase: 'bike to work', icon: '🚲' },
  { key: 'wfh', label: 'working from home', phrase: 'work from home', icon: '🏠' },
];

export default {
  meta: {
    num: 68,
    slug: 'commute-mode',
    title: 'Commute Mode',
    tagline: 'Given a US county, guess how many commuters take transit, bike, or work from home.',
    category: 'society',
    data: 'snapshot',
    howTo: [
      'Today you get a US county\'s population, number of commuters and share who drive alone.',
      'Drag or type to guess what percent of the county\'s workers take public transit, bike, and work from home (log scale, so small values can be tuned finely).',
      'Three sliders are on screen, each submitted on its own. Scoring is by how many times off you are, the closer the better, averaged over the three.',
      'Hint: the three together cannot exceed the “leftover share”; big cities and college towns bike more, and white-collar counties have high work-from-home shares since the pandemic.',
    ],
    scoring: 'Each item is scored by how many times off you are: exactly right is 100, 2x off is about 37, and the three are averaged.',
    sources: [
      { name: 'U.S. Census Bureau, ACS 5-year 2019–2023, Table B08301 (Means of Transportation to Work)', url: 'https://data.census.gov/table/ACSDT5Y2023.B08301' },
      { name: 'U.S. Census Bureau, ACS Table B01003 (Total Population)', url: 'https://data.census.gov/table/ACSDT5Y2023.B01003' },
    ],
    dataNote: 'ACS 2019–2023 five-year estimates, which carry sampling error. Only counties with at least 25,000 commuters and transit, biking and work-from-home shares all at least 0.2% are included (400 in all), so no answer is cut off by the slider\'s 0.1% floor. The live api.census.gov endpoint was tried: it needs an API key (302 to missing_key), and ACS five-year estimates do not update daily anyway, so a snapshot is kept. Work-from-home shares include the big pandemic-era rise.',
  },

  puzzle({ data, pick }) {
    const c = pick(data.counties);
    return { i: data.counties.indexOf(c) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const c = ctx.data.counties[p.i];
    ctx.log('county', c.name, c.state, { transit: c.transit, bike: c.bike, wfh: c.wfh });
    const left = leftover(c);
    ctx.stage.append(ui.panel({ kicker: 'Today\'s county', title: `${c.name}, ${c.state}` },
      ui.grid(110,
        ui.stat({ label: 'Population', value: c.pop ? core.fmtCompact(c.pop) : '—' }),
        ui.stat({ label: 'Workers', value: core.fmtCompact(c.workers) }),
        ui.stat({ label: 'Drive alone', value: `${c.drive}%`, sub: 'known' }),
        ui.stat({ label: 'Walk', value: `${c.walk}%`, sub: 'known' })),
      ui.h('p', { class: 'small muted', style: { marginTop: '10px' } },
        `After driving, carpooling, walking and other modes, about ${left}% is left to split among transit, biking and working from home. The three together cannot exceed it.`)));
    const box = ui.h('div', { class: 'ds-stack' });
    ctx.stage.append(box);
    const rs = await Promise.all(MODES.map((m) => ctx.estimate({
      title: `${m.icon} Share who ${m.phrase}`,
      prompt: `What percent of ${c.name} workers ${m.phrase}?`,
      container: box,
      answer: c[m.key], min: 0.1, max: 100, log: true, step: 0.1, initial: 5,
      format: (v) => `${v < 10 ? v.toFixed(1) : Math.round(v)}%`,
      scoring: 'log', scale: 0.35,
    })));
    const res = ctx.combine(rs);
    const med = (k) => { const a = ctx.data.counties.map((x) => x[k]).sort((x, y) => x - y); return a[a.length >> 1]; };
    res.detail = ui.stack(
      ui.callout(`${c.name}, ${c.state}: transit ${c.transit}%, biking ${c.bike}%, work from home ${c.wfh}%. Your scores: ${rs.map((r, i) => `${MODES[i].label} ${r.summary}`).join(' / ')}`),
      ui.table({
        columns: [{ key: 'k', label: 'Commute mode' }, { key: 'v', label: 'Share', num: true }, { key: 'm', label: 'Sample median', num: true }],
        rows: [['Drive alone', c.drive, med('drive')], ['Carpool', c.carpool, med('carpool')], ['Public transit', c.transit, med('transit')], ['Bike', c.bike, med('bike')], ['Walk', c.walk, med('walk')], ['Work from home', c.wfh, med('wfh')], ['Other', c.other, med('other')]].map(([k, v, m]) => ({ k, v: `${v}%`, m: `${m}%` })),
      }),
      ui.h('div', { class: 'small muted' }, explain(c, med)));
    return res;
  },
};

/** share left for transit + bike + wfh after the four "known" categories */
export function leftover(c) { return +(100 - c.drive - c.carpool - c.walk - c.other).toFixed(1); }

/** puzzle-specific teaching text */
export function explain(c, med) {
  const left = leftover(c);
  const bits = [];
  bits.push(c.drive > 80 ? `Driving alone is as high as ${c.drive}%, leaving almost no room for transit and biking. ` : c.drive < 60 ? `Driving alone is only ${c.drive}%, well below typical, so other modes are taking share. ` : `Driving alone is ${c.drive}%, within the usual range. `);
  bits.push(c.transit >= 10 ? `Transit is ${c.transit}%, typical of a big-city core county (sample median ${med('transit')}%). ` : `Transit is only ${c.transit}%, under 10%, so most commuting is by car. `);
  bits.push(c.bike >= 2 ? `Biking is ${c.bike}%, far above the sample median of ${med('bike')}%, common in college towns and bike-friendly cities. ` : `Biking is just ${c.bike}%; most counties are under 1%. `);
  bits.push(c.wfh >= 15 ? `Working from home is ${c.wfh}%; counties with many white-collar and tech workers are clearly higher since the pandemic. ` : `Working from home is ${c.wfh}% (sample median ${med('wfh')}%). `);
  bits.push(`The three add up to ${+(c.transit + c.bike + c.wfh).toFixed(1)}%, within the ${left}% left over.`);
  return bits.join('');
}
