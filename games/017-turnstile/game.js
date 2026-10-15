// #17 Turnstile — a station's hourly ridership curve (weekday vs weekend); name the station.
import { haversineKm, bearingDeg, arrow } from '../../engine/core.js';

const sum = (a, i = 0, j = a.length) => a.slice(i, j).reduce((x, y) => x + y, 0);
const hh = (h) => `${String(h).padStart(2, '0')}:00`;
const hc = (h) => `${String(h).padStart(2, '0')}h`;
const peakHour = (a) => a.indexOf(Math.max(...a));

/** Summarise a station's curves into the pattern features used for clues and teaching. */
export function profile(s) {
  const day = sum(s.wk);
  const am = sum(s.wk, 6, 10), pm = sum(s.wk, 16, 20), night = sum(s.wk, 22, 24) + sum(s.wk, 0, 4);
  const weekend = sum(s.we);
  const ratio = weekend / day;
  let kind;
  if (ratio > 0.85) kind = 'Weekends nearly as busy as weekdays: a tourist, shopping or entertainment destination';
  else if (am > pm * 1.35) kind = 'Morning rush far above the evening rush: a residential area where people start their commute';
  else if (pm > am * 1.35) kind = 'Evening rush far above the morning rush: an office district where people leave for home';
  else kind = 'Morning and evening peaks about equal: a transfer hub or mixed-use area';
  return { day, am, pm, night, weekend, ratio, peakWk: peakHour(s.wk), peakWe: peakHour(s.we), nightShare: night / day, kind };
}

export const lines = (name) => (name.match(/\(([^)]*)\)\s*$/) || [, ''])[1];
export const shortName = (name) => name.replace(/\s*\([^)]*\)\s*$/, '');

/** Stops between two stations (fewest rail hops; a transfer inside a station complex costs 0). */
export function hopsBetween(data, i, j) {
  const c = data.hops[i][j];
  return c === '~' ? null : c.charCodeAt(0) - 48;  // one char per station: '0' + stops, '~' = unreachable
}

export const MAX_GUESSES = 6;
/** Win: 100 → 17 by guess count. Loss: up to 15 for getting close, measured in stops from the nearest miss. */
export function scoreGuess(n, won, best, max = MAX_GUESSES) {
  if (won) return Math.round((100 * (max - n + 1)) / max);
  return Math.round(15 * Math.max(0, 1 - (best ?? 12) / 12));
}

export default {
  meta: {
    num: 17,
    slug: 'turnstile',
    title: 'Turnstile',
    tagline: 'A New York subway station\'s 24-hour entry curve, weekday vs. weekend. Read the rhythm of the crowd and name the station; misses are measured in stops.',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      'The chart shows a station\'s average entries per hour in September 2025: the solid line is weekdays, the dashed line weekends.',
      'A tall morning peak means a residential area (people start out here); a tall evening peak means an office district; weekends that rise instead of fall mean tourists or entertainment; a busy small hours points downtown or nightlife.',
      'Pick a station from the list, up to 6 guesses. Every miss unlocks another clue (borough, lines, ridership rank, first letter).',
      'Each guess tells you how many stops lie between it and the answer (fewest stops along the lines; transfers inside a station do not count), the direction, how many times busier the answer is, and whether the peak hour matches.',
    ],
    scoring: '100 points for a first-try hit, about 17 fewer for each extra guess. If you miss all six, your closest guess earns 0\u201315 points (0 stops away is full, 12 or more is 0).',
    sources: [
      { name: 'MTA Subway Hourly Ridership: Beginning 2025 (NY Open Data)', url: 'https://data.ny.gov/Transportation/MTA-Subway-Hourly-Ridership-Beginning-2025/5wq4-mkjj', note: 'Card-swipe entries by station and hour for Sept 2025; Labor Day excluded from weekdays' },
      { name: 'MTA Subway Stations (NY Open Data)', url: 'https://data.ny.gov/Transportation/MTA-Subway-Stations/39hk-dx4f', note: 'Maps station complexes to GTFS stop IDs' },
      { name: 'MTA static GTFS: subway', url: 'https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip', note: 'Train stop order gives the number of stops between stations' },
    ],
    dataNote: 'The data are daily averages for September 2025 (21 weekdays, 8 weekend days), not live turnstile counts. The answer is drawn only from the 160 busiest station complexes, but all 424 stations can be guessed. \u201cStops apart\u201d is the fewest stops along GTFS train stop order: transfers inside a station and walking transfers do not count, and express and local trains are not distinguished. Nothing is fetched live: every player must see the same data, so this monthly snapshot is used.',
  },

  puzzle({ data, pick }) {
    const s = pick(data.stations.filter((x) => x.pool));
    return { id: s.id };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const data = ctx.data;
    const all = data.stations;
    const byId = new Map(all.map((s) => [s.id, s]));
    const index = new Map(all.map((s, i) => [s.id, i]));
    const ans = byId.get(p.id);
    const pf = profile(ans);
    const profs = new Map(all.map((s) => [s.id, profile(s)]));
    const rank = 1 + all.filter((s) => profs.get(s.id).day > pf.day).length;
    const hopsTo = (id) => hopsBetween(data, index.get(id), index.get(ans.id));
    ctx.log('answer', ans.name, pf, 'rank', rank);

    const rows = [];
    for (let h = 0; h < 24; h++) {
      rows.push({ h, v: ans.wk[h], k: 'Weekday' });
      rows.push({ h, v: ans.we[h], k: 'Weekend' });
    }
    const chart = await ui.plot((Plot, c) => ({
      height: 280,
      marginLeft: 52,
      x: { label: null, domain: [0, 23], ticks: [0, 6, 12, 18], tickFormat: (h) => hh(h) },
      y: { label: 'Entries per hour', grid: true, tickFormat: (v) => core.fmtCompact(v) },
      marks: [
        Plot.lineY(rows.filter((r) => r.k === 'Weekday'), { x: 'h', y: 'v', stroke: c.accent, strokeWidth: 2.5, curve: 'monotone-x' }),
        Plot.lineY(rows.filter((r) => r.k === 'Weekend'), { x: 'h', y: 'v', stroke: c.ink, strokeWidth: 2, strokeDasharray: '5 4', curve: 'monotone-x' }),
        Plot.ruleY([0]),
        Plot.tip(rows, Plot.pointerX({ x: 'h', y: 'v', title: (d) => `${d.k} ${hh(d.h)}\n${core.fmtNum(d.v)} entries/hour` })),
      ],
    }));

    const fact = (t) => ui.h('div', t);
    const sn = shortName(ans.name);
    const clues = [
      ui.h('div', chart, ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '16px', marginTop: '6px' } },
        ui.h('span', ui.h('span', { style: { color: 'var(--accent)' } }, '━'), ' Weekdays'),
        ui.h('span', '\u2504 Weekends'))),
      fact(`Borough: ${ans.borough}.`),
      fact(`Lines serving it: ${lines(ans.name).split(',').join(' ')}`),
      fact(`Weekday ridership ranks ${rank} of ${all.length} stations. Weekends are ${core.fmtNum(pf.ratio * 100)}% of weekdays, with the weekend peak at ${hh(pf.peakWe)}.`),
      fact(`The station name starts with \u201c${sn[0]}\u201d and has ${sn.length} characters.`),
    ];

    const options = all.map((s) => ({ id: s.id, label: s.name, hint: s.borough, aliases: [shortName(s.name)] }));

    let best = null;
    const res = await ctx.guess({
      options,
      answer: ans.id,
      maxGuesses: MAX_GUESSES,
      title: 'Which station is this?',
      placeholder: 'Type a station or line\u2026',
      cluesTitle: 'Ridership curve and clues',
      clues,
      columns: ['Stops', 'Dir.', 'Busy', 'Peak'],
      near: (g) => (hopsTo(g.id) ?? 99) <= 3,
      onGuess: (g) => { const k = hopsTo(g.id); if (k != null && (best == null || k < best)) best = k; ctx.log('guess', g.label, k, 'stops'); },
      scoring: (n, won) => scoreGuess(n, won, best),
      feedback: (g) => {
        const gs = byId.get(g.id);
        const gp = profs.get(gs.id);
        if (gs.id === ans.id) return [{ text: '0', state: 'hit', num: true }, { text: '🎯', state: 'hit' }, { text: '1.0×', state: 'hit', num: true }, { text: hc(gp.peakWk), state: 'hit', num: true }];
        const k = hopsTo(gs.id);
        const q = pf.day / gp.day;
        return [
          { text: k == null ? '—' : `${k}`, num: true, state: k != null && k <= 3 ? 'near' : undefined },
          { text: arrow(bearingDeg(gs, ans)) },
          { text: q >= 1 ? `×${q.toFixed(1)}` : `÷${(1 / q).toFixed(1)}`, num: true, state: q > 0.75 && q < 1.33 ? 'near' : undefined },
          { text: hc(gp.peakWk), num: true, state: gp.peakWk === pf.peakWk ? 'hit' : Math.abs(gp.peakWk - pf.peakWk) <= 1 ? 'near' : undefined },
        ];
      },
    });

    const pm = pf.pm / pf.am;
    const tells = [
      `Morning rush (06\u201310) ${core.fmtNum(pf.am)}, evening rush (16\u201320) ${core.fmtNum(pf.pm)}, evening/morning = ${pm.toFixed(2)}: ${pm > 1.35 ? (pf.ratio > 0.85 ? 'the evening rush is higher, but weekends are just as busy, so it is not only commuters' : 'the evening rush is clearly higher: many people heading home, so an office district') : pm < 1 / 1.35 ? (pf.ratio > 0.85 ? 'the morning rush is higher, but weekends are just as busy, so it is not only commuters' : 'the morning rush is clearly higher: many people leaving for work, so a residential area') : 'the two are close, with no clear one-way commute'}.`,
      `Weekends are ${core.fmtNum(pf.ratio * 100)}% of weekdays: ${pf.ratio > 0.85 ? 'barely a drop, so tourists and leisure traffic hold it up' : pf.ratio < 0.5 ? 'a big drop, so it runs mainly on commuters' : 'a moderate drop, with commuting and leisure each playing a part'}.`,
      `Late night (22\u201304) is ${core.fmtNum(pf.nightShare * 100)}% of the day: ${pf.nightShare > 0.12 ? 'still people about at night, mostly downtown or in nightlife areas' : 'very quiet at night, more of a residential or office area'}.`,
    ];
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['Answer', ans.name],
        ['Borough', ans.borough],
        ['Weekday ridership', `${core.fmtNum(pf.day)} entries/day (rank ${rank})`],
        ['Peak hour', `weekdays ${hh(pf.peakWk)}, weekends ${hh(pf.peakWe)}`],
        ['Your closest guess', best == null ? '\u2014' : best === 0 ? 'hit' : `${best} stop${best === 1 ? '' : 's'} away`],
      ]),
      ui.callout(`The clue is in the curve: ${pf.kind}.`, 'good'),
      ui.h('ul', { class: 'small ink2' }, ...tells.map((t) => ui.h('li', t))));
    ctx.log('result', res.score);
    return res;
  },
};
