// #30 Concurrent — five 24-hour "players online" curves from Steam, paired to five games.
// Data: steamcharts.com hourly Steam concurrent-player samples (last ~4 weeks, snapshot in data.json).

/** Time zones used in the explanation (fixed offsets; every date in the pool is before the Oct-25 EU clock change). */
export const ZONES = [['Beijing', 8], ['Berlin', 2], ['New York', -4]];

/** Wall-clock label for a UTC hour at an offset, e.g. localHour(13, 8) -> "21:00". */
export function localHour(utc, off) {
  const h = (((utc + off) % 24) + 24) % 24;
  return `${String(Math.floor(h)).padStart(2, '0')}:00`;
}

/** "1.2M" / "856K" / "12.3K" / "9,800" style label for a player count. */
export function fmtPlayers(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e5) return `${(n / 1e3).toFixed(0)}K`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return Math.round(n).toLocaleString('en-US');
}

export const peakHour = (v) => v.indexOf(Math.max(...v));
export const depth = (v) => Math.min(...v) / Math.max(...v);

/** Turn a game's shape into a one-line, puzzle-specific tell. */
export function tell(item) {
  const d = depth(item.v), ph = peakHour(item.v);
  const dep = Math.round(d * 100);
  const shape = d < 0.2 ? `Very deep trough: the low is only ${dep}% of the peak, so players are concentrated in a few neighboring time zones`
    : d < 0.45 ? `A clear day-night swing: the low is ${dep}% of the peak, with the core audience in one region`
    : `A flat curve: even the low is ${dep}% of the peak, so players are spread across every time zone`;
  const loc = ZONES.map(([n, o]) => `${n} ${localHour(ph, o)}`).join(' \u00b7 ');
  return `${shape}; the peak is at ${String(ph).padStart(2, '0')}:00 UTC (${loc}).`;
}

export default {
  meta: {
    num: 30, slug: 'concurrent', title: 'Concurrent', category: 'tech', data: 'snapshot',
    tagline: 'Five 24-hour Steam player curves, five games. Match them: time-zone peaks and popularity give them away.',
    howTo: [
      'Each card is one game\u2019s concurrent players over 24 hours (UTC) on a single day. The curve is scaled to that day\u2019s own peak, and the absolute peak player count is printed on the card.',
      'Start with the shape. A deep trough with a peak in the Asian evening usually means a mostly-Asian audience; a flat curve means players in every time zone. Then use popularity to decide.',
      'Match each curve to a game (each game once). After you submit, correct pairs are marked. You get 3 tries.',
    ],
    scoring: 'Each pair is worth 20 points: correct on the 1st submission earns 100% of that, on the 2nd 67%, on the 3rd 33%, and still wrong after 3 earns 0.',
    sources: [
      { name: 'Steam Charts (steamcharts.com)', url: 'https://steamcharts.com/', note: 'hourly concurrent-player samples from each game\u2019s chart-data.json, about 28 days' },
      { name: 'Steam Web API: GetNumberOfCurrentPlayers', url: 'https://partner.steamgames.com/doc/webapi/ISteamUserStats#GetNumberOfCurrentPlayers', note: 'the official endpoint only returns the count right now, with no history, so it is not used for puzzles' },
    ],
    dataNote: 'Steam concurrent players from 2026-09-17 to 2026-10-14 (days when the count collapsed below 5% of the peak, i.e. outages, are removed). Steamcharts samples roughly hourly; we average each UTC hour. Steam\u2019s official API returns only the current count, SteamDB blocks scripted access, and the steamcharts data endpoint sends no CORS header, so nothing can be fetched live in the browser: this is a snapshot downloaded at build time. Isolated sampling glitches (a single sharp dip) were repaired by interpolating neighboring hours. The pool has 90 puzzles, random combinations of 51 games and about 28 dates (the same game\u2019s curve differs a little from day to day).',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    const items = p.ids.map((id) => {
      const g = data.games[id], d = g.days[p.date];
      return { id: String(id), name: g.name, note: g.note ?? null, peak: d.p, v: d.v };
    });
    return { date: p.date, items };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const order = ctx.rng.shuffle([...p.items]);
    ctx.log('puzzle', p.date, p.items.map((i) => i.name).join(' | '));
    const bodies = await Promise.all(order.map((it, i) => ui.plot((Plot, c) => ({
      height: 130, width: 300, marginLeft: 38, marginBottom: 24, marginTop: 8,
      x: { domain: [0, 23], ticks: [0, 6, 12, 18], tickFormat: (h) => String(h).padStart(2, '0'), label: null },
      y: { domain: [0, 100], ticks: [0, 50, 100], label: null, tickFormat: (v) => `${v}%` },
      marks: [
        Plot.areaY(it.v.map((v, h) => ({ h, v: v / 10 })), { x: 'h', y: 'v', fill: c.series[i % c.series.length], fillOpacity: 0.18, curve: 'monotone-x' }),
        Plot.lineY(it.v.map((v, h) => ({ h, v: v / 10 })), { x: 'h', y: 'v', stroke: c.series[i % c.series.length], strokeWidth: 2, curve: 'monotone-x' }),
        Plot.ruleY([0], { stroke: c.muted, strokeOpacity: 0.4 }),
      ],
    }))));
    ctx.stage.append(ui.panel({ kicker: `${p.date} · UTC`, title: 'Which curve is which game?' },
      ui.h('p', { class: 'small muted' }, 'The x-axis is the UTC hour; the y-axis is concurrent players as a percent of that day\u2019s peak. Cheat sheet: 12:00 UTC = 20:00 Beijing = 14:00 Berlin = 08:00 New York.')));
    const res = await ctx.match({
      left: order.map((it, i) => ({ id: it.id, label: `Day\u2019s peak: ${fmtPlayers(it.peak)} online`, body: bodies[i] })),
      right: [...p.items].sort((a, b) => a.name.localeCompare(b.name)).map((it) => ({ id: it.id, label: it.name })),
      answer: Object.fromEntries(order.map((it) => [it.id, it.id])),
      attempts: 3, title: 'Match curves to games', minWidth: 280,
    });
    // teaching: overlay of all five curves + one block per game with its tell
    const overlay = await ui.plot((Plot, c) => ({
      height: 200, marginLeft: 40, marginRight: 10, marginTop: 10,
      x: { domain: [0, 23], ticks: [0, 6, 12, 18, 23], tickFormat: (h) => String(h).padStart(2, '0'), label: null },
      y: { domain: [0, 100], ticks: [0, 50, 100], label: null, tickFormat: (v) => `${v}%` },
      marks: [
        ...p.items.map((it, i) => Plot.lineY(it.v.map((v, h) => ({ h, v: v / 10 })), { x: 'h', y: 'v', stroke: c.series[i % c.series.length], strokeWidth: 2, curve: 'monotone-x' })),
        ...p.items.map((it, i) => Plot.dot([{ h: peakHour(it.v), v: 100 }], { x: 'h', y: 'v', fill: c.series[i % c.series.length], r: 3.5 })),
      ],
    }));
    const col = ui.colors().series;
    const byPeak = [...p.items].sort((a, b) => peakHour(a.v) - peakHour(b.v));
    const early = byPeak[0], late = byPeak.at(-1);
    const sortedByDepth = [...p.items].sort((a, b) => depth(a.v) - depth(b.v));
    const hh = (it) => String(peakHour(it.v)).padStart(2, '0');
    const blocks = byPeak.map((it) => ui.h('div', { style: { borderLeft: `4px solid ${col[p.items.indexOf(it) % col.length]}`, padding: '2px 0 2px 10px', margin: '8px 0' } },
      ui.h('div', {}, ui.h('b', {}, it.name), ui.h('span', { class: 'small muted' }, `  \u00b7 day\u2019s peak ${fmtPlayers(it.peak)} online`)),
      ui.h('div', { class: 'small' }, tell(it) + (it.note ? ` ${it.note}` : ''))));
    res.detail = ui.h('div', {},
      ui.h('p', { class: 'small' }, `Of these five curves, ${early.name} peaks earliest (${hh(early)}:00 UTC, evening in the eastern hemisphere) and ${late.name} latest (${hh(late)}:00 UTC, evening in the Americas). The deepest trough belongs to ${sortedByDepth[0].name} (its low is only ${Math.round(depth(sortedByDepth[0].v) * 100)}% of its peak) and the flattest curve to ${sortedByDepth.at(-1).name} (${Math.round(depth(sortedByDepth.at(-1).v) * 100)}%).`),
      overlay,
      ui.h('div', {}, blocks),
      ui.h('p', { class: 'small muted' }, 'The pattern: where most players live sets the UTC hour of the peak (8\u201310 pm local), and the more concentrated they are in one region, the deeper the trough. A global game stays flat because someone is always awake.'));
    return res;
  },
};
