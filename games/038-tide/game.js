// #38 Tide — three days of a harbour's predicted tide curve; pin the port.
// One high tide a day -> Gulf of Mexico / Alaska diurnal; huge range -> funnel bays (Cook Inlet); tiny range -> Pacific atolls.

/** Local maxima of a series (strict on the left, non-strict on the right to handle plateaus). */
export function peaks(v) {
  const out = [];
  for (let i = 1; i < v.length - 1; i++) if (v[i] > v[i - 1] && v[i] >= v[i + 1]) out.push(i);
  return out;
}

/** Classify the tide type from hourly heights over 3 days. */
export function analyse(v) {
  const hi = peaks(v);
  const lo = peaks(v.map((x) => -x));
  const range = Math.max(...v) - Math.min(...v);
  const perDay = hi.length / (v.length / 24);
  // diurnal inequality: how unequal are consecutive lows (or highs)?
  const ineq = (idx) => (idx.length < 2 ? 0 : idx.slice(1).reduce((s, i, k) => s + Math.abs(v[i] - v[idx[k]]), 0) / (idx.length - 1) / (range || 1));
  const unequal = Math.max(ineq(hi), ineq(lo)) > 0.22;
  const kind = perDay < 1.35 ? 'diurnal' : unequal ? 'mixed' : 'semi';
  const type = { diurnal: 'Diurnal (about 1 high tide a day)', mixed: 'Mixed (two highs or lows of unequal height)', semi: 'Semidiurnal (about 2 high tides a day, similar heights)' }[kind];
  return { hi, lo, range, perDay, type, kind };
}

const hhmm = (h) => `${String(h % 24).padStart(2, '0')}:00`;

/** Shape a CO-OPS hourly prediction response (3 days) into a puzzle series; throws if unusable. */
export function toPuzzle(raw, id, begin) {
  const rows = raw?.predictions;
  if (!Array.isArray(rows) || rows.length < 72) throw new Error('tide: need 72 hourly predictions');
  const v = rows.slice(0, 72).map((p) => +(+p.v).toFixed(2));
  if (v.some((x) => !Number.isFinite(x))) throw new Error('tide: non-numeric prediction');
  if (Math.max(...v) - Math.min(...v) < 0.05) throw new Error('tide: flat series');
  return { id, begin, v };
}

/** Coarse, honest region label for the result card (from state code / coordinates). */
export function region(st) {
  const s = st.state;
  if (s === 'AK') return 'Alaska';
  if (s === 'HI') return 'Hawaii';
  if (['WA', 'OR', 'CA'].includes(s)) return 'North American Pacific coast';
  if (['TX', 'LA', 'MS', 'AL'].includes(s)) return 'Northern Gulf of Mexico coast';
  if (['ME', 'NH', 'MA', 'RI', 'CT', 'NY', 'NJ', 'DE', 'MD', 'VA', 'NC', 'SC', 'GA'].includes(s)) return 'North American Atlantic coast';
  if (s === 'FL') return 'Florida';
  if (s === 'PR') return 'Caribbean';
  if (st.lng > 60 || st.lng < -130) return 'Pacific / Indian Ocean islands';
  if (st.lng > -100 && st.lng < -60 && st.lat > 5) return 'Caribbean / Gulf of Mexico';
  return 'Latin American Pacific coast';
}

/** Hours of the high tides on each of the 3 days (empty array when a day has none). */
export function dailyHighs(v) {
  const hi = peaks(v);
  return [0, 1, 2].map((d) => hi.filter((h) => h >= d * 24 && h < d * 24 + 24).map((h) => h % 24));
}

export default {
  meta: {
    num: 38,
    slug: 'tide',
    title: 'Tide',
    tagline: 'Three days of a harbor\'s tide curve. Guess the port. Only one high tide a day? Think Gulf of Mexico.',
    category: 'science',
    data: 'live',
    howTo: [
      'The chart shows hourly tide predictions for a tide station for 3 days (72 hours) starting today, in local standard time, with 0 at the lowest low-water datum.',
      'Count the high tides per day. One a day (diurnal) is common in the Gulf of Mexico and parts of Alaska; two of similar height (semidiurnal) is the Atlantic coast; two highs and two lows of unequal height (mixed) is the Pacific coast.',
      'Tidal range is a clue too: Pacific atolls see only tens of centimeters, while funnel-shaped bays can reach several meters, even ten.',
      'Pin the station on the map (no place names are shown at first). It is scored by distance. You can try once more and get a hint about which direction you missed in; the second try costs at most 15%.',
    ],
    scoring: '100 × e^(−distance / 1,500 km), and the second try costs 15%. The closer the better: within about 1,000 km is good, and on the same coastline you usually get 70 or more.',
    sources: [
      { name: 'NOAA CO-OPS Tide Predictions API', url: 'https://api.tidesandcurrents.noaa.gov/api/prod/' },
      { name: 'NOAA CO-OPS Metadata API (stations)', url: 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/' },
    ],
    dataNote: 'The curves are NOAA\'s official harmonic-analysis predictions, not measured water levels. Each day\'s station is fixed (drawn by day from 109 reference stations, sampled farthest-point-first to cover the US coasts, Alaska, Hawaii and outlying Pacific and Caribbean stations). When the page opens it fetches that station\'s 3-day hourly predictions live from the NOAA CO-OPS Predictions API (harmonic predictions are deterministic, so everyone sees the same curve). If that fails it falls back to a snapshot: the same set of predictions for Oct 1 to Oct 3, 2026. You pin the location instead of picking a name from a list because many CO-OPS reference stations have obscure names (like Coon Key), and scoring by distance is fairer.',
  },

  async load(ctx) {
    const st = ctx.pick(ctx.data.stations);
    const q = (d) => d.replaceAll('-', '');
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=dailygames&begin_date=${q(ctx.date)}&end_date=${q(ctx.core.addDays(ctx.date, 2))}&datum=MLLW&station=${st.id}&time_zone=lst&units=metric&interval=h&format=json`;
    const raw = await ctx.fetchJSON(url, { timeout: 8000 });
    return { ...ctx.data, live: toPuzzle(raw, st.id, ctx.date) };
  },

  puzzle({ data, pick }) {
    const st = pick(data.stations);
    const live = data.live?.id === st.id ? data.live : null;
    return { id: st.id, begin: live?.begin ?? data.begin, v: live?.v ?? st.v, live: !!live };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const st = ctx.data.stations.find((s) => s.id === p.id);
    const v = p.v;
    const a = analyse(v);
    ctx.log('station', st.name, 'live', p.live, 'begin', p.begin, 'range', a.range.toFixed(2), 'highs', a.hi.length);
    const rows = v.map((v, h) => ({ h, v }));
    const day = (h) => ctx.core.addDays(p.begin, Math.floor(h / 24)).slice(5);
    const chart = await ui.plot((Plot, c) => ({
      height: 260,
      marginLeft: 44,
      x: { domain: [0, 71], ticks: [0, 12, 24, 36, 48, 60, 71], tickFormat: (h) => (h % 24 === 0 ? day(h) : hhmm(h)), label: null },
      y: { label: 'Tide level (m)', grid: true, domain: [Math.min(0, ...v) - 0.1, Math.max(...v) + 0.15] },
      marks: [
        Plot.ruleX([24, 48], { stroke: c.rule, strokeDasharray: '3 4' }),
        Plot.areaY(rows, { x: 'h', y: 'v', y1: Math.min(...v), fill: c.accent, fillOpacity: 0.14, curve: 'basis' }),
        Plot.lineY(rows, { x: 'h', y: 'v', stroke: c.accent, strokeWidth: 2.5, curve: 'basis' }),
        Plot.dot(a.hi.map((h) => rows[h]), { x: 'h', y: 'v', fill: c.ink, r: 3.5 }),
        Plot.tip(rows, Plot.pointerX({ x: 'h', y: 'v', title: (d) => `${day(d.h)} ${hhmm(d.h)}\n${d.v.toFixed(2)} m` })),
      ],
    }));
    ctx.stage.append(ui.panel({ kicker: `3 days from ${p.begin.slice(5)} · hourly · local standard time`, title: 'The tide at this port' }, chart,
      ui.h('div', { class: 'ds-grid', style: { '--min': '130px', marginTop: '12px' } },
        ui.stat({ label: 'Max range', value: `${a.range.toFixed(2)} m` }),
        ui.stat({ label: 'High tides', value: `${a.hi.length}`, sub: 'in 3 days (black dots)' }),
        ui.stat({ label: 'First high tide', value: hhmm(a.hi[0] ?? 0), sub: `${day(0)}` }))));

    const res = await ctx.pin({
      answer: { lat: st.lat, lng: st.lng, label: st.name },
      view: { center: [0, -150], zoom: 1 },
      scale: 1500,
      attempts: 2,
      title: 'Where is the tide station?',
    });
    const hs = dailyHighs(v);
    const times = hs.map((x, d) => `${day(d * 24)} ${x.length ? x.map((h) => hhmm(h)).join(', ') : 'none'}`).join('; ');
    const where = region(st);
    const tip = { diurnal: 'One high tide a day: typical of the Gulf of Mexico, the South China Sea and parts of the Alaska coast.', semi: 'Semidiurnal tides dominate: most typical of the North Atlantic coast.', mixed: 'Strong daily inequality: the classic mixed tide of the North American Pacific coast.' }[a.kind];
    res.detail = ui.kv([
      ['Tide station', `${st.name}${st.state ? ', ' + st.state : ''} (${where})`],
      ['Coordinates', `${st.lat.toFixed(2)}°, ${st.lng.toFixed(2)}°`],
      ['Tide type', a.type],
      ['The clue', `${a.hi.length} high tides in 3 days, with a maximum range of ${a.range.toFixed(2)} m. ${tip}` +
        (a.range < 1 ? ' A very small range usually means an island or atoll in the open ocean, a semi-enclosed sea or an Arctic coast.' : a.range > 4 ? ' A very large range usually means a funnel-shaped bay or a high-latitude shelf (like Alaska or the Bay of Fundy).' : '')],
      ['High tide times', `${times}. Each day the tide runs about 50 minutes later (a lunar day is 24 h 50 min), and that drift over the three days can help you judge the tide type.`],
    ]);
    return res;
  },
};
