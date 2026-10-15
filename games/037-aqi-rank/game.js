// #37 AQI Rank — rank 5 cities by yesterday's daily-mean PM2.5, using only the prior two weeks as a clue.
import { mean, band, addDays, toLive, validSet } from './shape.js';
export { mean, band, addDays, toLive, validSet };

const API = 'https://air-quality-api.open-meteo.com/v1/air-quality';

/** Heuristic baseline: how many of the 5 positions a ranking by `key` gets right. */
export const heuristicHits = (rows, key) => {
  const truth = rows.slice().sort((a, b) => b.val - a.val).map((r) => r.en);
  return rows.slice().sort((a, b) => b[key] - a[key]).filter((r, i) => r.en === truth[i]).length;
};

export default {
  meta: {
    num: 37, slug: 'aqi-rank', title: 'AQI Rank',
    tagline: 'Rank five cities by yesterday\u2019s PM2.5, from dirtiest to cleanest. Your only clue is the two weeks before.',
    category: 'science', data: 'live',
    howTo: [
      'Each city shows its PM2.5 for the 14 days before the target day (one shared vertical axis, so heights compare directly), the two-week average and the value for the day before, in \u00b5g/m\u00b3. Higher is dirtier.',
      'Drag or use \u2191\u2193 to rank the five cities by their daily mean PM2.5 on the target day (yesterday, UTC), highest first. You get up to 3 submissions, and each tells you how many positions are right.',
      'Air pollution has inertia, but wind, rain and dust storms can swing a single day far from the average. Watch for a sudden move at the end of each curve.',
    ],
    scoring: 'Correct order: 100 / 67 / 33 points (1st / 2nd / 3rd submission). If none of the 3 is right, 0\u201330 points by the number of correct positions in your last try.',
    sources: [{ name: 'Open-Meteo Air Quality API (Copernicus CAMS)', url: 'https://open-meteo.com/en/docs/air-quality-api', note: 'no key, CORS enabled; OpenAQ v3 needs an API key and has no CORS, so it is not used' }],
    dataNote: 'Each day, your browser asks Open-Meteo for the last 15 days of hourly PM2.5 for 50 cities (CAMS atmospheric-composition model analysis/forecast values, not ground-station readings) and takes UTC daily means. The target day is the day before the puzzle date, so every player gets the same data. The five cities are drawn deterministically from the date, and neighbors in the ranking must differ by at least 20%. If the request fails, the game falls back to a snapshot puzzle in data.json from July to October 2026 (the target day is then a day inside the snapshot).',
  },

  puzzle({ data, pick, rng }) {
    const L = data.live;
    if (L) {
      for (let k = 0; k < 400; k++) {
        const set = rng.sample(L.cities, 5);
        if (validSet(set)) return { live: true, date: L.date, cities: set.map(({ en, prev, val }) => ({ en, prev, val })) };
      }
    }
    const p = pick(data.puzzles);
    return { live: false, date: data.dates[p.t], cities: p.c.map((ci) => ({ en: data.cities[ci].en, prev: data.pm[ci].slice(p.t - 14, p.t), val: data.pm[ci][p.t] })) };
  },

  async load(ctx) {
    const day = addDays(ctx.date, -1);
    const cs = ctx.data.cities;
    const url = `${API}?latitude=${cs.map((c) => c.lat).join(',')}&longitude=${cs.map((c) => c.lng).join(',')}&hourly=pm2_5&start_date=${addDays(day, -14)}&end_date=${day}&timezone=UTC`;
    ctx.log('live request', day);
    const raw = await ctx.fetchJSON(url, { timeout: 15000 });
    const live = toLive(raw, day, cs);
    ctx.log('live ok', day, live.cities.length, 'cities');
    return { ...ctx.data, live };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const rows = p.cities.map((c) => {
      const avg = mean(c.prev);
      return { ...c, avg, last: c.prev[13] };
    });
    ctx.log('puzzle', p.date, p.live ? 'live' : 'snapshot', rows.map((r) => `${r.en}:${r.val}`).join(' '));
    const ymax = Math.max(...rows.flatMap((r) => r.prev.filter((v) => v != null))) * 1.08;
    const sparks = await Promise.all(rows.map((r) => ui.plot((Plot, c) => ({
      marks: [
        Plot.lineY(r.prev.map((v, i) => ({ i, v })).filter((d) => d.v != null), { x: 'i', y: 'v', stroke: c.accent, strokeWidth: 2 }),
        Plot.dot([{ i: 13, v: r.last }], { x: 'i', y: 'v', fill: c.accent }),
      ],
      x: { domain: [0, 13] }, y: { domain: [0, ymax] },
    }), { height: 64, width: 130, axis: false })));
    ctx.stage.append(ui.panel({ kicker: p.live ? 'Clues \u00b7 live data' : 'Clues \u00b7 snapshot data', title: `Target day: ${p.date}` },
      ui.h('p', { class: 'ink2' }, `Daily mean PM2.5 (\u00b5g/m\u00b3) for the 14 days before the target day. All curves share a 0\u2013${Math.round(ymax)} axis and the dot is the day before. The target day\u2019s value is hidden.`),
      ui.grid(130, ...rows.map((r, i) => ui.h('div', { class: 'ds-stack' }, ui.h('b', r.en), sparks[i],
        ui.h('div', { class: 'small mono muted' }, ui.h('div', `Avg ${r.avg.toFixed(0)}`), ui.h('div', `Day before ${r.last.toFixed(0)}`)))))));
    const res = await ctx.order({
      items: rows.map((r) => ({ id: r.en, label: r.en, sub: `14-day avg ${r.avg.toFixed(0)} \u00b7 day before ${r.last.toFixed(0)}`, value: r.val })),
      direction: 'desc', attempts: 3, title: `${p.date}: whose air is dirtiest?`, topLabel: 'Highest PM2.5', bottomLabel: 'Lowest',
      format: (v) => `${v.toFixed(1)} µg/m³`,
    });
    const sorted = rows.slice().sort((a, b) => b.val - a.val);
    const mover = rows.slice().sort((a, b) => Math.abs(Math.log(b.val / b.avg)) - Math.abs(Math.log(a.val / a.avg)))[0];
    const pct = Math.round(Math.abs(mover.val / mover.avg - 1) * 100);
    const hAvg = heuristicHits(rows, 'avg'), hLast = heuristicHits(rows, 'last');
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({ columns: [{ key: 'en', label: 'City', fmt: (v, row) => ui.h('div', {}, v, ui.h('div', { class: 'small muted' }, row.b)) }, { key: 'val', label: 'Target', num: true }, { key: 'avg', label: 'Avg', num: true }, { key: 'last', label: 'Prev.', num: true }],
        rows: sorted.map((r) => ({ en: r.en, val: r.val.toFixed(1), avg: r.avg.toFixed(1), last: r.last.toFixed(1), b: band(r.val) })) }),
      ui.callout(`Answer: ${sorted.map((r) => r.en).join(' > ')}. The dirtiest was ${sorted[0].en} (${sorted[0].val.toFixed(1)}), the cleanest ${sorted[4].en} (${sorted[4].val.toFixed(1)}).`, 'good'),
      ui.callout(`Ranking by the two-week average alone gets ${hAvg}/5 positions right; ranking by the day before gets ${hLast}/5. ${mover.en} strayed furthest from its own average: ${mover.val.toFixed(0)} on the target day against an average of ${mover.avg.toFixed(0)}, ${pct}% ${mover.val > mover.avg ? 'higher' : 'lower'}. ${mover.val > mover.avg ? 'The uptick at the end of the curve was the warning: pollution was building.' : 'Wind or rain scrubbed the air and the pollution washed away.'}`));
    return res;
  },
};
