// #14 311 — a ZIP code's 311 complaint mix; pin where in NYC it is.
const DIRS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

export function borough(zip) {
  const p = String(zip).slice(0, 3), n = +p;
  if (n >= 100 && n <= 102) return 'Manhattan';
  if (n === 103) return 'Staten Island';
  if (n === 104) return 'The Bronx';
  if (n === 112) return 'Brooklyn';
  return 'Queens';
}

// rows for the clue bars: name, share %, citywide share %, lift ×
export function rowsFor(z, labels) {
  return z.top.map(([t, pct, avg]) => ({ t, name: labels[t] || t, pct, avg, lift: avg > 0 ? pct / avg : null }));
}

export default {
  meta: {
    num: 14,
    slug: '311',
    title: '311',
    tagline: 'Here is a year of 311 complaints from one NYC ZIP code. Pin that neighborhood on the map.',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      'The bars show the most common 311 complaint types in one ZIP code area in 2025, as a share of its complaints. The vertical tick is the citywide share.',
      'Don\'t look for the longest bar; look for bars far beyond the tick. Vendors, encampments and taxi complaints cluster in Midtown; heat and leaks in older apartment districts; blocked driveways and abandoned vehicles in outer residential areas.',
      'Pin where you think the ZIP code is (the closer to its center the better). You get 2 tries, and a miss on the first tells you the distance and direction.',
      'The reveal outlines the ZIP code area and shows which complaint types were most unusual.',
    ],
    scoring: '100 \u00d7 e^(\u2212distance / 4 km), where distance is from your pin to the ZIP code center. The second try costs 10%.',
    sources: [
      { name: 'NYC Open Data \u00b7 311 Service Requests from 2020 to Present', url: 'https://data.cityofnewyork.us/resource/erm2-nwe9.json', note: 'All of 2025, aggregated by ZIP code and complaint type' },
      { name: 'NYC Open Data \u00b7 Modified Zip Code Tabulation Areas (MODZCTA)', url: 'https://data.cityofnewyork.us/resource/pri4-ifjk.geojson', note: 'ZIP area boundaries, centers and population estimates' },
    ],
    dataNote: 'A snapshot of all of 2025 (the 311 API updates daily, but this game uses the fixed full year so everyone gets the same puzzle each day). ZIP areas follow NYC\'s MODZCTA grouping (a few small ZIP codes are merged, such as 10001/10118); only areas with at least 4,000 complaints a year and a modest size are kept. Complaint type names are reworded for readability.',
  },

  puzzle({ data, pick }) {
    return { zip: pick(data.zips).zip };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const z = ctx.data.zips.find((x) => x.zip === p.zip);
    const labels = ctx.data.labels;
    ctx.log('zip', z.zip, z.total, z.poly.length);
    const rows = rowsFor(z, labels);
    const maxV = Math.max(...rows.map((r) => Math.max(r.pct, r.avg ?? 0))) * 1.08;
    const pc = (v) => `${(100 * v / maxV).toFixed(2)}%`;
    const bars = ui.h('div', { class: 'ds-stack', style: { gap: '10px' } }, rows.map((r) =>
      ui.h('div', { class: 'ds-stack', style: { gap: '3px' } },
        ui.h('div', { class: 'ds-row', style: { justifyContent: 'space-between', gap: '8px', flexWrap: 'nowrap', alignItems: 'baseline' } },
          ui.h('span', { style: { flex: '1 1 auto', minWidth: 0 } }, r.name),
          ui.h('span', { class: 'mono small', style: { flex: '0 0 auto', whiteSpace: 'nowrap' } }, `${r.pct}%`, ui.h('span', { class: 'muted' }, ` \u00b7 citywide ${r.avg}%`))),
        ui.h('div', { style: { position: 'relative', height: '12px', background: 'var(--paper2)', borderRadius: '3px' } },
          ui.h('div', { style: { width: pc(r.pct), height: '100%', background: 'var(--accent)', borderRadius: '3px' } }),
          ui.h('div', { style: { position: 'absolute', top: '-3px', bottom: '-3px', left: pc(r.avg), width: '3px', marginLeft: '-1px', background: 'var(--ink)', borderRadius: '1px' } })))));
    ctx.stage.append(ui.panel({ kicker: `2025 \u00b7 ${core.fmtNum(z.total)} complaints`, title: 'What is this ZIP code complaining about?' }, bars,
      ui.h('div', { class: 'small muted', style: { marginTop: '10px' } }, 'Colored bar = this area\'s share; black tick = citywide share.')));

    const res = await ctx.pin({
      answer: { lat: z.lat, lng: z.lng, label: `ZIP ${z.zip}` },
      view: { bounds: [[40.49, -74.27], [40.92, -73.69]] },
      scale: 4,
      attempts: 2,
      title: 'Where in New York is it?',
      hint: (km, bearing) => `Off by ${km.toFixed(1)} km. Try looking farther ${DIRS[Math.round(bearing / 45) % 8]}.`,
      reveal: async ({ map, L }) => {
        const layer = L.polygon(z.poly, { color: '#e8590c', weight: 2, fillOpacity: 0.18 }).addTo(map);
        try { map.fitBounds(layer.getBounds().pad(2.5), { maxZoom: 14 }); } catch (e) { ctx.log.warn('fit', e); }
      },
    });
    const top = z.lift[0];
    const topRow = z.top.find((t) => t[0] === top[0]);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['ZIP code', z.zip], ['Borough', borough(z.zip)], ['Residents (estimate)', core.fmtNum(z.pop)], ['Complaints per resident', `${(z.total / Math.max(z.pop, 1)).toFixed(2)} per person per year`]]),
      ui.h('div', {}, `The key clue: \u201c${labels[top[0]] || top[0]}\u201d runs ${top[1]}\u00d7 the citywide share${topRow ? ` (${topRow[1]}% of this area\'s complaints)` : ''}. The three most unusual types:`),
      ui.table({ columns: [{ key: 't', label: 'Type' }, { key: 'x', label: 'Share vs. citywide', num: true }], rows: z.lift.map(([t, x]) => ({ t: labels[t] || t, x: `${x}×` })) }));
    return res;
  },
};
