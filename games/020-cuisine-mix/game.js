// #20 Cuisine Mix — a ZIP code's restaurant cuisine mix; pin where it is in NYC.
export const pct = (v, n) => Math.round((1000 * v) / n) / 10;

export const NYC_BOUNDS = [[40.49, -74.27], [40.92, -73.68]];

export default {
  meta: {
    num: 20,
    slug: 'cuisine-mix',
    title: 'Cuisine Mix',
    tagline: 'What does a ZIP code\'s restaurant mix look like? Read its flavor fingerprint, then pin the neighborhood on the NYC map.',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      'The chart shows the cuisine shares of restaurants in one ZIP code (orange bars). Hollow dots mark the citywide share, and a bar far longer than its dot is what makes this place special.',
      'Lots of Chinese food and bakeries usually means Flushing or Sunset Park. Kosher, Mexican, Caribbean and Italian each have their own turf, and plenty of coffee, Japanese and steakhouses tend to mean the busy parts of Manhattan and Brooklyn.',
      'Click the map where you think the ZIP code is (the map shows no place names). The closer you are, the more you score.',
    ],
    scoring: '100 × e^(−distance/3 km): a bullseye is 100, about 3 km off is about 37, and 10 km or more is close to 0. The ZIP\'s location is the median of its restaurants\' coordinates.',
    sources: [
      { name: 'NYC DOHMH Restaurant Inspection Results', url: 'https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j', note: 'Each restaurant is counted once, by the cuisine and ZIP on its record' },
    ],
    dataNote: 'A snapshot of NYC Open Data (DOHMH restaurant inspection records): about 26,500 restaurants with coordinates and a cuisine (including records of recently closed ones), counted for the 92 ZIP codes with at least 100 restaurants. Uninformative cuisines such as “Other” and “Not Listed” are removed, and a few near-synonymous sandwich/salad categories are merged. A “neighborhood” here is a ZIP code, not a custom community area. The dataset updates daily, but cuisine mixes change slowly, so a snapshot is used instead of a live fetch.',
  },

  puzzle({ data, pick }) {
    const z = pick(data.zips);
    return { zip: z, cityShare: data.cityShare, n: data.n };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const z = p.zip;
    const rows = z.mix.slice(0, 10).map(([k, v]) => ({ k, share: pct(v, z.n), city: p.cityShare[k] == null ? null : Math.round(p.cityShare[k] * 10) / 10 }))
      .map((r) => ({ ...r, label: `${r.k}  ${r.share}%` }));
    ctx.log('zip', z.zip, z.boro, z.n, 'top', rows[0].k, 'lift', JSON.stringify(z.lift));
    const chart = await ui.plot((Plot, c) => ({
      height: 40 + rows.length * 30, marginLeft: 150, marginRight: 16,
      x: { label: '% of ZIP restaurants', grid: true },
      y: { label: null, domain: rows.map((r) => r.label) },
      marks: [
        Plot.barX(rows, { y: 'label', x: 'share', fill: c.accent }),
        Plot.dot(rows.filter((r) => r.city != null), { y: 'label', x: 'city', r: 5, stroke: c.ink, strokeWidth: 2, fill: c.paper }),
      ],
    }));
    ctx.stage.append(ui.panel({ kicker: `${z.n} restaurants`, title: 'Cuisine mix of this neighborhood' }, chart,
      ui.h('div', { class: 'small muted', style: { marginTop: '8px' } }, '○ Hollow dot = citywide share. The further a bar runs past its dot, the more it defines this place. (The percentage at left is that cuisine\'s share of this ZIP\'s restaurants.)')));

    const res = await ctx.pin({
      answer: { lat: z.lat, lng: z.lng, label: `${z.zip} · ${z.boro}` },
      view: { bounds: NYC_BOUNDS },
      scale: 3,
      title: 'Where is it?',
    });
    const top = rows[0];
    const liftTxt = z.lift.length
      ? z.lift.map(([k, l, v]) => { return `${k} is ${pct(v, z.n)}% of restaurants, ${l}x the citywide average (${Math.round(p.cityShare[k] * 10) / 10}%)`; }).join('; ')
      : 'No cuisine stands far above the citywide average: this is a “typical New York” mix, so judge it by the biggest cuisine and common categories such as coffee and pizza';
    res.detail = ui.kv([
      ['ZIP code', `${z.zip} (${z.boro})`],
      ['Its fingerprint', liftTxt],
      ['Biggest cuisine', `${top.k} ${top.share}% (citywide ${top.city ?? '<0.1'}%)`],
      ['How to reason', z.lift.length ? `First find the cuisine whose bar runs far past its dot (${z.lift[0][0]}), which often points to a particular community, then see which ${z.boro} neighborhood on the map fits.` : 'With no strong specialty, rule out areas with a clear ethnic identity first, then guess among the rest from trendy-area signals such as coffee and Japanese.'],
    ]);
    return res;
  },
};
