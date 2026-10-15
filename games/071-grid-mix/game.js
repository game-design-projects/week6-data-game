// #71 Grid Mix — one day of hourly generation by fuel for a US balancing authority; name the grid.
// Duck curve = solar-heavy west, flat nuclear band = Southeast/Northeast, hydro = Northwest.

export const FUEL_NAME = { coal: 'Coal', gas: 'Natural gas', nuclear: 'Nuclear', oil: 'Oil', hydro: 'Hydro', solar: 'Solar', wind: 'Wind', other: 'Other' };

/** Per-fuel daily totals, shares and solar peak hour from a puzzle's hourly arrays (values in `unit` MW). */
export function summarize(m, unit = 10) {
  const fuels = Object.keys(m);
  const tot = Object.fromEntries(fuels.map((k) => [k, m[k].reduce((a, b) => a + b, 0) * unit]));
  const all = fuels.reduce((a, k) => a + tot[k], 0) || 1;
  const share = Object.fromEntries(fuels.map((k) => [k, tot[k] / all]));
  const hourly = m[fuels[0]].map((_, i) => fuels.reduce((a, k) => a + m[k][i], 0) * unit);
  const solarPeak = m.solar ? m.solar.indexOf(Math.max(...m.solar)) : -1; // 0-based hour-ending index
  return { tot, share, all, hourly, peak: Math.max(...hourly), mean: all / 24, solarPeak, dominant: fuels.reduce((a, k) => (tot[k] > tot[a] ? k : a), fuels[0]) };
}

export const TZ_NAME = { '-5': 'Eastern', '-6': 'Central', '-7': 'Mountain', '-8': 'Pacific' };
const pct0 = (x) => `${Math.round(x * 100)}%`;
const hh = (i) => `${String(((i % 24) + 24) % 24).padStart(2, '0')}:00`;

/** Puzzle-specific "why it gave itself away" sentences, computed from the hourly arrays and the BA's typical mix. */
export function explain(m, ans, unit = 10) {
  const S = summarize(m, unit);
  const notes = [];
  const typTop = Object.entries(ans.typ ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${FUEL_NAME[k].toLowerCase()} ${v}%`).join(', ');
  const lo = S.hourly.indexOf(Math.min(...S.hourly)), hi = S.hourly.indexOf(S.peak);
  notes.push(`Generation bottomed out around ${hh(lo)} at about ${gw(Math.min(...S.hourly))} and peaked around ${hh(hi)} at about ${gw(S.peak)}, a peak-to-trough ratio of ${(S.peak / Math.min(...S.hourly)).toFixed(2)}.`);
  if (S.share.solar > 0.04) {
    const gasDay = m.gas ? m.gas.slice(10, 15).reduce((a, b) => a + b, 0) : 0;
    const gasEve = m.gas ? m.gas.slice(18, 22).reduce((a, b) => a + b, 0) : 0;
    notes.push(`Solar is ${pct0(S.share.solar)}, peaking around ${hh(S.solarPeak)} and fading at sunset${gasEve / 4 > gasDay / 5 * 1.15 ? ', when natural gas ramps up to cover it: the \u201cduck curve\u201d' : ''}.`);
  }
  if (S.share.nuclear > 0.08) {
    const a = m.nuclear, mean = a.reduce((x, y) => x + y, 0) / 24, dev = Math.max(...a.map((v) => Math.abs(v - mean))) / (mean || 1);
    notes.push(`Nuclear is ${pct0(S.share.nuclear)}${dev < 0.1 ? ' and runs as a nearly flat band all day (baseload)' : ', with some units changing output that day'}.`);
  }
  if (S.share.hydro > 0.15) notes.push(`Hydro is ${pct0(S.share.hydro)}: only water-rich basins (the Columbia, Tennessee and St. Lawrence rivers, for example) look like this.`);
  if (S.share.wind > 0.12) notes.push(`Wind is ${pct0(S.share.wind)}, usually stronger at night, typical of the Plains and Texas.`);
  if (S.share.coal > 0.3) notes.push(`Coal is ${pct0(S.share.coal)}, typical of a traditional central or eastern grid.`);
  if (S.share.gas > 0.6) notes.push(`Natural gas is ${pct0(S.share.gas)}, a mix heavily dependent on gas.`);
  if (notes.length === 1) notes.push(`The main fuel is ${FUEL_NAME[S.dominant].toLowerCase()} (${pct0(S.share[S.dominant])}), a fairly one-note mix, so scale and time zone have to narrow it down.`);
  if (typTop) notes.push(`${ans.name} runs a long-run average mix of ${typTop}, which fits the shape of this day.`);
  return { S, notes };
}

const pct = (x) => `${Math.round(x * 100)}%`;
const gw = (mw) => (mw >= 1000 ? `${(mw / 1000).toFixed(1)} GW` : `${Math.round(mw)} MW`);

export default {
  meta: {
    num: 71,
    slug: 'grid-mix',
    title: 'Grid Mix',
    tagline: 'One day of hourly generation by fuel for a US grid region. The duck curve, hydro and nuclear baseload all give it away.',
    category: 'society',
    data: 'snapshot',
    howTo: [
      'The chart shows one day of hourly generation (local time, 0-23 h), stacked by fuel: coal, natural gas, nuclear, hydro, solar, wind and more.',
      'Read the shape: a midday dip (the \u201cduck curve\u201d) means the solar-heavy West; a flat nuclear base looks like the Southeast or Northeast; mostly hydro usually means the Northwest.',
      'Pick a grid region from the list, up to 6 guesses. Each miss unlocks a clue (scale, time zone, fuel shares, region...).',
      'Each guess tells you whether the region matches, whether the answer is bigger (\u2191) or smaller (\u2193) than your guess, and whether it lies east or west of it.',
    ],
    scoring: '100 points for a correct 1st guess, 83 for the 2nd, about 17 fewer for each extra guess, 17 for the 6th, and 0 if you miss all 6.',
    sources: [
      { name: 'EIA-930 Hourly Electric Grid Monitor (Balance half-year files)', url: 'https://www.eia.gov/electricity/gridmonitor/', note: 'Hourly net generation by fuel, Jul 2025 to Oct 2026' },
    ],
    dataNote: 'The EIA v2 API needs a key, and the public half-year CSVs (about 50 MB) have no CORS headers, so the browser cannot fetch \u201cyesterday\u201d directly. The game uses a snapshot downloaded by the build script (adjusted values, falling back to raw values when missing). It covers Jul 1, 2025 to Oct 14, 2026: 28 large grid regions with 6 dates each, spread across the seasons, 168 puzzles in all; daylight-saving change days are excluded. The y-axis shows absolute generation, so scale is itself a clue. The time-zone clue gives standard time, while the hours on the chart are local clock time during daylight saving.',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return { ba: p.ba, date: p.date };
  },

  async play(ctx, pz) {
    const { ui, core } = ctx;
    const D = ctx.data;
    const p = D.puzzles.find((x) => x.ba === pz.ba && x.date === pz.date);
    const bas = new Map(D.bas.map((b) => [b.id, b]));
    const ans = bas.get(pz.ba);
    const S = summarize(p.m, D.unit);
    ctx.log('puzzle', pz.ba, pz.date, 'dominant', S.dominant);

    const rows = [];
    D.fuels.forEach((k) => p.m[k].forEach((v, h) => rows.push({ fuel: FUEL_NAME[k], h, mw: v * D.unit })));
    const order = D.fuels.map((k) => FUEL_NAME[k]);
    const chart = await ui.plot((Plot, c) => ({
      height: 280,
      marginLeft: 52,
      marginBottom: 34,
      x: { label: null, domain: [0, 23], ticks: [0, 3, 6, 9, 12, 15, 18, 21], tickFormat: (v) => `${v}h` },
      y: { label: null, grid: true, tickFormat: (v) => `${v / 1000} GW` },
      color: { domain: order, range: ['#6f6f6f', c.accent, '#3a86c8', '#8a7f6a', '#2fa6a0', '#f0c020', '#7bc47f', '#b08bd0'], legend: true },
      marks: [Plot.areaY(rows, { x: 'h', y: 'mw', fill: 'fuel', order: order, tip: false }), Plot.ruleY([0])],
    }), { height: 320 });

    const clues = [
      ui.h('div', chart, ui.h('div', { class: 'muted', style: { fontSize: '12px' } }, 'x: local time; y: hourly generation across the grid (stacked by fuel)')),
      `On this day (${pz.date}) average generation was ${gw(S.mean)}, with a peak hour of ${gw(S.peak)}.`,
      `Time zone: ${TZ_NAME[ans.off] ?? ''}, standard time UTC${ans.off >= 0 ? '+' : '\u2212'}${Math.abs(ans.off)}.`,
      ui.h('div', 'Fuel shares over the day:', ui.h('div', { class: 'ds-row', style: { flexWrap: 'wrap', gap: '8px', marginTop: '6px' } },
        D.fuels.filter((k) => S.share[k] >= 0.005).sort((a, b) => S.share[b] - S.share[a]).map((k) => ui.badge(`${FUEL_NAME[k]} ${pct(S.share[k])}`)))),
      `Region: ${ans.area}.`,
      `The code starts with ${ans.id[0]}.`,
    ];

    const res = await ctx.guess({
      options: D.bas.map((b) => ({ id: b.id, label: b.name, hint: b.id, aliases: [b.id, b.area] })),
      answer: ans.id,
      maxGuesses: 6,
      title: 'Which grid region is this?',
      placeholder: 'Type a name or code, e.g. CISO…',
      clues,
      cluesTitle: 'Generation mix and clues',
      columns: ['Region', 'Size', 'Zone'],
      near: (g, a) => bas.get(g.id).area === bas.get(a.id).area,
      feedback: (g) => {
        const gb = bas.get(g.id);
        if (gb.id === ans.id) return [{ text: '✓', state: 'hit' }, { text: '✓', state: 'hit' }, { text: '✓', state: 'hit' }];
        const ratio = gb.mean / ans.mean;
        const dz = ans.off - gb.off;
        return [
          { text: gb.area === ans.area ? 'Same' : 'Other', state: gb.area === ans.area ? 'hit' : 'miss' },
          { text: `${ratio > 1 ? '\u2193' : '\u2191'} \u00d7${(ratio > 1 ? ratio : 1 / ratio).toFixed(1)}`, state: ratio > 0.6 && ratio < 1.6 ? 'near' : undefined, num: true },
          { text: dz === 0 ? 'Same zone' : `${dz > 0 ? '\u2192 east' : '\u2190 west'} ${Math.abs(dz)}h`, state: dz === 0 ? 'hit' : undefined, num: true },
        ];
      },
    });

    const { notes } = explain(p.m, ans, D.unit);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['Answer', `${ans.name} (${ans.id})`], ['Region', ans.area], ['Date', pz.date], ['Average generation', gw(S.mean)], ['Main fuel', `${FUEL_NAME[S.dominant]} ${pct(S.share[S.dominant])}`]]),
      ...notes.map((n) => ui.h('div', { class: 'ink2' }, n)));
    return res;
  },
};
